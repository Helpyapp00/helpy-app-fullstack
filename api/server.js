const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const dotenv = require('dotenv');
const sharp = require('sharp');
const { URL } = require('url');

dotenv.config();

// --- Configuração da Conexão ao MongoDB ---
const DB_URI = process.env.MONGODB_URI;

if (!DB_URI) {
    console.error('ERRO: Variável de ambiente MONGODB_URI não está definida!');
    process.exit(1);
}

mongoose.connect(DB_URI)
    .then(() => console.log('Conectado ao MongoDB Atlas com sucesso!'))
    .catch(err => console.error('Erro ao conectar ao MongoDB Atlas:', err));

// --- Schemas de Avaliação, Serviço, Postagem e Usuário ---
const avaliacaoSchema = new mongoose.Schema({
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    estrelas: { type: Number, required: true },
    comentario: { type: String, trim: true },
    data: { type: Date, default: Date.now }
});

const servicoSchema = new mongoose.Schema({
    url: { type: String, required: true },
    titulo: { type: String, default: '' },
    descricao: { type: String, default: '' },
    avaliacoes: [avaliacaoSchema]
});

const postSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String },
    imageUrl: { type: String },
    createdAt: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    idade: { type: Number },
    email: { type: String, required: true, unique: true },
    senha: { type: String, required: true },
    tipo: { type: String, enum: ['trabalhador', 'cliente'], required: true },
    avatarUrl: { type: String, default: 'https://via.placeholder.com/50?text=User' },
    cidade: { type: String },
    telefone: { type: String },
    atuacao: { type: String },
    descricao: { type: String },
    servicosImagens: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Servico' }],
    avaliacoes: [avaliacaoSchema],
    mediaAvaliacao: { type: Number, default: 0 },
    totalAvaliacoes: { type: Number, default: 0 }
});

// --- Modelos de Dados ---
const User = mongoose.model('User', userSchema);
const Servico = mongoose.model('Servico', servicoSchema);
const Post = mongoose.model('Post', postSchema);

// --- Configuração do AWS S3 ---
const bucketName = process.env.S3_BUCKET_NAME;
const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const jwtSecret = process.env.JWT_SECRET;

const s3 = new S3Client({
    region,
    credentials: {
        accessKeyId,
        secretAccessKey
    }
});

// --- Configuração do Multer ---
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Apenas imagens são permitidas!'), false);
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

const app = express();
// --- Middlewares ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Middleware de Autenticação JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ success: false, message: 'Token não fornecido.' });

    jwt.verify(token, jwtSecret, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: 'Token inválido.' });
        req.user = user;
        next();
    });
};

// --- Rotas de Autenticação e Usuário ---

// Rota de Registro
app.post('/api/register', upload.single('fotoPerfil'), async (req, res) => {
    try {
        const { nome, idade, email, senha, tipo, cidade, telefone, atuacao, descricao } = req.body;
        
        if (!nome || !email || !senha || !tipo) {
            return res.status(400).json({ success: false, message: 'Nome, email, senha e tipo são obrigatórios.' });
        }
        
        const hashedPassword = await bcrypt.hash(senha, 10);
        let avatarUrl = 'https://via.placeholder.com/50?text=User';

        if (req.file) {
            const resizedAvatarBuffer = await sharp(req.file.buffer)
                .resize(400, 400, { fit: 'cover', withoutEnlargement: true })
                .toBuffer();

            const key = `avatars/${Date.now()}-${req.file.originalname}`;
            const uploadParams = {
                Bucket: bucketName,
                Key: key,
                Body: resizedAvatarBuffer,
                ContentType: req.file.mimetype,
            };
            await s3.send(new PutObjectCommand(uploadParams));
            avatarUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
        }

        const newUser = new User({ nome, idade, email, senha: hashedPassword, tipo, avatarUrl, cidade, telefone, atuacao, descricao });
        await newUser.save();
        res.status(201).json({ success: true, message: 'Usuário registrado com sucesso!' });
    } catch (error) {
        console.error('Erro no registro:', error);
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'Este e-mail já está cadastrado.' });
        }
        res.status(500).json({ success: false, message: 'Erro interno do servidor durante o registro.' });
    }
});


