// server.js (seu arquivo de backend Node.js)

const express = require('express');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const sharp = require('sharp'); // Importação do Sharp

// --- NOVAS IMPORTAÇÕES PARA AWS S3 (V3) ---
require('dotenv').config(); // Garante que as variáveis de ambiente do .env sejam carregadas
const { S3Client, DeleteObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { URL } = require('url');
// ------------------------------------

const app = express();
const port = process.env.PORT || 3000;

// --- Configuração da Conexão ao MongoDB ---
const DB_URI = process.env.MONGODB_URI;

if (!DB_URI) {
    console.error('ERRO: Variável de ambiente MONGODB_URI não está definida!');
    process.exit(1);
}

mongoose.connect(DB_URI)
    .then(() => console.log('Conectado ao MongoDB Atlas com sucesso!'))
    .catch(err => console.error('Erro ao conectar ao MongoDB Atlas:', err));

// --- Definição do Esquema (Schema) e Modelo (Model) para o Mongoose ---
const userSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    idade: { type: Number, required: true },
    email: { type: String, required: true, unique: true },
    senha: { type: String, required: true },
    tipo: { type: String, required: true }, // 'cliente' ou 'trabalhador'
    avatarUrl: { type: String, default: 'https://via.placeholder.com/50?text=User' },
    cidade: { type: String },
    telefone: { type: String },
    atuacao: { type: String },
    descricao: { type: String },
    servicosImagens: [{ type: String }], // Array de URLs de imagens de serviços
    avaliacoes: [{ // Array de objetos de avaliação
        usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        estrelas: { type: Number, min: 1, max: 5 },
        comentario: { type: String },
        data: { type: Date, default: Date.now }
    }],
    mediaAvaliacao: { type: Number, default: 0 },
    totalAvaliacoes: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);

const postSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    imageUrl: { type: String }, // URL da imagem do S3
    createdAt: { type: Date, default: Date.now }
});

const Post = mongoose.model('Post', postSchema);

// --- Configuração do S3 ---
const bucketName = process.env.S3_BUCKET_NAME;
const region = process.env.S3_BUCKET_REGION;
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

// --- Configuração do Multer (ÚNICO E CORRETO) ---
// Usando memoryStorage para permitir o processamento com Sharp antes do upload
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Apenas imagens são permitidas!'), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB limite
    }
});

