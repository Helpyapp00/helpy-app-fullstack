// server.js (seu arquivo de backend Node.js)

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');
const { PassThrough } = require('stream');

// --- NOVAS IMPORTAÇÕES PARA AWS S3 (V3) ---
require('dotenv').config();
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const multerS3 = require('multer-s3');
// ------------------------------------

const app = express();
const port = 3000;

// --- Configuração da Conexão ao MongoDB ---
const DB_URI = 'mongodb+srv://helpyuser:gaL0QVzTcG1DI12M@cluster.jzlyekf.mongodb.net/helpy_db?retryWrites=true&w=majority';

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
    avatarUrl: { type: String, default: 'https://via.placeholder.com/50?text=User' }, // CORRIGIDO: de 'avatar' para 'avatarUrl'
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

userSchema.pre('save', async function(next) {
    if (this.isModified('senha')) {
        this.senha = await bcrypt.hash(this.senha, 10);
    }
    next();
});

const User = mongoose.model('User', userSchema);

// Esquema para Publicações (Posts)
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

const s3 = new S3Client({
    region,
    credentials: {
        accessKeyId,
        secretAccessKey
    }
});

// Configuração do Multer para upload de imagens para o S3
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: bucketName,
        metadata: function (req, file, cb) {
            cb(null, {fieldName: file.fieldname});
        },
        key: function (req, file, cb) {
            // Define o nome do arquivo no S3
            cb(null, 'uploads/' + Date.now() + '-' + file.originalname);
        }
    }),
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

// Configuração do Multer para upload de imagens de avatar para memória para processamento com sharp
const avatarUpload = multer({
    storage: multer.memoryStorage(), // Usa armazenamento em memória para permitir processamento com sharp
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Apenas imagens são permitidas para avatares!'), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB limite para a imagem original
    }
});


// --- Middlewares ---
app.use(cors());
app.use(express.json()); // Para parsing de application/json
app.use(express.urlencoded({ extended: true })); // Para parsing de application/x-www-form-urlencoded
app.use(express.static('C:/Users/frati/OneDrive/Documentos/helpy-site'));

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, 'public')));

// --- JWT Secret ---
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey'; // Use uma variável de ambiente real em produção!

// --- Middleware de Autenticação JWT ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401); // Se não houver token

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('Erro de verificação do token:', err);
            return res.sendStatus(403); // Token inválido ou expirado
        }
        req.user = user;
        next();
    });
};

// --- Rotas de Autenticação e Usuário ---

