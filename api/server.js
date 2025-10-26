// api/server.js
const path = require('path'); 

// 🛑 Carrega o .env da pasta raiz (../)
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const { URL } = require('url');

const app = express();

let s3Client;
let bucketName;
let isDbConnected = false;

async function initializeServices() {
    // 1. CONEXÃO MONGOOSE
    if (!isDbConnected) {
        if (!process.env.MONGODB_URI) {
            console.error("ERRO CRÍTICO: MONGODB_URI não encontrado no .env.");
            throw new Error('Falha na conexão com o Banco de Dados.');
        }
        try {
            await mongoose.connect(process.env.MONGODB_URI);
            console.log('Conectado ao MongoDB Atlas com sucesso!');
            isDbConnected = true;
        } catch (err) {
            console.error('ERRO CRÍTICO ao conectar ao MongoDB Atlas:', err);
            throw new Error('Falha na conexão com o Banco de Dados.');
        }
    }

    // 2. CONFIGURAÇÃO AWS S3
    if (!s3Client) {
        if (!process.env.AWS_REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.S3_BUCKET_NAME) {
             console.warn("AVISO: Variáveis de ambiente AWS S3 incompletas no .env. Uploads de arquivos não funcionarão.");
        } else {
            s3Client = new S3Client({
                region: process.env.AWS_REGION,
                credentials: {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                }
            });
            bucketName = process.env.S3_BUCKET_NAME; 
            console.log("Cliente S3 inicializado com sucesso.");
        }
    }
}

// ----------------------------------------------------------------------
// DEFINIÇÃO DOS SCHEMAS
// ----------------------------------------------------------------------
const avaliacaoSchema = new mongoose.Schema({
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    estrelas: { type: Number, required: true },
    comentario: { type: String, trim: true },
    data: { type: Date, default: Date.now }
});

const servicoSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    images: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },
    avaliacoes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Avaliacao' }]
});

// 🛑 NOVO: Schema para Comentários
const commentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
}, { _id: true, timestamps: true }); // Adicionado _id e timestamps

const postagemSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    imageUrl: { type: String },
    createdAt: { type: Date, default: Date.now },
    // 🛑 NOVO: Campos de Likes e Comentários
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [commentSchema]
}, { timestamps: true }); // Adicionado timestamps para ordenação

const userSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    idade: { type: Number },
    cidade: { type: String }, // Este campo será usado no filtro
    tipo: { type: String, enum: ['cliente', 'trabalhador'], required: true },
    atuacao: { type: String, default: null },
    telefone: { type: String, default: null },
    descricao: { type: String, default: null },
    email: { type: String, required: true, unique: true },
    senha: { type: String, required: true },
    foto: { type: String, default: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png' },
    avatarUrl: { type: String, default: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png' },
    servicosImagens: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Servico' }],
    isVerified: { type: Boolean, default: false },
    mediaAvaliacao: { type: Number, default: 0 },
    totalAvaliacoes: { type: Number, default: 0 },
    avaliacoes: [avaliacaoSchema]
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Postagem = mongoose.model('Postagem', postagemSchema);
const Servico = mongoose.model('Servico', servicoSchema);
const Avaliacao = mongoose.model('Avaliacao', avaliacaoSchema);
// ----------------------------------------------------------------------


// ----------------------------------------------------------------------
// SERVIR ARQUIVOS ESTÁTICOS (HTML/CSS/JS) VEM PRIMEIRO
// ----------------------------------------------------------------------
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.get('/:pageName', (req, res, next) => {
  const pageName = req.params.pageName;
  if (pageName === 'api' || pageName.startsWith('api/')) {
      return next();
  }
  const filePath = path.join(publicPath, `${pageName}.html`);
  fs.access(filePath, fs.constants.F_OK, (err) => {
      if (err) {
          return next(); 
      }
      res.sendFile(filePath);
  });
});
// ----------------------------------------------------------------------


// ----------------------------------------------------------------------
// MIDDLEWARE DE INICIALIZAÇÃO (DB/S3) E PARSERS
// ----------------------------------------------------------------------
app.use(async (req, res, next) => {
    if (req.path.startsWith('/api')) {
        try {
            await initializeServices();
            if (!process.env.JWT_SECRET) {
                console.error("ERRO CRÍTICO: JWT_SECRET não foi carregado do .env. Rotas de API falharão.");
            }
            next();
        } catch (error) {
            console.error('Falha no middleware de inicialização da API:', error);
            res.status(500).json({ message: 'Erro interno de inicialização do servidor.' });
        }
    } else {
        next();
    }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ----------------------------------------------------------------------
// MIDDLEWARE DE AUTENTICAÇÃO E CONFIGURAÇÃO MULTER
// ----------------------------------------------------------------------

const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Nenhum token fornecido.' });
    }
    try {
        if (!process.env.JWT_SECRET) {
             console.error("Tentativa de autenticação falhou: JWT_SECRET não está configurado.");
             throw new Error("Erro de configuração do servidor.");
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token inválido ou expirado.' });
    }
};

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ----------------------------------------------------------------------
// ROTAS DE API (Login, Cadastro)
// ----------------------------------------------------------------------
app.post('/api/login', async (req, res) => {
    // ... (código de login sem alteração)
    const { email, senha } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        const isMatch = await bcrypt.compare(senha, user.senha);
        if (!isMatch) {
            return res.status(400).json({ message: 'Credenciais inválidas.' });
        }
        
        if (!process.env.JWT_SECRET) {
            console.error("ERRO no /api/login: JWT_SECRET não está configurado.");
            return res.status(500).json({ message: 'Erro interno do servidor: Chave de segurança ausente.' });
        }
        
        const token = jwt.sign(
            { id: user._id, email: user.email, tipo: user.tipo }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1d' }
        );
        
        res.json({ 
            success: true, 
            message: 'Login bem-sucedido!', 
            token, 
            userId: user._id, 
            userType: user.tipo, 
            userName: user.nome, 
            userPhotoUrl: user.foto
        });
    } catch (error) {
        console.error('Erro no login:', error.message || error); 
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

app.post('/api/cadastro', upload.single('fotoPerfil'), async (req, res) => {
    // ... (código de cadastro sem alteração)
    try {
        const { nome, idade, cidade, tipo, atuacao, telefone, descricao, email, senha } = req.body;
        const avatarFile = req.file;
        if (!nome || !email || !senha || !tipo) {
            return res.status(400).json({ message: "Campos obrigatórios (nome, email, senha, tipo) não preenchidos." });
        }
        let fotoUrl = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
        if (avatarFile) {
            if (!bucketName || !s3Client) {
                 console.error("ERRO no /api/cadastro: Tentativa de upload sem S3 configurado.");
            } else {
                try {
                    const imageBuffer = await sharp(avatarFile.buffer).resize(400, 400, { fit: 'cover' }).toFormat('jpeg').toBuffer();
                    const key = `avatars/${Date.now()}_${path.basename(avatarFile.originalname)}`;
                    const uploadCommand = new PutObjectCommand({ Bucket: bucketName, Key: key, Body: imageBuffer, ContentType: 'image/jpeg' });
                    await s3Client.send(uploadCommand);
                    fotoUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
                } catch (s3Error) {
                    console.error("Erro ao fazer upload da foto de cadastro para o S3:", s3Error);
                }
            }
        }
        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(senha, salt);
        const newUser = new User({
            nome, idade, cidade, tipo,
            atuacao: tipo === 'trabalhador' ? atuacao : null,
            telefone, descricao, email,
            senha: senhaHash,
            foto: fotoUrl, 
            avatarUrl: fotoUrl 
        });
        await newUser.save();
        if (!process.env.JWT_SECRET) {
            console.error("ERRO no /api/cadastro: JWT_SECRET não está configurado.");
            return res.status(500).json({ message: 'Erro interno do servidor: Chave de segurança ausente.' });
        }
        const token = jwt.sign({ id: newUser._id, email: newUser.email, tipo: newUser.tipo }, process.env.JWT_SECRET, { expiresIn: '1d' });
        const userResponse = newUser.toObject();
        delete userResponse.senha;
        res.status(201).json({ 
            success: true, message: 'Usuário cadastrado com sucesso!', 
            token, userId: newUser._id, userType: newUser.tipo,
            userName: newUser.nome, userPhotoUrl: newUser.foto 
        });
    } catch (error) {
        console.error('Erro ao cadastrar usuário:', error);
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Email já cadastrado.' });
        }
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});
// ----------------------------------------------------------------------


// ----------------------------------------------------------------------
// ROTAS DE POSTAGEM (ATUALIZADAS)
// ----------------------------------------------------------------------

// Rota de Criar Postagem
app.post('/api/posts', authMiddleware, upload.single('image'), async (req, res) => {
    // ... (código sem alteração, mas o populate no final foi ajustado)
    try {
        const { content } = req.body;
        const userId = req.user.id;
        let imageUrl = null;
        if (req.file && (!bucketName || !s3Client)) {
             console.error("ERRO no /api/posts: Tentativa de upload sem S3 configurado.");
             throw new Error("Configuração AWS S3 incompleta. Uploads de arquivos não funcionarão.");
        }
        if (req.file) {
            const imageBuffer = await sharp(req.file.buffer).resize(800, 600, { fit: sharp.fit.inside, withoutEnlargement: true }).toFormat('jpeg').toBuffer();
            const key = `posts/${Date.now()}_${path.basename(req.file.originalname)}`;
            const command = new PutObjectCommand({ Bucket: bucketName, Key: key, Body: imageBuffer, ContentType: 'image/jpeg' });
            await s3Client.send(command);
            imageUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
        }
        const newPost = new Postagem({ userId, content, imageUrl });
        await newPost.save();
        
        // Popula o post recém-criado para enviá-lo de volta ao front-end
        const populatedPost = await Postagem.findById(newPost._id)
            .populate('userId', 'nome foto avatarUrl tipo cidade'); // 🛑 Adicionado 'cidade'
        
        res.status(201).json({ success: true, message: 'Postagem criada com sucesso!', post: populatedPost });
    } catch (error) {
        console.error('Erro ao criar postagem:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao criar postagem.' });
    }
});

// Rota de Deletar Postagem
app.delete('/api/posts/:id', authMiddleware, async (req, res) => {
    // ... (código sem alteração)
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const postagem = await Postagem.findById(id);
        if (!postagem) {
            return res.status(404).json({ success: false, message: 'Postagem não encontrada.' });
        }
        if (postagem.userId.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'Acesso negado. Você não pode deletar esta postagem.' });
        }
        if (postagem.imageUrl) {
             if (!bucketName || !s3Client) {
                console.error("ERRO no delete /api/posts: Tentativa de delete sem S3 configurado.");
             } else {
                const urlObj = new URL(postagem.imageUrl);
                const key = urlObj.pathname.substring(1);
                const command = new DeleteObjectCommand({ Bucket: bucketName, Key: key });
                await s3Client.send(command);
             }
        }
        await postagem.deleteOne();
        res.json({ success: true, message: 'Postagem deletada com sucesso.' });
    } catch (error) {
        console.error('Erro ao deletar postagem:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao deletar postagem.' });
    }
});