// Rota de Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Credenciais inválidas.' });
        }

        const isMatch = await bcrypt.compare(senha, user.senha);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Credenciais inválidas.' });
        }

        const token = jwt.sign({ userId: user._id, email: user.email, tipo: user.tipo }, jwtSecret, { expiresIn: '1h' });
        res.status(200).json({
            success: true,
            message: 'Login bem-sucedido!',
            token,
            userId: user._id,
            userType: user.tipo,
            userName: user.nome,
            userPhotoUrl: user.avatarUrl
        });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor durante o login.' });
    }
});

// Rota para buscar dados do perfil do usuário
app.get('/api/user/:id', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-senha')
            .populate('servicosImagens')
            .exec();
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        res.status(200).json({ success: true, user: user });
    } catch (error) {
        console.error('Backend - Erro ao buscar dados do usuário:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao buscar dados do usuário.' });
    }
});

app.put('/api/user/:id', authenticateToken, upload.single('avatar'), async (req, res) => {
    try {
        const userId = req.params.id;
        if (req.user.userId !== userId) {
            return res.status(403).json({ success: false, message: 'Acesso não autorizado para atualizar este perfil.' });
        }

        const updates = req.body;
        if (req.file) {
            const resizedAvatarBuffer = await sharp(req.file.buffer)
                .resize(400, 400, { fit: 'cover', withoutEnlargement: true })
                .toBuffer();

            const key = `avatars/${Date.now()}-${req.file.originalname}`;
            const uploadParams = {
                Bucket: bucketName,
                Key: key,
                Body: resizedAvatarBuffer,
                ContentType: req.file.mimetype,
            };
            await s3.send(new PutObjectCommand(uploadParams));
            updates.avatarUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
        }

        if (updates.senha) {
            updates.senha = await bcrypt.hash(updates.senha, 10);
        }

        const updatedUser = await User.findByIdAndUpdate(userId, updates, { new: true, runValidators: true }).select('-senha');
        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado para atualização.' });
        }
        res.status(200).json({ success: true, message: 'Perfil atualizado com sucesso!', user: updatedUser });
    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'Este e-mail já está em uso por outro usuário.' });
        }
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao atualizar perfil.' });
    }
});


app.post('/api/user/:id/servicos', authenticateToken, upload.array('servicos', 10), async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
        if (user.tipo !== 'trabalhador') return res.status(403).json({ message: 'Apenas trabalhadores podem adicionar fotos de serviço.' });

        const servicosAdicionados = [];
        for (const file of req.files) {
            const novoServico = new Servico({ url: file.location });
            await novoServico.save();
            servicosAdicionados.push(novoServico._id);
        }

        user.servicosImagens.push(...servicosAdicionados);
        await user.save();
        res.status(200).json({ message: 'Fotos de serviço adicionadas com sucesso!', servicos: servicosAdicionados });
    } catch (error) {
        console.error('Erro ao fazer upload de fotos de serviço:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});


app.get('/api/servico/:servicoId', async (req, res) => {
    try {
        const { servicoId } = req.params;
        const servico = await Servico.findById(servicoId).populate('avaliacoes').exec();
        if (!servico) return res.status(404).json({ message: 'Serviço não encontrado.' });
        res.status(200).json(servico);
    } catch (error) {
        console.error('Erro ao buscar serviço:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

app.delete('/api/user/:userId/servicos-imagens/:servicoId', authenticateToken, async (req, res) => {
    try {
        const { userId, servicoId } = req.params;
        if (req.user.userId !== userId) return res.status(403).json({ success: false, message: 'Acesso não autorizado.' });

        const user = await User.findByIdAndUpdate(
            userId,
            { $pull: { servicosImagens: servicoId } },
            { new: true }
        );

        if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });

        const servico = await Servico.findByIdAndDelete(servicoId);
        if (!servico) return res.status(404).json({ success: false, message: 'Serviço não encontrado.' });

        const s3Key = new URL(servico.url).pathname.substring(1);
        if (s3Key) {
            await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: s3Key }));
        }

        res.status(200).json({ success: true, message: 'Serviço removido com sucesso.' });
    } catch (error) {
        console.error('Erro ao remover serviço:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao remover serviço.' });
    }
});

