const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const dotenv = require('dotenv');
const sharp = require('sharp');
const { URL } = require('url');
const fs = require('fs');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const DB_URI = process.env.MONGODB_URI;
if (!DB_URI) {
    console.error('ERRO: Variável de ambiente MONGODB_URI não está definida!');
    process.exit(1);
}

mongoose.connect(DB_URI)
    .then(() => console.log('Conectado ao MongoDB Atlas com sucesso!'))
    .catch(err => console.error('Erro ao conectar ao MongoDB Atlas:', err));

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

const postagemSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    imageUrl: { type: String },
    createdAt: { type: Date, default: Date.now },
});

const userSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    idade: { type: Number },
    cidade: { type: String },
    tipo: { type: String, enum: ['cliente', 'trabalhador'], required: true },
    atuacao: { type: String, default: null },
    telefone: { type: String, default: null },
    descricao: { type: String, default: null },
    email: { type: String, required: true, unique: true },
    senha: { type: String, required: true },
    foto: { type: String, default: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png' },
    isVerified: { type: Boolean, default: false },
    mediaAvaliacao: { type: Number, default: 0 },
    totalAvaliacoes: { type: Number, default: 0 },
    avaliacoes: [avaliacaoSchema]
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Postagem = mongoose.model('Postagem', postagemSchema);
const Servico = mongoose.model('Servico', servicoSchema);
const Avaliacao = mongoose.model('Avaliacao', avaliacaoSchema);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', app);

// Rota de Login
app.post('/api/login', async (req, res) => {
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
        const token = jwt.sign({ id: user._id, email: user.email, tipo: user.tipo }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({ success: true, message: 'Login bem-sucedido!', token, user });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// Rota de Cadastro
app.post('/api/cadastro', async (req, res) => {
    try {
        const { nome, idade, cidade, tipo, atuacao, telefone, descricao, email, senha } = req.body;
        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(senha, salt);
        const newUser = new User({
            nome,
            idade,
            cidade,
            tipo,
            atuacao: tipo === 'trabalhador' ? atuacao : null,
            telefone,
            descricao,
            email,
            senha: senhaHash
        });
        await newUser.save();
        const token = jwt.sign({ id: newUser._id, email: newUser.email, tipo: newUser.tipo }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.status(201).json({ success: true, message: 'Usuário cadastrado com sucesso!', token, user: newUser });
    } catch (error) {
        console.error('Erro ao cadastrar usuário:', error);
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Email já cadastrado.' });
        }
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Nenhum token fornecido.' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token inválido.' });
    }
};

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});

const bucketName = process.env.AWS_BUCKET_NAME;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post('/api/posts', authMiddleware, upload.single('image'), async (req, res) => {
    try {
        const { content } = req.body;
        const userId = req.user.id;
        let imageUrl = null;
        if (req.file) {
            const imageBuffer = await sharp(req.file.buffer).resize(800, 600, { fit: sharp.fit.inside, withoutEnlargement: true }).toFormat('jpeg').toBuffer();
            const key = `posts/${Date.now()}_${req.file.originalname}`;
            const command = new PutObjectCommand({ Bucket: bucketName, Key: key, Body: imageBuffer, ContentType: 'image/jpeg' });
            await s3Client.send(command);
            imageUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
        }
        const newPost = new Postagem({ userId, content, imageUrl });
        await newPost.save();
        res.status(201).json({ success: true, message: 'Postagem criada com sucesso!', post: newPost });
    } catch (error) {
        console.error('Erro ao criar postagem:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao criar postagem.' });
    }
});

app.delete('/api/posts/:id', authMiddleware, async (req, res) => {
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
            const urlObj = new URL(postagem.imageUrl);
            const key = urlObj.pathname.substring(1);
            const command = new DeleteObjectCommand({ Bucket: bucketName, Key: key });
            await s3Client.send(command);
        }
        await postagem.deleteOne();
        res.json({ success: true, message: 'Postagem deletada com sucesso.' });
    } catch (error) {
        console.error('Erro ao deletar postagem:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao deletar postagem.' });
    }
});

