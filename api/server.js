// api/server.js
const path = require('path'); 
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
        if (!process.env.MONGODB_URI) { console.error("ERRO CRÍTICO: MONGODB_URI não encontrado no .env."); throw new Error('Falha na conexão com o Banco de Dados.'); }
        try {
            await mongoose.connect(process.env.MONGODB_URI);
            console.log('Conectado ao MongoDB Atlas com sucesso!');
            isDbConnected = true;
        } catch (err) { console.error('ERRO CRÍTICO ao conectar ao MongoDB Atlas:', err); throw new Error('Falha na conexão com o Banco de Dados.'); }
    }
    if (!s3Client) {
        if (!process.env.AWS_REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.S3_BUCKET_NAME) {
             console.warn("AVISO: Variáveis de ambiente AWS S3 incompletas. Uploads não funcionarão.");
        } else {
            s3Client = new S3Client({
                region: process.env.AWS_REGION,
                credentials: {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                },
            });
            bucketName = process.env.S3_BUCKET_NAME; 
            console.log("Cliente S3 inicializado com sucesso.");
        }
    }
}
// ----------------------------------------------------------------------
// DEFINIÇÃO DOS SCHEMAS
// ----------------------------------------------------------------------
const avaliacaoSchema = new mongoose.Schema({ usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, estrelas: { type: Number, required: true, min: 1, max: 5 }, comentario: { type: String, trim: true } }, { timestamps: true });

// 🆕 ATUALIZADO: Schema de Serviço/Portfólio com validação por pares
const validacaoParSchema = new mongoose.Schema({
    profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dataValidacao: { type: Date, default: Date.now },
    comentario: { type: String, trim: true }
}, { timestamps: true });

const servicoSchema = new mongoose.Schema({ 
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, 
    title: { type: String, required: true }, 
    description: { type: String },
    desafio: { type: String }, // Descrição do desafio enfrentado
    tecnologias: [{ type: String }], // Tecnologias/habilidades usadas
    images: [{ type: String }],
    videoUrl: { type: String }, // Vídeo explicando o processo (Selo Humano)
    validacoesPares: [validacaoParSchema], // Validações de outros profissionais
    totalValidacoes: { type: Number, default: 0 },
    isDesafioHelpy: { type: Boolean, default: false }, // Se é um projeto de desafio
    tagDesafio: { type: String }, // Tag do desafio (ex: #DesafioHelpy)
    avaliacoes: [avaliacaoSchema], 
    mediaAvaliacao: { type: Number, default: 0 }
}, { timestamps: true });
const replySchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, content: { type: String, required: true }, likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], createdAt: { type: Date, default: Date.now } });
const commentSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, content: { type: String, required: true }, likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], replies: [replySchema], createdAt: { type: Date, default: Date.now } });
const postagemSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, content: { type: String, trim: true }, mediaUrl: { type: String }, mediaType: { type: String, enum: ['image', 'video'] }, likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], comments: [commentSchema], createdAt: { type: Date, default: Date.now }, });

// 🆕 NOVO: Schema de Time de Projeto
const timeProjetoSchema = new mongoose.Schema({
    clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    titulo: { type: String, required: true },
    descricao: { type: String, required: true },
    localizacao: {
        bairro: { type: String, required: true },
        cidade: { type: String, required: true },
        estado: { type: String, required: true },
        latitude: { type: Number },
        longitude: { type: Number }
    },
    profissionaisNecessarios: [{
        tipo: { type: String, required: true }, // ex: "pedreiro", "eletricista", "pintor"
        quantidade: { type: Number, default: 1 }
    }],
    candidatos: [{
        profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        tipo: { type: String }, // tipo de profissional que está se candidatando
        status: { type: String, enum: ['pendente', 'aceito', 'rejeitado'], default: 'pendente' },
        dataCandidatura: { type: Date, default: Date.now }
    }],
    status: { type: String, enum: ['aberto', 'em_andamento', 'concluido', 'cancelado'], default: 'aberto' },
    dataInicio: { type: Date },
    dataConclusao: { type: Date }
}, { timestamps: true });

// 🆕 NOVO: Schema de Agendamento
const agendamentoSchema = new mongoose.Schema({
    profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dataHora: { type: Date, required: true },
    servico: { type: String, required: true },
    observacoes: { type: String },
    status: { type: String, enum: ['pendente', 'confirmado', 'cancelado', 'concluido'], default: 'pendente' },
    endereco: {
        rua: { type: String },
        bairro: { type: String },
        cidade: { type: String },
        estado: { type: String }
    }
}, { timestamps: true });

// 🆕 NOVO: Schema de Horários Disponíveis
const horarioDisponivelSchema = new mongoose.Schema({
    profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    diaSemana: { type: Number, required: true, min: 0, max: 6 }, // 0 = Domingo, 6 = Sábado
    horaInicio: { type: String, required: true }, // Formato "HH:MM"
    horaFim: { type: String, required: true },
    disponivel: { type: Boolean, default: true }
}, { timestamps: true });

// 🆕 NOVO: Schema de Equipe Verificada
const equipeVerificadaSchema = new mongoose.Schema({
    liderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    nome: { type: String, required: true },
    descricao: { type: String },
    membros: [{
        profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        funcao: { type: String, required: true },
        status: { type: String, enum: ['pendente', 'aceito', 'recusado'], default: 'pendente' },
        dataConvite: { type: Date, default: Date.now }
    }],
    xpTotal: { type: Number, default: 0 }, // Soma do XP de todos os membros
    nivelEquipe: { type: Number, default: 1 },
    projetosCompletos: { type: Number, default: 0 },
    isVerificada: { type: Boolean, default: false }
}, { timestamps: true });

const TimeProjeto = mongoose.model('TimeProjeto', timeProjetoSchema);
const Agendamento = mongoose.model('Agendamento', agendamentoSchema);
const HorarioDisponivel = mongoose.model('HorarioDisponivel', horarioDisponivelSchema);
const EquipeVerificada = mongoose.model('EquipeVerificada', equipeVerificadaSchema);

// 🆕 NOVO: Schema de Pagamento Seguro (Escrow)
const pagamentoSeguroSchema = new mongoose.Schema({
    agendamentoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agendamento', required: true },
    clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    valor: { type: Number, required: true },
    taxaPlataforma: { type: Number, default: 0.05 }, // 5%
    status: { 
        type: String, 
        enum: ['pendente', 'pago', 'liberado', 'reembolsado', 'cancelado'], 
        default: 'pendente' 
    },
    dataPagamento: { type: Date },
    dataLiberacao: { type: Date },
    metodoPagamento: { type: String },
    transacaoId: { type: String }
}, { timestamps: true });

// 🆕 NOVO: Schema de Oportunidade (Mural)
const oportunidadeSchema = new mongoose.Schema({
    clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    titulo: { type: String, required: true },
    descricao: { type: String, required: true },
    categoria: { type: String, required: true }, // ex: "design", "programacao", "construcao"
    orcamento: { type: Number, required: true },
    prazo: { type: Date, required: true },
    localizacao: {
        cidade: { type: String },
        estado: { type: String }
    },
    propostas: [{
        profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        valor: { type: Number, required: true },
        prazo: { type: Date, required: true },
        descricao: { type: String },
        status: { type: String, enum: ['pendente', 'aceita', 'rejeitada'], default: 'pendente' },
        dataProposta: { type: Date, default: Date.now }
    }],
    status: { 
        type: String, 
        enum: ['aberta', 'em_negociacao', 'fechada', 'cancelada'], 
        default: 'aberta' 
    },
    propostaSelecionada: { type: mongoose.Schema.Types.ObjectId, ref: 'oportunidadeSchema.propostas' }
}, { timestamps: true });

const PagamentoSeguro = mongoose.model('PagamentoSeguro', pagamentoSeguroSchema);
const Oportunidade = mongoose.model('Oportunidade', oportunidadeSchema);