// --- Middlewares ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- Middleware de Autenticação JWT ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) {
        return res.sendStatus(401);
    }
    jwt.verify(token, jwtSecret, (err, user) => {
        if (err) {
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
};

// --- Rotas de Autenticação e Usuário ---

// Rota de Registro
app.post('/api/register', upload.single('fotoPerfil'), async (req, res) => {
    try {
        const { nome, idade, email, senha, tipo, cidade, telefone, atuacao, descricao } = req.body;
        
        if (!nome || !email || !senha) {
            return res.status(400).json({ success: false, message: 'Nome, email e senha são obrigatórios.' });
        }
        
        const hashedPassword = await bcrypt.hash(senha, 10);

        let avatarUrl = 'https://via.placeholder.com/50?text=User';

        if (req.file) {
            const resizedAvatarBuffer = await sharp(req.file.buffer)
                .resize(100, 100, {
                    fit: sharp.fit.cover,
                    withoutEnlargement: true
                })
                .toBuffer();

            const uploadParams = {
                Bucket: bucketName,
                Key: `avatars/${Date.now()}-${req.file.originalname}`,
                Body: resizedAvatarBuffer,
                ContentType: req.file.mimetype,
                ACL: 'public-read'
            };
            await s3.send(new PutObjectCommand(uploadParams));
            avatarUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${uploadParams.Key}`;
        }

        const newUser = new User({
            nome,
            idade,
            email,
            senha: hashedPassword,
            tipo,
            avatarUrl,
            cidade,
            telefone,
            atuacao,
            descricao
        });

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

app.get('/api/user/:id', authenticateToken, async (req, res) => {
    try {
        const userIdFromParams = req.params.id;
        const userIdFromToken = req.user.userId;

        if (userIdFromParams !== userIdFromToken) {
            return res.status(403).json({ success: false, message: 'Acesso não autorizado ao perfil.' });
        }

        const user = await User.findById(userIdFromParams)
                               .select('-senha');

        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        res.status(200).json({ success: true, user: user });

    } catch (error) {
        console.error('Backend - Erro ao buscar dados do usuário:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao buscar dados do usuário.' });
    }
});


// Rota para atualizar perfil do usuário (protegida)
app.put('/api/user/:id', authenticateToken, upload.single('avatar'), async (req, res) => {
    try {
        const userId = req.params.id;
        if (req.user.userId !== userId) {
            return res.status(403).json({ success: false, message: 'Acesso não autorizado para atualizar este perfil.' });
        }

        const updates = req.body;
        if (req.file) {
            const resizedAvatarBuffer = await sharp(req.file.buffer)
                .resize(100, 100, {
                    fit: sharp.fit.cover,
                    withoutEnlargement: true
                })
                .toBuffer();

            const uploadParams = {
                Bucket: bucketName,
                Key: `avatars/${Date.now()}-${req.file.originalname}`,
                Body: resizedAvatarBuffer,
                ContentType: req.file.mimetype,
                ACL: 'public-read'
            };
            await s3.send(new PutObjectCommand(uploadParams));
            updates.avatarUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${uploadParams.Key}`;
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


// Rota para adicionar imagens ao portfólio de serviços (apenas trabalhadores)
app.post('/api/user/:id/servicos-imagens', authenticateToken, upload.array('servicoImagens', 5), async (req, res) => {
    try {
        const userId = req.params.id;
        if (req.user.userId !== userId || req.user.tipo !== 'trabalhador') {
            return res.status(403).json({ success: false, message: 'Acesso não autorizado ou tipo de usuário incorreto.' });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'Nenhuma imagem enviada.' });
        }

        const newImageUrls = [];
        for (const file of req.files) {
            const resizedImageBuffer = await sharp(file.buffer)
                .resize(800, 600, {
                    fit: sharp.fit.cover,
                    withoutEnlargement: true
                })
                .toBuffer();
            const uploadParams = {
                Bucket: bucketName,
                Key: `servicos/${Date.now()}-${file.originalname}`,
                Body: resizedImageBuffer,
                ContentType: file.mimetype,
                ACL: 'public-read'
            };
            await s3.send(new PutObjectCommand(uploadParams));
            newImageUrls.push(`https://${bucketName}.s3.${region}.amazonaws.com/${uploadParams.Key}`);
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        user.servicosImagens.push(...newImageUrls);
        await user.save();

        res.status(200).json({ success: true, message: 'Imagens de serviço adicionadas com sucesso!', imageUrls: newImageUrls });
    } catch (error) {
        console.error('Erro ao adicionar imagens de serviço:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao adicionar imagens de serviço.' });
    }
});


// Rota para remover imagem do portfólio (apenas trabalhadores)
app.delete('/api/user/:userId/servicos-imagens/:imageIndex', authenticateToken, async (req, res) => {
    try {
        const { userId, imageIndex } = req.params;

        if (req.user.userId !== userId || req.user.tipo !== 'trabalhador') {
            return res.status(403).json({ success: false, message: 'Acesso não autorizado ou tipo de usuário incorreto.' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        if (imageIndex < 0 || imageIndex >= user.servicosImagens.length) {
            return res.status(400).json({ success: false, message: 'Índice da imagem inválido.' });
        }

        const imageUrlToRemove = user.servicosImagens[imageIndex];

        const s3Key = new URL(imageUrlToRemove).pathname.substring(1);
        if (s3Key) {
            const deleteParams = {
                Bucket: bucketName,
                Key: s3Key,
            };
            try {
                await s3.send(new DeleteObjectCommand(deleteParams));
                console.log(`Imagem ${s3Key} deletada do S3 com sucesso.`);
            } catch (s3DeleteError) {
                console.error(`Erro ao deletar imagem ${s3Key} do S3:`, s3DeleteError);
            }
        }

        user.servicosImagens.splice(imageIndex, 1);
        await user.save();

        res.status(200).json({ success: true, message: 'Imagem de serviço removida com sucesso.' });
    } catch (error) {
        console.error('Erro ao remover imagem de serviço:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao remover imagem de serviço.' });
    }
});


// Rota para Criar uma Publicação (protegida)
app.post('/api/posts', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        const { content } = req.body;
        const userId = req.user.userId;
        let imageUrl = null;

        if (req.file) {
            const resizedPostBuffer = await sharp(req.file.buffer)
                .resize(1200, 800, {
                    fit: sharp.fit.inside,
                    withoutEnlargement: true
                })
                .toBuffer();

            const uploadParams = {
                Bucket: bucketName,
                Key: `posts/${Date.now()}-${req.file.originalname}`,
                Body: resizedPostBuffer,
                ContentType: req.file.mimetype,
                ACL: 'public-read'
            };
            await s3.send(new PutObjectCommand(uploadParams));
            imageUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${uploadParams.Key}`;
        }

        if (!content && !imageUrl) {
            return res.status(400).json({ success: false, message: 'O conteúdo da publicação não pode estar vazio.' });
        }

        const newPost = new Post({
            userId: userId,
            content: content,
            imageUrl: imageUrl
        });

        await newPost.save();

        res.status(201).json({
            success: true,
            message: 'Publicação criada com sucesso!',
            post: newPost
        });

    } catch (error) {
        console.error('Erro ao criar publicação:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao criar publicação.' });
    }
});


// --- Rota para Obter Todas as Publicações (Feed) ---
app.get('/api/posts', authenticateToken, async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 }).populate('userId', 'nome avatarUrl tipo');
        res.status(200).json({ success: true, posts: posts });
    } catch (error) {
        console.error('Erro ao obter publicações:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao obter publicações.' });
    }
});

// Rota para Deletar uma Publicação (protegida)
app.delete('/api/posts/:id', authenticateToken, async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.user.userId;

        const post = await Post.findById(postId);

        if (!post) {
            return res.status(404).json({ success: false, message: 'Publicação não encontrada.' });
        }

        if (post.userId.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'Você não tem permissão para excluir esta publicação.' });
        }

        if (post.imageUrl) {
            const key = new URL(post.imageUrl).pathname.substring(1);

            const deleteParams = {
                Bucket: bucketName,
                Key: key,
            };

            try {
                await s3.send(new DeleteObjectCommand(deleteParams));
                console.log(`Imagem ${key} deletada do S3 com sucesso.`);
            } catch (s3DeleteError) {
                console.error(`Erro ao deletar imagem ${key} do S3:`, s3DeleteError);
            }
        }

        await Post.deleteOne({ _id: postId });

        res.status(200).json({ success: true, message: 'Publicação excluída com sucesso.' });

    } catch (error) {
        console.error('Erro ao excluir publicação:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao excluir publicação.' });
    }
});


// --- Rota para avaliar trabalhadores ---
app.post('/api/user/:id/avaliar', authenticateToken, async (req, res) => {
    try {
        const trabalhadorId = req.params.id;
        const { estrelas, comentario } = req.body;
        const avaliadorId = req.user.userId;

        if (!estrelas || estrelas < 1 || estrelas > 5) {
            return res.status(400).json({ success: false, message: 'A avaliação deve ter entre 1 e 5 estrelas.' });
        }
        if (!trabalhadorId || trabalhadorId === avaliadorId) {
            return res.status(400).json({ success: false, message: 'Não é possível avaliar seu próprio perfil ou um ID inválido.' });
        }

        const trabalhador = await User.findById(trabalhadorId);
        if (!trabalhador || trabalhador.tipo !== 'trabalhador') {
            return res.status(404).json({ success: false, message: 'Trabalhador não encontrado ou tipo de usuário incorreto.' });
        }

        const avaliacaoExistente = trabalhador.avaliacoes.find(
            avaliacao => avaliacao.usuarioId.toString() === avaliadorId
        );

        if (avaliacaoExistente) {
            return res.status(409).json({ success: false, message: 'Você já avaliou este trabalhador. Para alterar, edite sua avaliação existente.' });
        }

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

app.listen(port, () => {
    console.log(`Servidor de backend rodando em http://localhost:${port}`);
});