app.get('/api/posts', async (req, res) => {
    try {
        const posts = await Postagem.find().sort({ createdAt: -1 }).populate('userId', 'nome foto');
        res.json(posts);
    } catch (error) {
        console.error('Erro ao buscar postagens:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

app.get('/api/usuario/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id).select('-senha');
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        res.json(user);
    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

app.get('/api/servicos/:userId', async (req, res) => {
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
    try {
        const { id } = req.params;
        const { nome, idade, cidade, telefone, atuacao, descricao } = req.body;
        const avatarFile = req.file;
        if (req.user.id !== id) {
            return res.status(403).json({ success: false, message: 'Acesso negado. Você só pode editar seu próprio perfil.' });
        }
        let fotoUrl = null;
        if (avatarFile) {
            const imageBuffer = await sharp(avatarFile.buffer).resize(400, 400, { fit: 'cover' }).toFormat('jpeg').toBuffer();
            const key = `avatars/${Date.now()}_${avatarFile.originalname}`;
            const uploadCommand = new PutObjectCommand({ Bucket: bucketName, Key: key, Body: imageBuffer, ContentType: 'image/jpeg' });
            await s3Client.send(uploadCommand);
            fotoUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
        }
        const updates = { nome, idade, cidade, telefone, atuacao, descricao };
        if (fotoUrl) {
            updates.foto = fotoUrl;
        }
        const updatedUser = await User.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).select('-senha');
        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        res.json({ success: true, message: 'Perfil atualizado com sucesso!', user: updatedUser });
    } catch (error) {
        console.error('Erro ao editar perfil:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao atualizar o perfil.' });
    }
});

app.get('/api/trabalhadores', async (req, res) => {
    try {
        const { search } = req.query;
        let query = { tipo: 'trabalhador' };
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query = { tipo: 'trabalhador', $or: [{ nome: searchRegex }, { atuacao: searchRegex }, { descricao: searchRegex }, { cidade: searchRegex }] };
        }
        const trabalhadores = await User.find(query).select('-senha');
        res.json(trabalhadores);
    } catch (error) {
        console.error('Erro ao buscar trabalhadores:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

app.get('/api/trabalhador/:id', async (req, res) => {
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
    try {
        const { title, description } = req.body;
        const userId = req.user.id;
        const imageFiles = req.files;
        if (req.user.tipo !== 'trabalhador') {
            return res.status(403).json({ success: false, message: 'Apenas trabalhadores podem criar serviços.' });
        }
        const imageUrls = [];
        if (imageFiles && imageFiles.length > 0) {
            for (const file of imageFiles) {
                const imageBuffer = await sharp(file.buffer).resize(800, 600, { fit: 'inside', withoutEnlargement: true }).toFormat('jpeg').toBuffer();
                const key = `servicos/${Date.now()}_${file.originalname}`;
                const command = new PutObjectCommand({ Bucket: bucketName, Key: key, Body: imageBuffer, ContentType: 'image/jpeg' });
                await s3Client.send(command);
                imageUrls.push(`https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`);
            }
        }
        const novoServico = new Servico({ userId, title, description, images: imageUrls });
        await novoServico.save();
        res.status(201).json({ success: true, message: 'Serviço criado com sucesso!', servico: novoServico });
    } catch (error) {
        console.error('Erro ao criar serviço:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao criar serviço.' });
    }
});

app.post('/api/avaliar-trabalhador', authMiddleware, async (req, res) => {
    try {
        const { trabalhadorId, estrelas, comentario } = req.body;
        const avaliadorId = req.user.id;
        if (req.user.tipo === 'trabalhador') {
            return res.status(403).json({ success: false, message: 'Trabalhadores não podem avaliar outros trabalhadores.' });
        }
        if (trabalhadorId === avaliadorId) {
            return res.status(400).json({ success: false, message: 'Você não pode avaliar a si mesmo.' });
        }
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

app.get('/api/servico/:servicoId', async (req, res) => {
    try {
        const { servicoId } = req.params;
        const servico = await Servico.findById(servicoId).populate('avaliacoes').exec();
        if (!servico) {
            return res.status(404).json({ message: 'Serviço não encontrado.' });
        }
        res.json(servico);
    } catch (error) {
        console.error('Erro ao buscar detalhes do serviço:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});
module.exports = app;