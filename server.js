const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { S3Client } = require('@aws-sdk/client-s3');
const multerS3 = require('multer-s3');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

// Configurações do AWS S3
const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});

const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.S3_BUCKET_NAME,
        key: function (req, file, cb) {
            cb(null, Date.now().toString() + '-' + file.originalname);
        },
    })
});

// Conexão com o MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Conectado ao MongoDB Atlas');
}).catch(err => {
    console.error('Erro ao conectar ao MongoDB Atlas', err);
});

// --- Schemas de Avaliação, Serviço e Usuário ---
const avaliacaoSchema = new mongoose.Schema({
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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

const userSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    senha: { type: String, required: true },
    tipo: { type: String, enum: ['trabalhador', 'cliente'], required: true },
    avatarUrl: { type: String, default: '' },
    idade: { type: Number },
    cidade: { type: String },
    atuacao: { type: String },
    descricao: { type: String },
    telefone: { type: String },
    servicosImagens: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Servico' }],
    avaliacoes: [avaliacaoSchema]
});

// --- Modelos de Dados ---
const User = mongoose.model('User', userSchema);
const Servico = mongoose.model('Servico', servicoSchema);

// Middleware
const app = express();
app.use(cors());
app.use(express.json());

// Função de verificação de token (middleware)
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- Rotas de Autenticação ---
app.post('/api/register', async (req, res) => {
    try {
        const { nome, email, senha, tipo } = req.body;
        const hashedPassword = await bcrypt.hash(senha, 10);
        const newUser = new User({ nome, email, senha: hashedPassword, tipo });
        await newUser.save();
        res.status(201).json({ message: 'Usuário registrado com sucesso!' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao registrar usuário.', error });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Credenciais inválidas.' });
        }
        const isMatch = await bcrypt.compare(senha, user.senha);
        if (!isMatch) {
            return res.status(400).json({ message: 'Credenciais inválidas.' });
        }
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: 'Login bem-sucedido!', token, userId: user._id, userType: user.tipo });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao processar o login.', error });
    }
});

// --- Rotas do Perfil do Usuário ---
app.get('/api/user/:userId', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId)
            .populate('servicosImagens')
            .exec();
        
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        res.json({ user });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar dados do perfil.' });
    }
});

app.put('/api/user/:id', verifyToken, upload.single('avatar'), async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        const updates = req.body;
        if (req.file) {
            updates.avatarUrl = req.file.location;
        }

        Object.assign(user, updates);
        await user.save();
        res.json({ message: 'Perfil atualizado com sucesso!', user });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao atualizar o perfil.', error });
    }
});

// --- Rotas de Serviços ---
app.post('/api/user/:id/servicos', verifyToken, upload.array('servicos', 10), async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        if (user.tipo !== 'trabalhador') {
            return res.status(403).json({ message: 'Apenas trabalhadores podem adicionar fotos de serviço.' });
        }

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

        if (!servico) {
            return res.status(404).json({ message: 'Serviço não encontrado.' });
        }

        res.status(200).json(servico);
    } catch (error) {
        console.error('Erro ao buscar serviço:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

app.delete('/api/user/:id/servicos/:servicoId', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        const { servicoId } = req.params;
        const servicoIndex = user.servicosImagens.findIndex(s => s.toString() === servicoId);

        if (servicoIndex === -1) {
            return res.status(404).json({ message: 'Serviço não encontrado no perfil do usuário.' });
        }
        
        user.servicosImagens.splice(servicoIndex, 1);
        await user.save();
        await Servico.findByIdAndDelete(servicoId);

        res.status(200).json({ message: 'Serviço removido com sucesso!' });
    } catch (error) {
        console.error('Erro ao remover serviço:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// --- Rota de Avaliação (ainda a ser implementada) ---
app.post('/api/user/:userId/avaliar', verifyToken, async (req, res) => {
    // ... Implementação futura para avaliação do perfil
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});