// 🛑 Rota de Buscar Postagens (Feed) ATUALIZADA
app.get('/api/posts', authMiddleware, async (req, res) => {
    try {
        const { cidade } = req.query;
        let query = {};

        // 🛑 NOVO: Lógica do Filtro de Cidade
        if (cidade) {
            // Cria uma busca case-insensitive para a cidade
            const cidadeQuery = new RegExp(cidade, 'i');
            // Encontra usuários que moram nessa cidade
            const usersInCity = await User.find({ cidade: cidadeQuery }).select('_id');
            // Pega apenas os IDs
            const userIds = usersInCity.map(u => u._id);
            // Adiciona ao filtro de postagens
            query.userId = { $in: userIds };
        }

        const posts = await Postagem.find(query)
            .sort({ createdAt: -1 })
            // 🛑 MUDANÇA: Adicionado 'cidade' ao populate
            .populate('userId', 'nome foto avatarUrl tipo cidade')
            // 🛑 NOVO: Popula os dados do usuário que comentou
            .populate('comments.userId', 'nome foto avatarUrl'); 
            
        res.json(posts);
    } catch (error) {
        console.error('Erro ao buscar postagens:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// Rota de Buscar Postagens (DO PRÓPRIO USUÁRIO para o perfil)
app.get('/api/user-posts/:userId', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        const posts = await Postagem.find({ userId: userId })
            .sort({ createdAt: -1 })
            // 🛑 MUDANÇA: Adicionado 'cidade' ao populate
            .populate('userId', 'nome foto avatarUrl tipo cidade')
            // 🛑 NOVO: Popula comentários também na página de perfil
            .populate('comments.userId', 'nome foto avatarUrl');
        res.json(posts);
    } catch (error) {
        console.error('Erro ao buscar postagens do usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// 🛑 NOVA Rota: Curtir/Descurtir Postagem
app.post('/api/posts/:id/like', authMiddleware, async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.user.id;
        
        const post = await Postagem.findById(postId);
        if (!post) {
            return res.status(404).json({ success: false, message: 'Postagem não encontrada.' });
        }

        const likeIndex = post.likes.indexOf(userId);

        if (likeIndex > -1) {
            // Já curtiu, então descurte (remove o ID)
            post.likes.splice(likeIndex, 1);
        } else {
            // Não curtiu, então curte (adiciona o ID)
            post.likes.push(userId);
        }

        await post.save();
        res.json({ success: true, likes: post.likes });

    } catch (error) {
        console.error('Erro ao curtir postagem:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🛑 NOVA Rota: Comentar em Postagem
app.post('/api/posts/:id/comment', authMiddleware, async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.user.id;
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({ success: false, message: 'O conteúdo do comentário é obrigatório.' });
        }

        const post = await Postagem.findById(postId);
        if (!post) {
            return res.status(404).json({ success: false, message: 'Postagem não encontrada.' });
        }

        const newComment = {
            userId: userId,
            content: content,
            createdAt: new Date()
        };

        post.comments.push(newComment);
        await post.save();
        
        // Pega o comentário recém-adicionado (o último do array)
        const addedComment = post.comments[post.comments.length - 1];
        
        // Popula manualmente o userId do comentário antes de enviar de volta
        await addedComment.populate('userId', 'nome foto avatarUrl');

        res.status(201).json({ success: true, comment: addedComment });

    } catch (error) {
        console.error('Erro ao comentar na postagem:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});


// ----------------------------------------------------------------------
// ROTAS DE PERFIL, SERVIÇOS, AVALIAÇÃO (Sem grandes alterações)
// ----------------------------------------------------------------------
app.get('/api/usuario/:id', authMiddleware, async (req, res) => {
    // ... (código sem alteração)
    try {
        const { id } = req.params;
        const user = await User.findById(id).select('-senha').populate('servicosImagens')
            .populate({ path: 'avaliacoes', populate: { path: 'usuarioId', select: 'nome foto avatarUrl' }})
            .exec();
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        const userClean = user.toObject();
        userClean.avatarUrl = userClean.foto; 
        res.json(userClean);
    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

app.get('/api/servicos/:userId', authMiddleware, async (req, res) => {
    // ... (código sem alteração)
    try {
        const { userId } = req.params;
        const servicos = await Servico.find({ userId: userId });
        res.json(servicos);
    } catch (error) {
        console.error('Erro ao buscar serviços do usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

app.put('/api/editar-perfil/:id', authMiddleware, upload.single('avatar'), async (req, res) => {
    // ... (código sem alteração)
    try {
        const { id } = req.params;
        const { nome, idade, cidade, telefone, atuacao, descricao } = req.body;
        const avatarFile = req.file;
        if (avatarFile && (!bucketName || !s3Client)) {
             console.error("ERRO no /api/editar-perfil: Tentativa de upload sem S3 configurado.");
             throw new Error("Configuração AWS S3 incompleta.");
        }
        if (req.user.id !== id) {
            return res.status(403).json({ success: false, message: 'Acesso negado. Você só pode editar seu próprio perfil.' });
        }
        let fotoUrl = null;
        if (avatarFile) {
            const imageBuffer = await sharp(avatarFile.buffer).resize(400, 400, { fit: 'cover' }).toFormat('jpeg').toBuffer();
            const key = `avatars/${Date.now()}_${path.basename(avatarFile.originalname)}`;
            const uploadCommand = new PutObjectCommand({ Bucket: bucketName, Key: key, Body: imageBuffer, ContentType: 'image/jpeg' });
            await s3Client.send(uploadCommand);
            fotoUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
        }
        const updates = { nome, idade, cidade, telefone, atuacao, descricao };
        if (fotoUrl) {
            updates.foto = fotoUrl;
            updates.avatarUrl = fotoUrl;
        }
        const updatedUser = await User.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true }).select('-senha');
        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        const userResponse = updatedUser.toObject();
        res.json({ success: true, message: 'Perfil atualizado com sucesso!', user: userResponse });
    } catch (error) {
        console.error('Erro ao editar perfil:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao atualizar o perfil.' });
    }
});

app.get('/api/trabalhadores', authMiddleware, async (req, res) => {
    // ... (código sem alteração)
    try {
        const { search } = req.query;
        let query = { tipo: 'trabalhador' };
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query = { 
                tipo: 'trabalhador', 
                $or: [
                    { nome: searchRegex }, 
                    { atuacao: searchRegex }, 
                    { descricao: searchRegex }, 
                    { cidade: searchRegex }
                ] 
            };
        }
        const trabalhadores = await User.find(query).select('-senha');
        res.json(trabalhadores);
    } catch (error) {
        console.error('Erro ao buscar trabalhadores:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

app.get('/api/trabalhador/:id', authMiddleware, async (req, res) => {
    // ... (código sem alteração)
    try {
        const { id } = req.params;
        const trabalhador = await User.findById(id).select('-senha');
        if (!trabalhador || trabalhador.tipo !== 'trabalhador') {
            return res.status(404).json({ message: 'Trabalhador não encontrado.' });
        }
        res.json(trabalhador);
    } catch (error) {
        console.error('Erro ao buscar trabalhador:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

app.post('/api/servico', authMiddleware, upload.array('images', 5), async (req, res) => {
    // ... (código sem alteração)
    try {
        const { title, description } = req.body;
        const userId = req.user.id;
        const imageFiles = req.files;
        if (imageFiles && imageFiles.length > 0 && (!bucketName || !s3Client)) {
            console.error("ERRO no /api/servico: Tentativa de upload sem S3 configurado.");
            throw new Error("Configuração AWS S3 incompleta.");
        }
        if (req.user.tipo !== 'trabalhador') {
            return res.status(403).json({ success: false, message: 'Apenas trabalhadores podem criar serviços.' });
        }
        const imageUrls = [];
        if (imageFiles && imageFiles.length > 0) {
            for (const file of imageFiles) {
                const imageBuffer = await sharp(file.buffer).resize(800, 600, { fit: 'inside', withoutEnlargement: true }).toFormat('jpeg').toBuffer();
                const key = `servicos/${Date.now()}_${path.basename(file.originalname)}`;
                const command = new PutObjectCommand({ Bucket: bucketName, Key: key, Body: imageBuffer, ContentType: 'image/jpeg' });
                await s3Client.send(command);
                imageUrls.push(`https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`);
            }
        }
        const novoServico = new Servico({ userId, title, description, images: imageUrls });
        await novoServico.save();
        await User.findByIdAndUpdate(userId, { $push: { servicosImagens: novoServico._id } });
        res.status(201).json({ success: true, message: 'Serviço criado com sucesso!', servico: novoServico });
    } catch (error) {
        console.error('Erro ao criar serviço:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao criar serviço.' });
    }
});

app.delete('/api/user/:userId/servicos/:servicoId', authMiddleware, async (req, res) => {
    // ... (código sem alteração)
    try {
        const { userId, servicoId } = req.params;
        if (req.user.id !== userId) {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        const servico = await Servico.findById(servicoId);
        if (!servico) {
            return res.status(404).json({ success: false, message: 'Serviço não encontrado.' });
        }
        if (servico.images && servico.images.length > 0) {
            if (!bucketName || !s3Client) {
                 console.error("ERRO no delete /api/user/servicos: Tentativa de delete sem S3 configurado.");
            } else {
                for (const imageUrl of servico.images) {
                    const urlObj = new URL(imageUrl);
                    const key = urlObj.pathname.substring(1);
                    const command = new DeleteObjectCommand({ Bucket: bucketName, Key: key });
                    await s3Client.send(command);
                }
            }
        }
        await servico.deleteOne();
        await User.findByIdAndUpdate(userId, { $pull: { servicosImagens: servicoId } });
        res.json({ success: true, message: 'Serviço removido com sucesso.' });
    } catch (error) {
        console.error('Erro ao remover serviço:', error);
        res.status(500).json({ success: false, message: 'Erro ao remover o serviço.' });
    }
});

app.post('/api/avaliar-trabalhador', authMiddleware, async (req, res) => {
    // ... (código sem alteração)
    try {
        const { trabalhadorId, estrelas, comentario } = req.body;
        const avaliadorId = req.user.id;
        if (req.user.tipo === 'trabalhador') {
            return res.status(403).json({ success: false, message: 'Trabalhadores não podem avaliar.' });
        }
        if (trabalhadorId === avaliadorId) {
            return res.status(400).json({ success: false, message: 'Você não pode avaliar a si mesmo.' });
        }
        const trabalhador = await User.findById(trabalhadorId);
        if (!trabalhador || trabalhador.tipo !== 'trabalhador') {
            return res.status(404).json({ success: false, message: 'Trabalhador não encontrado.' });
        }
        const avaliacaoExistenteIndex = trabalhador.avaliacoes.findIndex(
            (aval) => aval.usuarioId.toString() === avaliadorId
        );
        if (avaliacaoExistenteIndex > -1) {
            trabalhador.avaliacoes[avaliacaoExistenteIndex].estrelas = estrelas;
            trabalhador.avaliacoes[avaliacaoExistenteIndex].comentario = comentario;
            trabalhador.avaliacoes[avaliacaoExistenteIndex].data = new Date();
        } else {
            trabalhador.avaliacoes.push({
                usuarioId: avaliadorId,
                estrelas,
                comentario,
                data: new Date()
            });
        }
        const totalEstrelas = trabalhador.avaliacoes.reduce((acc, aval) => acc + aval.estrelas, 0);
        trabalhador.mediaAvaliacao = totalEstrelas / trabalhador.avaliacoes.length;
        trabalhador.totalAvaliacoes = trabalhador.avaliacoes.length;
        await trabalhador.save();
        res.status(201).json({ success: true, message: 'Avaliação enviada com sucesso!', mediaAvaliacao: trabalhador.mediaAvaliacao });
    } catch (error) {
        console.error('Erro ao avaliar trabalhador:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao avaliar.' });
    }
});

app.get('/api/servico/:servicoId', authMiddleware, async (req, res) => {
    // ... (código sem alteração)
    try {
        const { servicoId } = req.params;
        const servico = await Servico.findById(servicoId)
            .populate({
                path: 'avaliacoes',
                populate: { path: 'usuarioId', select: 'nome foto avatarUrl' }
            })
            .exec();
        if (!servico) {
            return res.status(404).json({ message: 'Serviço não encontrado.' });
        }
        res.json(servico);
    } catch (error) {
        console.error('Erro ao buscar detalhes do serviço:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});


// Exporta o app (OBRIGATÓRIO para o Vercel Serverless)
module.exports = app;

// -----------------------------------------------------------
// Execução local (apenas quando rodando com npm start)
// -----------------------------------------------------------
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando localmente em http://localhost:${PORT}`);
    // Não inicializamos mais os serviços aqui, o middleware fará isso na primeira chamada de API.
  });
}