// 🛑 ATUALIZADO: Schema de Usuário
const userSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    idade: { type: Number },
    cidade: { type: String }, 
    estado: { type: String }, 
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
    avaliacoes: [avaliacaoSchema],
    // 🛑 NOVO: Campo Tema
    tema: { type: String, enum: ['light', 'dark'], default: 'light' },
    // 🆕 NOVO: Localização (coordenadas)
    localizacao: {
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null },
        ultimaAtualizacao: { type: Date, default: null }
    },
    // 🆕 NOVO: Gamificação
    gamificacao: {
        nivel: { type: Number, default: 1, min: 1, max: 50 },
        xp: { type: Number, default: 0 },
        xpProximoNivel: { type: Number, default: 100 },
        desafiosCompletos: [{ type: String }],
        portfolioValidado: { type: Boolean, default: false },
        temSeloQualidade: { type: Boolean, default: false }, // Nível 10+
        temSeloHumano: { type: Boolean, default: false }, // Selo de trabalho 100% humano
        nivelReputacao: { type: String, enum: ['iniciante', 'validado', 'mestre'], default: 'iniciante' }
    },
    // 🆕 NOVO: Status de disponibilidade (para "Preciso agora!")
    disponivelAgora: { type: Boolean, default: false }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Postagem = mongoose.model('Postagem', postagemSchema);
const Servico = mongoose.model('Servico', servicoSchema);
//----------------------------------------------------------------------

// MIDDLEWARES (App.use, Auth, Multer)
// ----------------------------------------------------------------------
app.use(express.static(path.join(__dirname, '../public')));
app.use(async (req, res, next) => { try { await initializeServices(); next(); } catch (error) { console.error("Falha na inicialização dos serviços:", error); res.status(500).send("Erro interno do servidor. Não foi possível inicializar os serviços."); } });
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const authMiddleware = (req, res, next) => { const authHeader = req.headers.authorization; if (!authHeader || !authHeader.startsWith('Bearer ')) { return res.status(401).json({ message: 'Token não fornecido ou inválido.' }); } const token = authHeader.split(' ')[1]; if (!process.env.JWT_SECRET) { console.error("JWT_SECRET não definido!"); return res.status(500).json({ message: "Erro de configuração do servidor." }); } try { const decoded = jwt.verify(token, process.env.JWT_SECRET); req.user = decoded; next(); } catch (error) { return res.status(401).json({ message: 'Token inválido.' }); } };
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']; if (allowedTypes.includes(file.mimetype)) { cb(null, true); } else { cb(new Error('Tipo de arquivo não suportado.'), false); } } });
// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
// ROTAS DE API
// ----------------------------------------------------------------------

// Rota de Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        if (!email || !senha) {
            return res.status(400).json({ success: false, message: 'Email e senha são obrigatórios.' });
        }
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        const isMatch = await bcrypt.compare(senha, user.senha);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Senha incorreta.' });
        }
        if (!process.env.JWT_SECRET) {
            console.error("JWT_SECRET não definido!");
            return res.status(500).json({ success: false, message: "Erro de configuração do servidor." });
        }
        const token = jwt.sign({ id: user._id, email: user.email, tipo: user.tipo }, process.env.JWT_SECRET, { expiresIn: '1d' });
        
        // 🛑 ATUALIZADO: Envia o tema salvo
        res.json({
            success: true,
            message: 'Login bem-sucedido!',
            token,
            userId: user._id,
            userType: user.tipo,
            userName: user.nome,
            userPhotoUrl: user.avatarUrl || user.foto,
            userTheme: user.tema || 'light' // <-- ENVIA O TEMA
        });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Rota de Cadastro