// Rota de Registro
app.post('/api/register', avatarUpload.single('avatar'), async (req, res) => {
    try {
        const { nome, idade, email, senha, tipo, cidade, telefone, atuacao, descricao } = req.body;
        let avatarUrl = 'https://via.placeholder.com/50?text=User'; // Default avatar

        if (req.file) {
            // Redimensionar a imagem do avatar para um tamanho adequado (ex: 100x100 pixels)
            const resizedAvatarBuffer = await sharp(req.file.buffer)
                .resize(100, 100, {
                    fit: sharp.fit.cover, // Garante que a imagem preencha as dimensões, cortando se necessário
                    withoutEnlargement: true // Não aumenta a imagem se ela for menor
                })
                .toBuffer();

            // Enviar a imagem redimensionada para o S3
            const uploadParams = {
                Bucket: bucketName,
                Key: `avatars/${Date.now()}-${req.file.originalname}`, // Pasta específica para avatares
                Body: resizedAvatarBuffer,
                ContentType: req.file.mimetype,
                ACL: 'public-read' // Torna o arquivo publicamente acessível
            };
            await s3.send(new PutObjectCommand(uploadParams));
            avatarUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${uploadParams.Key}`;
        }

        const newUser = new User({
            nome,
            idade,
            email,
            senha,
            tipo,
            avatar: avatarUrl,
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

        const token = jwt.sign({ userId: user._id, email: user.email, tipo: user.tipo }, JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({
            success: true,
            message: 'Login bem-sucedido!',
            token,
            userId: user._id,
            userType: user.tipo, // CORRIGIDO: de 'tipo' para 'userType' para corresponder ao frontend
            userName: user.nome, // ADICIONADO: para o frontend
            userPhotoUrl: user.avatarUrl // ADICIONADO: para o frontend, usando 'avatarUrl'
        });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor durante o login.' });
    }
});

// server.js (trecho importante da rota GET /api/user/:id)
app.get('/api/user/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.params.id;
        // Opcional: verifique se o usuário logado está tentando acessar o próprio perfil
        if (req.user.userId !== userId) { // CORRIGIDO: de 'req.user.id' para 'req.user.userId'
             // Dependendo da sua regra de negócio, você pode permitir ver outros perfis publicamente
             // ou retornar um 403 se for estritamente privado
            // return res.status(403).json({ success: false, message: 'Acesso não autorizado ao perfil.' });
        }

        const user = await User.findById(userId).select('-senha'); // Não retorne a senha!

        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        // Retorne todos os dados do usuário, incluindo avatarUrl e servicosImagens
        res.status(200).json({ success: true, user: user });

    } catch (error) {
        console.error('Erro ao buscar dados do usuário:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao buscar dados do usuário.' });
    }
});

// Rota para atualizar perfil do usuário (protegida)
app.put('/api/user/:id', authenticateToken, upload.single('avatar'), async (req, res) => {
    try {
        const userId = req.params.id;
        // Permite apenas que o próprio usuário atualize seu perfil
        if (req.user.userId !== userId) { // CORRIGIDO: de 'req.user.id' para 'req.user.userId'
            return res.status(403).json({ success: false, message: 'Acesso não autorizado para atualizar este perfil.' });
        }

        const updates = req.body;
        // Se uma nova imagem de avatar foi enviada, adicione sua URL aos updates
        if (req.file && req.file.location) {
            updates.avatarUrl = req.file.location; // CORRIGIDO: de 'avatar' para 'avatarUrl'
        }

        // Se a senha for atualizada, faça o hash
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
        if (error.code === 11000) { // Erro de email duplicado
            return res.status(409).json({ success: false, message: 'Este e-mail já está em uso por outro usuário.' });
        }
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao atualizar perfil.' });
    }
});


// Rota para adicionar imagens ao portfólio de serviços (apenas trabalhadores)
app.post('/api/user/:id/servicos-imagens', authenticateToken, upload.array('servicoImagens', 5), async (req, res) => {
    try {
        const userId = req.params.id;
        // Apenas o próprio usuário pode adicionar imagens ao seu portfólio
        if (req.user.userId !== userId || req.user.tipo !== 'trabalhador') { // CORRIGIDO: de 'req.user.id' para 'req.user.userId'
            return res.status(403).json({ success: false, message: 'Acesso não autorizado ou tipo de usuário incorreto.' });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'Nenhuma imagem enviada.' });
        }

        const newImageUrls = req.files.map(file => file.location);

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

        if (req.user.userId !== userId || req.user.tipo !== 'trabalhador') { // CORRIGIDO: de 'req.user.id' para 'req.user.userId'
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

        // Opcional: Deletar a imagem do S3
        const s3Key = new URL(imageUrlToRemove).pathname.substring(1); // Extrai a chave do S3 da URL
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
                // Pode optar por não retornar erro fatal aqui, se a remoção do DB for mais importante
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


// Rota para atualizar perfil do usuário (protegida)
app.put('/api/user/:id', authenticateToken, avatarUpload.single('avatar'), async (req, res) => {
    try {
        const userId = req.params.id;
        if (req.user.userId !== userId) {
            return res.status(403).json({ success: false, message: 'Acesso não autorizado para atualizar este perfil.' });
        }

        const updates = req.body;

        if (req.file && req.file.buffer) { // Verifica se uma nova imagem de avatar foi enviada
            // Redimensionar a imagem do avatar
            const resizedAvatarBuffer = await sharp(req.file.buffer)
                .resize(100, 100, {
                    fit: sharp.fit.cover,
                    withoutEnlargement: true
                })
                .toBuffer();

            // Enviar a imagem redimensionada para o S3
            const uploadParams = {
                Bucket: bucketName,
                Key: `avatars/${Date.now()}-${req.file.originalname}`,
                Body: resizedAvatarBuffer,
                ContentType: req.file.mimetype,
                ACL: 'public-read'
            };
            await s3.send(new PutObjectCommand(uploadParams));
            updates.avatar = `https://${bucketName}.s3.${region}.amazonaws.com/${uploadParams.Key}`;
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


// --- Rotas de Publicações (Posts) ---

// Rota para Criar uma Publicação (protegida)
app.post('/api/posts', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        const { content } = req.body;
        const userId = req.user.userId;
        const imageUrl = req.file ? req.file.location : null; // URL da imagem do S3

        if (!content) {
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
        const posts = await Post.find().sort({ createdAt: -1 }).populate('userId', 'nome avatarUrl tipo'); // CORRIGIDO: de 'avatar' para 'avatarUrl'
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

        // Verifique se o usuário logado é o proprietário da publicação
        if (post.userId.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'Você não tem permissão para excluir esta publicação.' });
        }

        // Se houver uma imagem, tente deletá-la do S3
        if (post.imageUrl) {
            const key = new URL(post.imageUrl).pathname.substring(1); // Extrai a chave do S3 da URL

            const deleteParams = {
                Bucket: bucketName,
                Key: key,
            };

            try {
                await s3.send(new DeleteObjectCommand(deleteParams));
                console.log(`Imagem ${key} deletada do S3 com sucesso.`);
            } catch (s3DeleteError) {
                console.error(`Erro ao deletar imagem ${key} do S3:`, s3DeleteError);
                // Pode optar por não retornar erro fatal aqui, se o post for mais importante
            }
        }

        // Deletar a publicação do banco de dados
        await Post.deleteOne({ _id: postId });

        res.status(200).json({ success: true, message: 'Publicação excluída com sucesso.' });

    } catch (error) {
        console.error('Erro ao excluir publicação:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao excluir publicação.' });
    }
});


// --- Iniciar o Servidor ---
app.listen(port, () => {
    console.log(`Servidor de backend rodando em http://localhost:${port}`);
    console.log(`Frontend deve fazer requisições POST para http://localhost:${port}/api/register`);
    console.log(`Frontend deve fazer requisições POST para http://localhost:${port}/api/login`);
    console.log(`Frontend pode criar publicações em POST http://localhost:${port}/api/posts (protegida)`);
    console.log(`Frontend pode obter publicações em GET http://localhost:${port}/api/posts (protegida)`);
    console.log(`Frontend pode deletar publicações em DELETE http://localhost:${port}/api/posts/:id (protegida)`);
    console.log(`Frontend pode obter dados do usuário em GET http://localhost:${port}/api/user/:id (protegida)`);
    console.log(`Frontend pode atualizar dados do usuário em PUT http://localhost:${port}/api/user/:id (protegida)`);
    console.log(`Frontend pode adicionar imagens de serviço em POST http://localhost:${port}/api/user/:id/servicos-imagens (protegida)`);
    console.log(`Frontend pode remover imagens de serviço em DELETE http://localhost:${port}/api/user/:userId/servicos-imagens/:imageIndex (protegida)`);
    console.log(`Frontend pode avaliar trabalhadores em POST http://localhost:${port}/api/user/:id/avaliar (protegida)`);
});