app.post('/api/posts', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        const { content } = req.body;
        const userId = req.user.userId;
        let imageUrl = null;

        if (req.file) {
            const resizedPostBuffer = await sharp(req.file.buffer)
                .resize(1200, 800, { fit: 'inside', withoutEnlargement: true })
                .toBuffer();

            const key = `posts/${Date.now()}-${req.file.originalname}`;
            const uploadParams = {
                Bucket: bucketName,
                Key: key,
                Body: resizedPostBuffer,
                ContentType: req.file.mimetype,
            };
            await s3.send(new PutObjectCommand(uploadParams));
            imageUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
        }
        if (!content && !imageUrl) return res.status(400).json({ success: false, message: 'O conteúdo da publicação não pode estar vazio.' });

        const newPost = new Post({ userId, content, imageUrl });
        await newPost.save();
        res.status(201).json({ success: true, message: 'Publicação criada com sucesso!', post: newPost });
    } catch (error) {
        console.error('Erro ao criar publicação:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao criar publicação.' });
    }
});


app.get('/api/posts', authenticateToken, async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 }).populate('userId', 'nome avatarUrl tipo');
        res.status(200).json({ success: true, posts: posts });
    } catch (error) {
        console.error('Erro ao obter publicações:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao obter publicações.' });
    }
});

app.delete('/api/posts/:id', authenticateToken, async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.user.userId;
        const post = await Post.findById(postId);

        if (!post) return res.status(404).json({ success: false, message: 'Publicação não encontrada.' });
        if (post.userId.toString() !== userId) return res.status(403).json({ success: false, message: 'Você não tem permissão para excluir esta publicação.' });

        if (post.imageUrl) {
            const key = new URL(post.imageUrl).pathname.substring(1);
            await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
        }

        await Post.deleteOne({ _id: postId });
        res.status(200).json({ success: true, message: 'Publicação excluída com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir publicação:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao excluir publicação.' });
    }
});


app.post('/api/user/:id/avaliar', authenticateToken, async (req, res) => {
    try {
        const trabalhadorId = req.params.id;
        const { estrelas, comentario } = req.body;
        const avaliadorId = req.user.userId;

        if (!estrelas || estrelas < 1 || estrelas > 5) return res.status(400).json({ success: false, message: 'A avaliação deve ter entre 1 e 5 estrelas.' });
        if (trabalhadorId === avaliadorId) return res.status(400).json({ success: false, message: 'Não é possível avaliar seu próprio perfil.' });

        const trabalhador = await User.findById(trabalhadorId);
        if (!trabalhador || trabalhador.tipo !== 'trabalhador') return res.status(404).json({ success: false, message: 'Trabalhador não encontrado ou tipo de usuário incorreto.' });

        const avaliacaoExistente = trabalhador.avaliacoes.find(
            avaliacao => avaliacao.usuarioId.toString() === avaliadorId
        );

        if (avaliacaoExistente) return res.status(409).json({ success: false, message: 'Você já avaliou este trabalhador. Para alterar, edite sua avaliação existente.' });

        trabalhador.avaliacoes.push({
            usuarioId: avaliadorId,
            estrelas,
            comentario,
            data: new Date()
        });

        const totalEstrelas = trabalhador.avaliacoes.reduce((acc, aval) => acc + aval.estrelas, 0);
        trabalhador.mediaAvaliacao = totalEstrelas / trabalhador.avaliacoes.length;
        trabalhador.totalAvaliacoes = trabalhador.avaliacoes.length;

        await trabalhador.save();
        res.status(201).json({ success: true, message: 'Avaliação adicionada com sucesso!', mediaAvaliacao: trabalhador.mediaAvaliacao });
    } catch (error) {
        console.error('Erro ao avaliar trabalhador:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao avaliar trabalhador.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor de backend rodando em http://localhost:${PORT}`);
});