app.post('/api/cadastro', upload.single('fotoPerfil'), async (req, res) => {
    try {
        // 🛑 ATUALIZADO: Recebe 'tema'
        const { nome, idade, cidade, estado, tipo, atuacao, telefone, descricao, email, senha, tema } = req.body;
        const avatarFile = req.file;

        if (!nome || !email || !senha || !tipo) {
            return res.status(400).json({ message: 'Campos obrigatórios (Nome, Email, Senha, Tipo) não preenchidos.' });
        }
        
        // --- Lógica de Upload S3 ---
        let fotoUrl = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
        if (avatarFile && s3Client) {
            try {
                const imageBuffer = await sharp(avatarFile.buffer).resize(400, 400, { fit: 'cover' }).toFormat('jpeg').toBuffer();
                const key = `avatars/${Date.now()}_${path.basename(avatarFile.originalname || 'avatar')}`;
                const uploadCommand = new PutObjectCommand({ Bucket: bucketName, Key: key, Body: imageBuffer, ContentType: 'image/jpeg' });
                await s3Client.send(uploadCommand);
                fotoUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
            } catch (s3Error) {
                console.warn("Falha no upload da foto de perfil para o S3:", s3Error);
            }
        }
        // --- Fim da Lógica S3 ---

        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(senha, salt);

        // 🛑 ATUALIZADO: Salva o 'tema'
        const newUser = new User({
            nome,
            idade,
            cidade,
            estado, 
            tipo,
            atuacao: tipo === 'trabalhador' ? atuacao : null,
            telefone,
            descricao,
            email,
            senha: senhaHash,
            foto: fotoUrl,
            avatarUrl: fotoUrl,
            tema: tema || 'light' // <-- SALVA O TEMA
        });
        await newUser.save();
        
        if (!process.env.JWT_SECRET) {
            console.error("JWT_SECRET não definido!");
            return res.status(500).json({ message: "Erro de configuração do servidor." });
        }
        
        const token = jwt.sign({ id: newUser._id, email: newUser.email, tipo: newUser.tipo }, process.env.JWT_SECRET, { expiresIn: '1d' });
        
        // 🛑 ATUALIZADO: Envia o tema salvo
        res.status(201).json({ 
            success: true, 
            message: 'Usuário cadastrado com sucesso!', 
            token, 
            userId: newUser._id,
            userType: newUser.tipo,
            userName: newUser.nome,
            userPhotoUrl: newUser.foto,
            userTheme: newUser.tema // <-- ENVIA O TEMA
        });
    } catch (error) {
        console.error('Erro ao cadastrar usuário:', error);
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Este email já está cadastrado.' });
        }
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// Rota para salvar o Tema
app.put('/api/user/theme', authMiddleware, async (req, res) => {
    try {
        const { tema } = req.body;
        const userId = req.user.id;

        if (!tema || (tema !== 'light' && tema !== 'dark')) {
            return res.status(400).json({ success: false, message: 'Tema inválido.' });
        }

        // Atualiza o tema e retorna o usuário atualizado
        const updatedUser = await User.findByIdAndUpdate(
            userId, 
            { tema: tema },
            { new: true, select: '-senha' } // Retorna o usuário atualizado sem a senha
        );
        
        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        
        res.json({ 
            success: true, 
            message: 'Tema atualizado com sucesso.',
            tema: updatedUser.tema
        });
    } catch (error) {
        console.error('Erro ao salvar tema:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Rota de Editar Perfil
app.put('/api/editar-perfil/:id', authMiddleware, upload.single('avatar'), async (req, res) => {
    try {
        const { id } = req.params;
        // 🛑 ATUALIZAÇÃO: Recebe 'cidade' e 'estado', remove 'endereco'
        const { nome, idade, cidade, estado, telefone, atuacao, descricao } = req.body;
        const avatarFile = req.file;

        if (req.user.id !== id) {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        
        let fotoUrl = null;
        if (avatarFile && s3Client) {
            const imageBuffer = await sharp(avatarFile.buffer).resize(400, 400, { fit: 'cover' }).toFormat('jpeg').toBuffer();
            const key = `avatars/${Date.now()}_${path.basename(avatarFile.originalname || 'avatar')}`;
            const uploadCommand = new PutObjectCommand({ Bucket: bucketName, Key: key, Body: imageBuffer, ContentType: 'image/jpeg' });
            await s3Client.send(uploadCommand);
            fotoUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
        }
        
        // 🛑 ATUALIZAÇÃO: Objeto de updates
        const updates = { nome, idade, cidade, estado, telefone, atuacao, descricao };
        if (fotoUrl) {
            updates.foto = fotoUrl;
            updates.avatarUrl = fotoUrl;
        }
        
        // Remove campos indefinidos para não sobrescrever com 'null'
        Object.keys(updates).forEach(key => updates[key] === undefined && delete updates[key]);
        
        const updatedUser = await User.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true }).select('-senha');
        
        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        
        res.json({ success: true, message: 'Perfil atualizado com sucesso!', user: updatedUser.toObject() });
    } catch (error) {
        console.error('Erro ao editar perfil:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Rota de Buscar Usuário (Genérica) - 🆕 ATUALIZADO: Inclui gamificação
app.get('/api/usuario/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'ID de usuário inválido.' });
        }
        const user = await User.findById(id).select('-senha')
            .populate('servicosImagens')
            .populate({
                path: 'avaliacoes', 
                populate: { path: 'usuarioId', select: 'nome foto avatarUrl' } 
            })
            .exec();
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        // Garante que gamificacao existe mesmo se não foi inicializada
        if (!user.gamificacao) {
            user.gamificacao = {
                nivel: 1,
                xp: 0,
                xpProximoNivel: 100,
                desafiosCompletos: [],
                portfolioValidado: false
            };
        }
        res.json(user.toObject());
    } catch (error) {
        console.error('Erro ao buscar perfil:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// ----------------------------------------------------------------------
// ROTAS DE POSTAGEM E FEED
// ----------------------------------------------------------------------

// Criar Postagem
app.post('/api/posts', authMiddleware, upload.single('media'), async (req, res) => {
    try {
        const { content } = req.body;
        const mediaFile = req.file;
        const userId = req.user.id;

        if (!content && !mediaFile) {
            return res.status(400).json({ success: false, message: 'Postagem deve ter conteúdo ou mídia.' });
        }

        let mediaUrl = null;
        let mediaType = null;
        
        if (mediaFile && s3Client) {
            const key = `media/${Date.now()}_${path.basename(mediaFile.originalname || 'media')}`;
            const uploadCommand = new PutObjectCommand({ Bucket: bucketName, Key: key, Body: mediaFile.buffer, ContentType: mediaFile.mimetype });
            await s3Client.send(uploadCommand);
            mediaUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
            
            if (mediaFile.mimetype.startsWith('image')) {
                mediaType = 'image';
            } else if (mediaFile.mimetype.startsWith('video')) {
                mediaType = 'video';
            }
        }

        const newPost = new Postagem({
            userId,
            content,
            mediaUrl,
            mediaType,
            likes: [],
            comments: []
        });

        await newPost.save();
        res.status(201).json({ success: true, message: 'Postagem criada com sucesso!', post: newPost });
    } catch (error) {
        console.error('Erro ao criar postagem:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Deletar Postagem
app.delete('/api/posts/:postId', authMiddleware, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;
        const post = await Postagem.findById(postId);
        if (!post) {
            return res.status(404).json({ success: false, message: 'Postagem não encontrada.' });
        }
        if (post.userId.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        
        if (post.mediaUrl && s3Client) {
            try {
                const url = new URL(post.mediaUrl);
                const key = url.pathname.substring(1); 
                const deleteCommand = new DeleteObjectCommand({ Bucket: bucketName, Key: key });
                await s3Client.send(deleteCommand);
            } catch (s3Error) {
                console.warn("Falha ao deletar mídia do S3:", s3Error);
            }
        }
        
        await Postagem.findByIdAndDelete(postId);
        res.json({ success: true, message: 'Postagem deletada com sucesso.' });
    } catch (error) {
        console.error('Erro ao deletar postagem:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Buscar Postagens (Feed) - 🆕 ATUALIZADO: Filtro por cidade por padrão
app.get('/api/posts', authMiddleware, async (req, res) => {
    try {
        const { cidade } = req.query;
        const userId = req.user.id;
        
        // Busca a cidade do usuário logado se não foi especificada
        let cidadeFiltro = cidade;
        if (!cidadeFiltro) {
            const user = await User.findById(userId).select('cidade');
            if (user && user.cidade) {
                cidadeFiltro = user.cidade;
            }
        }
        
        let query = Postagem.find();
        
        // 🆕 ATUALIZADO: Busca de cidade com variações (sem acento, case-insensitive)
        if (cidadeFiltro) {
            // Remove acentos e converte para minúsculas para busca flexível
            const normalizeString = (str) => {
                return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            };
            const cidadeNormalizada = normalizeString(cidadeFiltro);
            
            // Busca todas as cidades e filtra no código (mais flexível)
            const todosUsuarios = await User.find({}).select('_id cidade');
            const usuariosCidade = todosUsuarios.filter(u => {
                if (!u.cidade) return false;
                return normalizeString(u.cidade).includes(cidadeNormalizada) || 
                       cidadeNormalizada.includes(normalizeString(u.cidade));
            });
            const idsUsuarios = usuariosCidade.map(u => u._id);
            query = query.where('userId').in(idsUsuarios);
        }
        
        const posts = await query
            .sort({ createdAt: -1 })
            .populate('userId', 'nome foto avatarUrl tipo cidade estado') 
            .populate({
                path: 'comments.userId',
                select: 'nome foto avatarUrl'
            })
            .populate({
                path: 'comments.replies.userId',
                select: 'nome foto avatarUrl'
            })
            .exec();
            
        res.json(posts);
    } catch (error) {
        console.error('Erro ao buscar postagens:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// Buscar Postagens de um Usuário
app.get('/api/user-posts/:userId', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        const posts = await Postagem.find({ userId: userId })
            .sort({ createdAt: -1 })
            .populate('userId', 'nome foto avatarUrl tipo cidade estado')
            .populate({
                path: 'comments.userId',
                select: 'nome foto avatarUrl'
            })
            .populate({
                path: 'comments.replies.userId',
                select: 'nome foto avatarUrl'
            })
            .exec();
        res.json(posts);
    } catch (error) {
        console.error('Erro ao buscar postagens do usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});


// Curtir/Descurtir Postagem
app.post('/api/posts/:postId/like', authMiddleware, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;
        const post = await Postagem.findById(postId);
        if (!post) {
            return res.status(404).json({ success: false, message: 'Postagem não encontrada.' });
        }
        const likeIndex = post.likes.indexOf(userId);
        if (likeIndex > -1) {
            post.likes.splice(likeIndex, 1); // Descurtir
        } else {
            post.likes.push(userId); // Curtir
        }
        await post.save();
        res.json({ success: true, likes: post.likes });
    } catch (error) {
        console.error('Erro ao curtir postagem:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Adicionar Comentário
app.post('/api/posts/:postId/comment', authMiddleware, async (req, res) => {
    try {
        const { postId } = req.params;
        const { content } = req.body;
        const userId = req.user.id;

        const newComment = {
            userId,
            content,
            likes: [],
            replies: [],
            createdAt: new Date()
        };

        const post = await Postagem.findByIdAndUpdate(
            postId,
            { $push: { comments: newComment } },
            { new: true }
        );
        
        if (!post) {
            return res.status(404).json({ success: false, message: 'Postagem não encontrada.' });
        }
        
        const addedComment = post.comments[post.comments.length - 1];
        await User.populate(addedComment, { path: 'userId', select: 'nome foto avatarUrl' });
        
        res.status(201).json({ success: true, comment: addedComment });
    } catch (error) {
        console.error('Erro ao adicionar comentário:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// ----------------------------------------------------------------------
// ROTAS DE INTERAÇÃO COM COMENTÁRIOS
// ----------------------------------------------------------------------

// Curtir/Descurtir Comentário
app.post('/api/posts/:postId/comments/:commentId/like', authMiddleware, async (req, res) => {
    try {
        const { postId, commentId } = req.params;
        const userId = req.user.id;

        const post = await Postagem.findById(postId);
        if (!post) return res.status(404).json({ message: 'Post não encontrado' });
        
        const comment = post.comments.id(commentId);
        if (!comment) return res.status(404).json({ message: 'Comentário não encontrado' });

        const likeIndex = comment.likes.indexOf(userId);
        if (likeIndex > -1) {
            comment.likes.splice(likeIndex, 1); // Descurtir
        } else {
            comment.likes.push(userId); // Curtir
        }
        
        await post.save();
        res.json({ success: true, likes: comment.likes });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Responder a um Comentário
app.post('/api/posts/:postId/comments/:commentId/reply', authMiddleware, async (req, res) => {
    try {
        const { postId, commentId } = req.params;
        const { content } = req.body;
        const userId = req.user.id;

        const post = await Postagem.findById(postId);
        if (!post) return res.status(404).json({ message: 'Post não encontrado' });

        const comment = post.comments.id(commentId);
        if (!comment) return res.status(404).json({ message: 'Comentário não encontrado' });

        const newReply = {
            userId,
            content,
            likes: [],
            createdAt: new Date()
        };

        comment.replies.push(newReply);
        await post.save();

        const addedReply = comment.replies[comment.replies.length - 1];
        await User.populate(addedReply, { path: 'userId', select: 'nome foto avatarUrl' });
        
        res.status(201).json({ success: true, reply: addedReply });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Deletar um Comentário (Dono do Post)
app.delete('/api/posts/:postId/comments/:commentId', authMiddleware, async (req, res) => {
    try {
        const { postId, commentId } = req.params;
        const userId = req.user.id;

        const post = await Postagem.findById(postId);
        if (!post) return res.status(404).json({ message: 'Post não encontrado' });

        // Verifica se é o dono do post
        if (post.userId.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'Ação não permitida.' });
        }

        const comment = post.comments.id(commentId);
        if (!comment) return res.status(404).json({ message: 'Comentário não encontrado' });

        comment.deleteOne(); // Remove o subdocumento
        await post.save();
        
        res.json({ success: true, message: 'Comentário deletado.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Curtir/Descurtir uma Resposta (Reply)
app.post('/api/posts/:postId/comments/:commentId/replies/:replyId/like', authMiddleware, async (req, res) => {
    try {
        const { postId, commentId, replyId } = req.params;
        const userId = req.user.id;

        const post = await Postagem.findById(postId);
        if (!post) return res.status(404).json({ message: 'Post não encontrado' });
        const comment = post.comments.id(commentId);
        if (!comment) return res.status(404).json({ message: 'Comentário não encontrado' });
        const reply = comment.replies.id(replyId);
        if (!reply) return res.status(404).json({ message: 'Resposta não encontrada' });

        const likeIndex = reply.likes.indexOf(userId);
        if (likeIndex > -1) {
            reply.likes.splice(likeIndex, 1); // Descurtir
        } else {
            reply.likes.push(userId); // Curtir
        }
        
        await post.save();
        res.json({ success: true, likes: reply.likes });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Deletar uma Resposta (Reply) (Dono do Post)
app.delete('/api/posts/:postId/comments/:commentId/replies/:replyId', authMiddleware, async (req, res) => {
    try {
        const { postId, commentId, replyId } = req.params;
        const userId = req.user.id;

        const post = await Postagem.findById(postId);
        if (!post) return res.status(404).json({ message: 'Post não encontrado' });

        if (post.userId.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'Ação não permitida.' });
        }

        const comment = post.comments.id(commentId);
        if (!comment) return res.status(404).json({ message: 'Comentário não encontrado' });
        
        const reply = comment.replies.id(replyId);
        if (!reply) return res.status(404).json({ message: 'Resposta não encontrada' });

        reply.deleteOne(); // Remove o subdocumento
        await post.save();
        
        res.json({ success: true, message: 'Resposta deletada.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});


// ----------------------------------------------------------------------
// ROTAS DE SERVIÇOS E AVALIAÇÃO
// ----------------------------------------------------------------------
app.get('/api/servicos/:userId', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        const servicos = await Servico.find({ userId: userId }).sort({ createdAt: -1 });
        res.json(servicos);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar serviços.' });
    }
});

// 🆕 ATUALIZADO: Criar Serviço/Projeto do Portfólio
app.post('/api/servico', authMiddleware, upload.array('images', 5), async (req, res) => {
    try {
        const { title, description, desafio, tecnologias, isDesafioHelpy, tagDesafio } = req.body;
        const files = req.files;
        const userId = req.user.id;
        
        // Verifica se é trabalhador
        const user = await User.findById(userId);
        if (!user || user.tipo !== 'trabalhador') {
            return res.status(403).json({ success: false, message: 'Apenas profissionais podem criar projetos no portfólio.' });
        }
        
        let imageUrls = [];
        if (files && files.length > 0 && s3Client) {
            await Promise.all(files.map(async (file) => {
                const imageBuffer = await sharp(file.buffer).resize(800, 600, { fit: 'cover' }).toFormat('jpeg').toBuffer();
                const key = `servicos/${userId}/${Date.now()}_${path.basename(file.originalname)}`;
                const uploadCommand = new PutObjectCommand({ Bucket: bucketName, Key: key, Body: imageBuffer, ContentType: 'image/jpeg' });
                await s3Client.send(uploadCommand);
                imageUrls.push(`https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`);
            }));
        }

        // Processa tecnologias (pode vir como string separada por vírgula ou array)
        let tecnologiasArray = [];
        if (tecnologias) {
            if (typeof tecnologias === 'string') {
                tecnologiasArray = tecnologias.split(',').map(t => t.trim()).filter(t => t);
            } else if (Array.isArray(tecnologias)) {
                tecnologiasArray = tecnologias;
            }
        }

        const newServico = new Servico({
            userId,
            title,
            description,
            desafio: desafio || null,
            tecnologias: tecnologiasArray,
            images: imageUrls,
            isDesafioHelpy: isDesafioHelpy === 'true' || isDesafioHelpy === true,
            tagDesafio: tagDesafio || null,
            validacoesPares: [],
            totalValidacoes: 0,
            avaliacoes: [],
            mediaAvaliacao: 0
        });
        
        const savedServico = await newServico.save();
        await User.findByIdAndUpdate(userId, { $push: { servicosImagens: savedServico._id } });
        
        // 🆕 Adiciona XP por postar projeto no portfólio
        await adicionarXP(userId, 10, 'Projeto postado no portfólio');
        
        res.status(201).json({ success: true, message: 'Projeto adicionado ao portfólio com sucesso!', servico: savedServico });
    } catch (error) {
        console.error('Erro ao criar serviço:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🆕 NOVO: Validar projeto por outro profissional (Validação por Pares)
app.post('/api/servico/:servicoId/validar', authMiddleware, async (req, res) => {
    try {
        const { servicoId } = req.params;
        const { comentario } = req.body;
        const profissionalId = req.user.id;
        
        // Verifica se é trabalhador
        const profissional = await User.findById(profissionalId);
        if (!profissional || profissional.tipo !== 'trabalhador') {
            return res.status(403).json({ success: false, message: 'Apenas profissionais podem validar projetos.' });
        }
        
        const servico = await Servico.findById(servicoId).populate('userId');
        if (!servico) {
            return res.status(404).json({ success: false, message: 'Projeto não encontrado.' });
        }
        
        // Verifica se não é o próprio projeto
        if (servico.userId._id.toString() === profissionalId) {
            return res.status(400).json({ success: false, message: 'Você não pode validar seu próprio projeto.' });
        }
        
        // Verifica se já validou
        const jaValidou = servico.validacoesPares.some(
            v => v.profissionalId.toString() === profissionalId
        );
        
        if (jaValidou) {
            return res.status(400).json({ success: false, message: 'Você já validou este projeto.' });
        }
        
        // Adiciona validação
        servico.validacoesPares.push({
            profissionalId,
            comentario: comentario || null,
            dataValidacao: new Date()
        });
        
        servico.totalValidacoes = servico.validacoesPares.length;
        await servico.save();
        
        // 🆕 Adiciona XP ao dono do projeto por validação por pares
        await adicionarXP(servico.userId._id, 150, 'Projeto validado por pares');
        
        res.json({ success: true, message: 'Projeto validado com sucesso!', totalValidacoes: servico.totalValidacoes });
    } catch (error) {
        console.error('Erro ao validar projeto:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.delete('/api/user/:userId/servicos/:servicoId', authMiddleware, async (req, res) => {
    try {
        const { userId, servicoId } = req.params;
        if (req.user.id !== userId) {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        
        const servico = await Servico.findById(servicoId);
        if (!servico) {
            return res.status(404).json({ success: false, message: 'Serviço não encontrado.' });
        }

        // Deletar imagens do S3
        if (servico.images && servico.images.length > 0 && s3Client) {
            await Promise.all(servico.images.map(async (imageUrl) => {
                try {
                    const url = new URL(imageUrl);
                    const key = url.pathname.substring(1);
                    const deleteCommand = new DeleteObjectCommand({ Bucket: bucketName, Key: key });
                    await s3Client.send(deleteCommand);
                } catch (s3Error) {
                    console.warn(`Falha ao deletar imagem ${imageUrl} do S3:`, s3Error);
                }
            }));
        }

        await Servico.findByIdAndDelete(servicoId);
        await User.findByIdAndUpdate(userId, { $pull: { servicosImagens: servicoId } });
        
        res.json({ success: true, message: 'Serviço removido com sucesso.' });
    } catch (error) {
        console.error('Erro ao remover serviço:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.get('/api/servico/:servicoId', authMiddleware, async (req, res) => {
    try {
        const { servicoId } = req.params;
        const servico = await Servico.findById(servicoId)
            .populate({
                path: 'avaliacoes.usuarioId',
                select: 'nome foto avatarUrl'
            })
            .populate({
                path: 'validacoesPares.profissionalId',
                select: 'nome foto avatarUrl atuacao gamificacao'
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

// Rotas de Filtro de Trabalhadores
app.get('/api/trabalhadores', authMiddleware, async (req, res) => {
    try {
        const trabalhadores = await User.find({ tipo: 'trabalhador' })
            .select('nome foto avatarUrl atuacao cidade estado mediaAvaliacao totalAvaliacoes localizacao disponivelAgora gamificacao')
            .sort({ mediaAvaliacao: -1, totalAvaliacoes: -1 });
        res.json(trabalhadores);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar trabalhadores.' });
    }
});

// 🆕 NOVO: Rota "Preciso agora!" - Busca profissionais próximos (ATUALIZADO com filtro de selo)
app.post('/api/preciso-agora', authMiddleware, async (req, res) => {
    try {
        const { latitude, longitude, tipoServico, raioKm = 10, apenasSeloQualidade = false } = req.body;
        const userId = req.user.id;
        
        if (!latitude || !longitude) {
            return res.status(400).json({ success: false, message: 'Localização é obrigatória.' });
        }
        
        // Função para calcular distância (Haversine) - GRATUITA, sem API
        function calcularDistancia(lat1, lon1, lat2, lon2) {
            const R = 6371; // Raio da Terra em km
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = 
                Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c; // Distância em km
        }
        
        // Busca profissionais disponíveis
        let query = { 
            tipo: 'trabalhador',
            disponivelAgora: true,
            'localizacao.latitude': { $exists: true, $ne: null },
            'localizacao.longitude': { $exists: true, $ne: null }
        };
        
        if (tipoServico) {
            query.atuacao = { $regex: tipoServico, $options: 'i' };
        }
        
        // 🆕 Filtro por Selo de Qualidade
        if (apenasSeloQualidade) {
            query['gamificacao.temSeloQualidade'] = true;
        }
        
        const profissionais = await User.find(query)
            .select('nome foto avatarUrl atuacao cidade estado telefone mediaAvaliacao totalAvaliacoes localizacao gamificacao')
            .exec();
        
        // Calcula distância e tempo estimado para cada profissional
        const profissionaisComDistancia = profissionais.map(prof => {
            const distancia = calcularDistancia(
                latitude, 
                longitude, 
                prof.localizacao.latitude, 
                prof.localizacao.longitude
            );
            
            // Estima tempo em minutos (assumindo velocidade média de 30 km/h em cidade)
            const tempoMinutos = Math.round((distancia / 30) * 60);
            
            return {
                ...prof.toObject(),
                distancia: Math.round(distancia * 10) / 10, // Arredonda para 1 casa decimal
                tempoEstimado: tempoMinutos
            };
        })
        .filter(prof => prof.distancia <= raioKm) // Filtra por raio
        .sort((a, b) => a.distancia - b.distancia) // Ordena por distância
        .slice(0, 20); // Limita a 20 resultados
        
        res.json({ success: true, profissionais: profissionaisComDistancia });
    } catch (error) {
        console.error('Erro ao buscar profissionais próximos:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🆕 NOVO: Atualizar localização do usuário
app.put('/api/user/localizacao', authMiddleware, async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        const userId = req.user.id;
        
        if (!latitude || !longitude) {
            return res.status(400).json({ success: false, message: 'Coordenadas são obrigatórias.' });
        }
        
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { 
                'localizacao.latitude': latitude,
                'localizacao.longitude': longitude,
                'localizacao.ultimaAtualizacao': new Date()
            },
            { new: true, select: '-senha' }
        );
        
        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        
        res.json({ success: true, localizacao: updatedUser.localizacao });
    } catch (error) {
        console.error('Erro ao atualizar localização:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🆕 NOVO: Atualizar status de disponibilidade
app.put('/api/user/disponibilidade', authMiddleware, async (req, res) => {
    try {
        const { disponivelAgora } = req.body;
        const userId = req.user.id;
        
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { disponivelAgora: disponivelAgora === true },
            { new: true, select: '-senha' }
        );
        
        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        
        res.json({ success: true, disponivelAgora: updatedUser.disponivelAgora });
    } catch (error) {
        console.error('Erro ao atualizar disponibilidade:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🆕 NOVO: Sistema de Gamificação - Adicionar XP (ATUALIZADO com níveis de reputação)
function adicionarXP(userId, quantidadeXP, motivo) {
    return User.findById(userId).then(async user => {
        if (!user) return null;
        
        const novoXP = (user.gamificacao?.xp || 0) + quantidadeXP;
        const nivelAtual = user.gamificacao?.nivel || 1;
        
        // Calcula XP necessário para próximo nível (fórmula: nível * 100)
        const xpProximoNivel = nivelAtual * 100;
        
        let novoNivel = nivelAtual;
        let xpRestante = novoXP;
        
        // Verifica se subiu de nível
        while (xpRestante >= xpProximoNivel && novoNivel < 50) {
            xpRestante -= xpProximoNivel;
            novoNivel++;
        }
        
        // 🆕 NOVO: Determina nível de reputação
        let nivelReputacao = 'iniciante';
        let temSeloQualidade = false;
        
        if (novoNivel >= 30) {
            nivelReputacao = 'mestre';
            temSeloQualidade = true;
        } else if (novoNivel >= 10) {
            nivelReputacao = 'validado';
            temSeloQualidade = true;
        }
        
        const atualizacao = {
            'gamificacao.xp': xpRestante,
            'gamificacao.nivel': novoNivel,
            'gamificacao.xpProximoNivel': novoNivel * 100,
            'gamificacao.nivelReputacao': nivelReputacao,
            'gamificacao.temSeloQualidade': temSeloQualidade
        };
        
        return User.findByIdAndUpdate(userId, { $set: atualizacao }, { new: true });
    });
}

// 🆕 NOVO: Rota para adicionar XP (pode ser chamada internamente)
app.post('/api/user/xp', authMiddleware, async (req, res) => {
    try {
        const { quantidade, motivo } = req.body;
        const userId = req.user.id;
        
        if (!quantidade || quantidade <= 0) {
            return res.status(400).json({ success: false, message: 'Quantidade de XP inválida.' });
        }
        
        const userAtualizado = await adicionarXP(userId, quantidade, motivo);
        
        if (!userAtualizado) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        
        res.json({ 
            success: true, 
            nivel: userAtualizado.gamificacao.nivel,
            xp: userAtualizado.gamificacao.xp,
            xpProximoNivel: userAtualizado.gamificacao.xpProximoNivel
        });
    } catch (error) {
        console.error('Erro ao adicionar XP:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🆕 NOVO: Atualizar avaliação para adicionar XP automaticamente
app.post('/api/avaliar-trabalhador', authMiddleware, async (req, res) => {
    try {
        const { trabalhadorId, estrelas, comentario } = req.body;
        const usuarioId = req.user.id;

        const trabalhador = await User.findById(trabalhadorId);
        if (!trabalhador || trabalhador.tipo !== 'trabalhador') {
            return res.status(404).json({ success: false, message: 'Trabalhador não encontrado.' });
        }

        // Adiciona a nova avaliação
        const novaAvaliacao = {
            usuarioId,
            estrelas,
            comentario,
            createdAt: new Date()
        };
        trabalhador.avaliacoes.push(novaAvaliacao);

        // Recalcula a média
        const totalEstrelas = trabalhador.avaliacoes.reduce((acc, avaliacao) => acc + avaliacao.estrelas, 0);
        trabalhador.mediaAvaliacao = totalEstrelas / trabalhador.avaliacoes.length;
        trabalhador.totalAvaliacoes = trabalhador.avaliacoes.length;
        
        await trabalhador.save();

        // 🆕 Adiciona XP se for 5 estrelas (valor atualizado)
        if (estrelas === 5) {
            await adicionarXP(trabalhadorId, 50, 'Avaliação 5 estrelas');
        }

        res.status(201).json({ success: true, message: 'Avaliação adicionada com sucesso!', mediaAvaliacao: trabalhador.mediaAvaliacao });
    } catch (error) {
        console.error('Erro ao avaliar trabalhador:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao avaliar.' });
    }
});

// 🆕 NOVO: Rotas de Times Locais
// Criar Time de Projeto - 🆕 ATUALIZADO: Permite profissionais também
app.post('/api/times-projeto', authMiddleware, async (req, res) => {
    try {
        const { titulo, descricao, localizacao, profissionaisNecessarios } = req.body;
        const criadorId = req.user.id;
        
        const criador = await User.findById(criadorId);
        if (!criador) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        
        const novoTime = new TimeProjeto({
            clienteId: criadorId, // Mantém compatibilidade, mas agora pode ser profissional também
            titulo,
            descricao,
            localizacao,
            profissionaisNecessarios
        });
        
        await novoTime.save();
        
        res.status(201).json({ success: true, message: 'Time de projeto criado com sucesso!', time: novoTime });
    } catch (error) {
        console.error('Erro ao criar time de projeto:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar Times de Projeto (por cidade) - 🆕 ATUALIZADO: Busca flexível
app.get('/api/times-projeto', authMiddleware, async (req, res) => {
    try {
        const { cidade, status = 'aberto' } = req.query;
        
        let query = { status };
        if (cidade) {
            // 🆕 Busca flexível (sem acento, case-insensitive)
            const normalizeString = (str) => {
                return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            };
            const cidadeNormalizada = normalizeString(cidade);
            
            // Busca todos os times e filtra
            const todosTimes = await TimeProjeto.find({ status }).exec();
            const timesFiltrados = todosTimes.filter(time => {
                if (!time.localizacao || !time.localizacao.cidade) return false;
                return normalizeString(time.localizacao.cidade).includes(cidadeNormalizada) ||
                       cidadeNormalizada.includes(normalizeString(time.localizacao.cidade));
            });
            
            await TimeProjeto.populate(timesFiltrados, [
                { path: 'clienteId', select: 'nome foto avatarUrl cidade estado' },
                { path: 'candidatos.profissionalId', select: 'nome foto avatarUrl atuacao' }
            ]);
            
            return res.json({ success: true, times: timesFiltrados });
        }
        
        const times = await TimeProjeto.find(query)
            .populate('clienteId', 'nome foto avatarUrl cidade estado')
            .populate('candidatos.profissionalId', 'nome foto avatarUrl atuacao cidade estado')
            .sort({ createdAt: -1 })
            .exec();
        
        res.json({ success: true, times });
    } catch (error) {
        console.error('Erro ao buscar times de projeto:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Candidatar-se a um Time de Projeto
app.post('/api/times-projeto/:timeId/candidatar', authMiddleware, async (req, res) => {
    try {
        const { timeId } = req.params;
        const { tipo } = req.body;
        const profissionalId = req.user.id;
        
        const profissional = await User.findById(profissionalId);
        if (!profissional || profissional.tipo !== 'trabalhador') {
            return res.status(403).json({ success: false, message: 'Apenas profissionais podem se candidatar.' });
        }
        
        const time = await TimeProjeto.findById(timeId);
        if (!time) {
            return res.status(404).json({ success: false, message: 'Time de projeto não encontrado.' });
        }
        
        if (time.status !== 'aberto') {
            return res.status(400).json({ success: false, message: 'Este projeto não está mais aceitando candidatos.' });
        }
        
        // Verifica se já se candidatou
        const jaCandidatou = time.candidatos.some(
            c => c.profissionalId.toString() === profissionalId && c.status === 'pendente'
        );
        
        if (jaCandidatou) {
            return res.status(400).json({ success: false, message: 'Você já se candidatou a este projeto.' });
        }
        
        time.candidatos.push({
            profissionalId,
            tipo: tipo || profissional.atuacao,
            status: 'pendente'
        });
        
        await time.save();
        
        res.json({ success: true, message: 'Candidatura enviada com sucesso!' });
    } catch (error) {
        console.error('Erro ao candidatar-se:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🆕 NOVO: Rotas de Agendador Helpy
// Definir horários disponíveis
app.post('/api/agenda/horarios', authMiddleware, async (req, res) => {
    try {
        const { horarios } = req.body; // Array de {diaSemana, horaInicio, horaFim}
        const profissionalId = req.user.id;
        
        const profissional = await User.findById(profissionalId);
        if (!profissional || profissional.tipo !== 'trabalhador') {
            return res.status(403).json({ success: false, message: 'Apenas profissionais podem definir horários.' });
        }
        
        // Remove horários antigos
        await HorarioDisponivel.deleteMany({ profissionalId });
        
        // Adiciona novos horários
        const novosHorarios = horarios.map(h => ({
            profissionalId,
            diaSemana: h.diaSemana,
            horaInicio: h.horaInicio,
            horaFim: h.horaFim,
            disponivel: true
        }));
        
        await HorarioDisponivel.insertMany(novosHorarios);
        
        res.json({ success: true, message: 'Horários atualizados com sucesso!' });
    } catch (error) {
        console.error('Erro ao definir horários:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Buscar horários disponíveis de um profissional
app.get('/api/agenda/:profissionalId/horarios', authMiddleware, async (req, res) => {
    try {
        const { profissionalId } = req.params;
        const horarios = await HorarioDisponivel.find({ profissionalId, disponivel: true }).exec();
        res.json({ success: true, horarios });
    } catch (error) {
        console.error('Erro ao buscar horários:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Criar agendamento
app.post('/api/agenda/agendamento', authMiddleware, async (req, res) => {
    try {
        const { profissionalId, dataHora, servico, observacoes, endereco } = req.body;
        const clienteId = req.user.id;
        
        const novoAgendamento = new Agendamento({
            profissionalId,
            clienteId,
            dataHora: new Date(dataHora),
            servico,
            observacoes,
            endereco,
            status: 'pendente'
        });
        
        await novoAgendamento.save();
        
        res.status(201).json({ success: true, message: 'Agendamento criado com sucesso!', agendamento: novoAgendamento });
    } catch (error) {
        console.error('Erro ao criar agendamento:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar agendamentos do profissional
app.get('/api/agenda/profissional', authMiddleware, async (req, res) => {
    try {
        const profissionalId = req.user.id;
        const agendamentos = await Agendamento.find({ profissionalId })
            .populate('clienteId', 'nome foto avatarUrl telefone')
            .sort({ dataHora: 1 })
            .exec();
        
        res.json({ success: true, agendamentos });
    } catch (error) {
        console.error('Erro ao buscar agendamentos:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar agendamentos do cliente
app.get('/api/agenda/cliente', authMiddleware, async (req, res) => {
    try {
        const clienteId = req.user.id;
        const agendamentos = await Agendamento.find({ clienteId })
            .populate('profissionalId', 'nome foto avatarUrl telefone atuacao')
            .sort({ dataHora: 1 })
            .exec();
        
        res.json({ success: true, agendamentos });
    } catch (error) {
        console.error('Erro ao buscar agendamentos:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Atualizar status do agendamento
app.put('/api/agenda/:agendamentoId/status', authMiddleware, async (req, res) => {
    try {
        const { agendamentoId } = req.params;
        const { status } = req.body;
        const userId = req.user.id;
        
        const agendamento = await Agendamento.findById(agendamentoId);
        if (!agendamento) {
            return res.status(404).json({ success: false, message: 'Agendamento não encontrado.' });
        }
        
        // Verifica se é o profissional ou cliente
        if (agendamento.profissionalId.toString() !== userId && agendamento.clienteId.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        
        agendamento.status = status;
        await agendamento.save();
        
        res.json({ success: true, message: 'Status atualizado com sucesso!', agendamento });
    } catch (error) {
        console.error('Erro ao atualizar agendamento:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🆕 NOVO: Rotas de Equipes Verificadas
// Criar Equipe Verificada
app.post('/api/equipes', authMiddleware, async (req, res) => {
    try {
        const { nome, descricao } = req.body;
        const liderId = req.user.id;
        
        const lider = await User.findById(liderId);
        if (!lider || lider.tipo !== 'trabalhador') {
            return res.status(403).json({ success: false, message: 'Apenas profissionais podem criar equipes.' });
        }
        
        const novaEquipe = new EquipeVerificada({
            liderId,
            nome,
            descricao,
            membros: [{
                profissionalId: liderId,
                funcao: lider.atuacao || 'Líder',
                status: 'aceito'
            }],
            xpTotal: lider.gamificacao?.xp || 0,
            nivelEquipe: 1
        });
        
        await novaEquipe.save();
        
        res.status(201).json({ success: true, message: 'Equipe criada com sucesso!', equipe: novaEquipe });
    } catch (error) {
        console.error('Erro ao criar equipe:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Convidar membro para equipe
app.post('/api/equipes/:equipeId/convidar', authMiddleware, async (req, res) => {
    try {
        const { equipeId } = req.params;
        const { profissionalId, funcao } = req.body;
        const liderId = req.user.id;
        
        const equipe = await EquipeVerificada.findById(equipeId);
        if (!equipe) {
            return res.status(404).json({ success: false, message: 'Equipe não encontrada.' });
        }
        
        if (equipe.liderId.toString() !== liderId) {
            return res.status(403).json({ success: false, message: 'Apenas o líder pode convidar membros.' });
        }
        
        // Verifica se já é membro
        const jaMembro = equipe.membros.some(
            m => m.profissionalId.toString() === profissionalId
        );
        
        if (jaMembro) {
            return res.status(400).json({ success: false, message: 'Este profissional já é membro da equipe.' });
        }
        
        equipe.membros.push({
            profissionalId,
            funcao: funcao || 'Membro',
            status: 'pendente'
        });
        
        await equipe.save();
        
        res.json({ success: true, message: 'Convite enviado com sucesso!' });
    } catch (error) {
        console.error('Erro ao convidar membro:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Aceitar/Recusar convite
app.put('/api/equipes/:equipeId/convite/:membroId', authMiddleware, async (req, res) => {
    try {
        const { equipeId, membroId } = req.params;
        const { acao } = req.body; // 'aceitar' ou 'recusar'
        const profissionalId = req.user.id;
        
        const equipe = await EquipeVerificada.findById(equipeId);
        if (!equipe) {
            return res.status(404).json({ success: false, message: 'Equipe não encontrada.' });
        }
        
        const membro = equipe.membros.id(membroId);
        if (!membro || membro.profissionalId.toString() !== profissionalId) {
            return res.status(403).json({ success: false, message: 'Convite não encontrado.' });
        }
        
        if (acao === 'aceitar') {
            membro.status = 'aceito';
            // Atualiza XP total da equipe
            const membrosAceitos = equipe.membros.filter(m => m.status === 'aceito');
            const membrosIds = membrosAceitos.map(m => m.profissionalId);
            const membros = await User.find({ _id: { $in: membrosIds } });
            equipe.xpTotal = membros.reduce((sum, m) => sum + (m.gamificacao?.xp || 0), 0);
        } else {
            membro.status = 'recusado';
        }
        
        await equipe.save();
        
        res.json({ success: true, message: `Convite ${acao === 'aceitar' ? 'aceito' : 'recusado'} com sucesso!` });
    } catch (error) {
        console.error('Erro ao processar convite:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar equipes
app.get('/api/equipes', authMiddleware, async (req, res) => {
    try {
        const { cidade } = req.query;
        
        let query = {};
        if (cidade) {
            // Busca equipes com membros da cidade
            const usuariosCidade = await User.find({ cidade }).select('_id');
            const idsUsuarios = usuariosCidade.map(u => u._id);
            query = { 'membros.profissionalId': { $in: idsUsuarios } };
        }
        
        const equipes = await EquipeVerificada.find(query)
            .populate('liderId', 'nome foto avatarUrl atuacao cidade estado gamificacao')
            .populate('membros.profissionalId', 'nome foto avatarUrl atuacao gamificacao')
            .sort({ xpTotal: -1, nivelEquipe: -1 })
            .exec();
        
        res.json({ success: true, equipes });
    } catch (error) {
        console.error('Erro ao buscar equipes:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});


// 🆕 NOVO: Rotas de Pagamento Seguro Helpy
// Criar pagamento seguro (quando cliente confirma agendamento)
app.post('/api/pagamento-seguro', authMiddleware, async (req, res) => {
    try {
        const { agendamentoId, valor, metodoPagamento } = req.body;
        const clienteId = req.user.id;
        
        const agendamento = await Agendamento.findById(agendamentoId);
        if (!agendamento || agendamento.clienteId.toString() !== clienteId) {
            return res.status(403).json({ success: false, message: 'Agendamento não encontrado ou acesso negado.' });
        }
        
        const taxaPlataforma = valor * 0.05; // 5%
        const valorFinal = valor + taxaPlataforma;
        
        const pagamento = new PagamentoSeguro({
            agendamentoId,
            clienteId,
            profissionalId: agendamento.profissionalId,
            valor,
            taxaPlataforma,
            metodoPagamento,
            status: 'pago' // Em produção, seria 'pendente' até confirmação do gateway
        });
        
        await pagamento.save();
        
        res.status(201).json({ success: true, message: 'Pagamento seguro criado!', pagamento });
    } catch (error) {
        console.error('Erro ao criar pagamento seguro:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Liberar pagamento (quando cliente marca como concluído)
app.post('/api/pagamento-seguro/:pagamentoId/liberar', authMiddleware, async (req, res) => {
    try {
        const { pagamentoId } = req.params;
        const userId = req.user.id;
        
        const pagamento = await PagamentoSeguro.findById(pagamentoId);
        if (!pagamento) {
            return res.status(404).json({ success: false, message: 'Pagamento não encontrado.' });
        }
        
        // Só cliente pode liberar
        if (pagamento.clienteId.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        
        if (pagamento.status !== 'pago') {
            return res.status(400).json({ success: false, message: 'Pagamento não está pago.' });
        }
        
        pagamento.status = 'liberado';
        pagamento.dataLiberacao = new Date();
        await pagamento.save();
        
        // Atualiza agendamento
        const agendamento = await Agendamento.findById(pagamento.agendamentoId);
        if (agendamento) {
            agendamento.status = 'concluido';
            await agendamento.save();
        }
        
        res.json({ success: true, message: 'Pagamento liberado com sucesso!', pagamento });
    } catch (error) {
        console.error('Erro ao liberar pagamento:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar pagamentos do profissional
app.get('/api/pagamento-seguro/profissional', authMiddleware, async (req, res) => {
    try {
        const profissionalId = req.user.id;
        const pagamentos = await PagamentoSeguro.find({ profissionalId })
            .populate('clienteId', 'nome foto avatarUrl')
            .populate('agendamentoId')
            .sort({ createdAt: -1 })
            .exec();
        
        res.json({ success: true, pagamentos });
    } catch (error) {
        console.error('Erro ao buscar pagamentos:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar pagamentos do cliente
app.get('/api/pagamento-seguro/cliente', authMiddleware, async (req, res) => {
    try {
        const clienteId = req.user.id;
        const pagamentos = await PagamentoSeguro.find({ clienteId })
            .populate('profissionalId', 'nome foto avatarUrl atuacao')
            .populate('agendamentoId')
            .sort({ createdAt: -1 })
            .exec();
        
        res.json({ success: true, pagamentos });
    } catch (error) {
        console.error('Erro ao buscar pagamentos:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🆕 NOVO: Rotas de Mural de Oportunidades
// Criar oportunidade
app.post('/api/oportunidades', authMiddleware, async (req, res) => {
    try {
        const { titulo, descricao, categoria, orcamento, prazo, localizacao } = req.body;
        const clienteId = req.user.id;
        
        const oportunidade = new Oportunidade({
            clienteId,
            titulo,
            descricao,
            categoria,
            orcamento,
            prazo: new Date(prazo),
            localizacao,
            status: 'aberta'
        });
        
        await oportunidade.save();
        
        res.status(201).json({ success: true, message: 'Oportunidade criada com sucesso!', oportunidade });
    } catch (error) {
        console.error('Erro ao criar oportunidade:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar oportunidades (filtro por categoria e cidade)
app.get('/api/oportunidades', authMiddleware, async (req, res) => {
    try {
        const { categoria, cidade, status = 'aberta' } = req.query;
        
        let query = { status };
        if (categoria) {
            query.categoria = { $regex: categoria, $options: 'i' };
        }
        if (cidade) {
            const normalizeString = (str) => {
                return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            };
            const cidadeNormalizada = normalizeString(cidade);
            const todasOportunidades = await Oportunidade.find(query).exec();
            const oportunidadesFiltradas = todasOportunidades.filter(op => {
                if (!op.localizacao || !op.localizacao.cidade) return false;
                return normalizeString(op.localizacao.cidade).includes(cidadeNormalizada);
            });
            
            await Oportunidade.populate(oportunidadesFiltradas, [
                { path: 'clienteId', select: 'nome foto avatarUrl cidade estado' },
                { path: 'propostas.profissionalId', select: 'nome foto avatarUrl atuacao gamificacao' }
            ]);
            
            return res.json({ success: true, oportunidades: oportunidadesFiltradas });
        }
        
        const oportunidades = await Oportunidade.find(query)
            .populate('clienteId', 'nome foto avatarUrl cidade estado')
            .populate('propostas.profissionalId', 'nome foto avatarUrl atuacao gamificacao')
            .sort({ createdAt: -1 })
            .exec();
        
        res.json({ success: true, oportunidades });
    } catch (error) {
        console.error('Erro ao buscar oportunidades:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Enviar proposta para oportunidade
app.post('/api/oportunidades/:oportunidadeId/proposta', authMiddleware, async (req, res) => {
    try {
        const { oportunidadeId } = req.params;
        const { valor, prazo, descricao } = req.body;
        const profissionalId = req.user.id;
        
        const profissional = await User.findById(profissionalId);
        if (!profissional || profissional.tipo !== 'trabalhador') {
            return res.status(403).json({ success: false, message: 'Apenas profissionais podem enviar propostas.' });
        }
        
        const oportunidade = await Oportunidade.findById(oportunidadeId);
        if (!oportunidade || oportunidade.status !== 'aberta') {
            return res.status(400).json({ success: false, message: 'Oportunidade não está aberta.' });
        }
        
        // Verifica se já enviou proposta
        const jaPropos = oportunidade.propostas.some(
            p => p.profissionalId.toString() === profissionalId
        );
        if (jaPropos) {
            return res.status(400).json({ success: false, message: 'Você já enviou uma proposta para esta oportunidade.' });
        }
        
        oportunidade.propostas.push({
            profissionalId,
            valor,
            prazo: new Date(prazo),
            descricao,
            status: 'pendente'
        });
        
        await oportunidade.save();
        
        res.json({ success: true, message: 'Proposta enviada com sucesso!' });
    } catch (error) {
        console.error('Erro ao enviar proposta:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Aceitar proposta
app.post('/api/oportunidades/:oportunidadeId/aceitar/:propostaId', authMiddleware, async (req, res) => {
    try {
        const { oportunidadeId, propostaId } = req.params;
        const clienteId = req.user.id;
        
        const oportunidade = await Oportunidade.findById(oportunidadeId);
        if (!oportunidade || oportunidade.clienteId.toString() !== clienteId) {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        
        const proposta = oportunidade.propostas.id(propostaId);
        if (!proposta) {
            return res.status(404).json({ success: false, message: 'Proposta não encontrada.' });
        }
        
        // Rejeita outras propostas
        oportunidade.propostas.forEach(p => {
            if (p._id.toString() !== propostaId) {
                p.status = 'rejeitada';
            }
        });
        
        proposta.status = 'aceita';
        oportunidade.status = 'em_negociacao';
        oportunidade.propostaSelecionada = propostaId;
        
        await oportunidade.save();
        
        res.json({ success: true, message: 'Proposta aceita com sucesso!' });
    } catch (error) {
        console.error('Erro ao aceitar proposta:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🆕 NOVO: QG do Profissional - Dashboard
app.get('/api/qg-profissional', authMiddleware, async (req, res) => {
    try {
        const profissionalId = req.user.id;
        
        const profissional = await User.findById(profissionalId);
        if (!profissional || profissional.tipo !== 'trabalhador') {
            return res.status(403).json({ success: false, message: 'Apenas profissionais podem acessar o QG.' });
        }
        
        // Busca dados agregados
        const [agendamentos, pagamentosLiberados, pagamentosPagos, clientes, servicos] = await Promise.all([
            Agendamento.find({ profissionalId }).countDocuments(),
            PagamentoSeguro.find({ profissionalId, status: 'liberado' }),
            PagamentoSeguro.find({ profissionalId, status: 'pago' }),
            Agendamento.distinct('clienteId', { profissionalId }),
            Servico.find({ userId: profissionalId }).countDocuments()
        ]);
        
        const ganhosMes = pagamentosLiberados
            .filter(p => {
                const mesAtual = new Date().getMonth();
                const anoAtual = new Date().getFullYear();
                const dataLib = new Date(p.dataLiberacao);
                return dataLib.getMonth() === mesAtual && dataLib.getFullYear() === anoAtual;
            })
            .reduce((sum, p) => sum + (p.valor - p.taxaPlataforma), 0);
        
        const aReceber = pagamentosPagos
            .reduce((sum, p) => sum + (p.valor - p.taxaPlataforma), 0);
        
        res.json({
            success: true,
            dashboard: {
                totalAgendamentos: agendamentos,
                totalClientes: clientes.length,
                totalProjetos: servicos,
                ganhosMes,
                aReceber,
                nivel: profissional.gamificacao?.nivel || 1,
                xp: profissional.gamificacao?.xp || 0
            }
        });
    } catch (error) {
        console.error('Erro ao buscar QG:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar clientes do profissional (Mini-CRM)
app.get('/api/qg-profissional/clientes', authMiddleware, async (req, res) => {
    try {
        const profissionalId = req.user.id;
        
        const agendamentos = await Agendamento.find({ profissionalId })
            .populate('clienteId', 'nome foto avatarUrl telefone cidade estado')
            .exec();
        
        // Agrupa por cliente
        const clientesMap = new Map();
        agendamentos.forEach(ag => {
            const clienteId = ag.clienteId._id.toString();
            if (!clientesMap.has(clienteId)) {
                clientesMap.set(clienteId, {
                    cliente: ag.clienteId,
                    totalServicos: 0,
                    ultimoServico: null
                });
            }
            const clienteData = clientesMap.get(clienteId);
            clienteData.totalServicos++;
            if (!clienteData.ultimoServico || ag.dataHora > clienteData.ultimoServico) {
                clienteData.ultimoServico = ag.dataHora;
            }
        });
        
        const clientes = Array.from(clientesMap.values());
        
        res.json({ success: true, clientes });
    } catch (error) {
        console.error('Erro ao buscar clientes:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Exporta o app
module.exports = app;

// Execução local
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando localmente em http://localhost:${PORT}`);
    // Não inicializa aqui, o middleware cuida disso
  });
}