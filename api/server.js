// api/server.js
const path = require('path'); 
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { URL } = require('url');

// Função helper para carregar sharp apenas quando necessário (lazy loading)
// Cache para evitar múltiplas tentativas de carregamento
let sharpCache = null;
let sharpLoadAttempted = false;

function getSharp() {
    // Se já tentou carregar antes e falhou, retorna null imediatamente
    if (sharpLoadAttempted) {
        return sharpCache;
    }
    
    sharpLoadAttempted = true;
    
    try {
        // Tenta carregar o Sharp
        sharpCache = require('sharp');
        
        // Verifica se o Sharp está funcionando
        if (sharpCache && typeof sharpCache === 'function') {
            return sharpCache;
        }
        throw new Error('Sharp carregado mas não funcional');
    } catch (error) {
        // Não loga como erro crítico, apenas como aviso informativo
        // O sistema funciona normalmente sem Sharp usando o buffer original
        // Só loga detalhes em desenvolvimento para não poluir logs de produção
        console.warn('⚠️ Sharp não disponível - usando processamento básico de imagem');
        if (process.env.NODE_ENV === 'development') {
            console.warn('   Detalhes:', error.message);
        }
        sharpCache = null;
        return null;
    }
}

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
    thumbUrls: [{ type: String }], // Miniaturas otimizadas para o feed
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
        numero: { type: String },
        bairro: { type: String },
        pontoReferencia: { type: String },
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

// Em ambientes serverless (como Vercel), o arquivo pode ser carregado mais de uma vez.
// Usamos mongoose.models[...] para evitar OverwriteModelError ao recompilar os models.
const TimeProjeto = mongoose.models.TimeProjeto || mongoose.model('TimeProjeto', timeProjetoSchema);
const Agendamento = mongoose.models.Agendamento || mongoose.model('Agendamento', agendamentoSchema);
const HorarioDisponivel = mongoose.models.HorarioDisponivel || mongoose.model('HorarioDisponivel', horarioDisponivelSchema);
const EquipeVerificada = mongoose.models.EquipeVerificada || mongoose.model('EquipeVerificada', equipeVerificadaSchema);

// 🆕 NOVO: Schema de Pagamento Seguro (Escrow) - EXPANDIDO
const pagamentoSeguroSchema = new mongoose.Schema({
    // Referências flexíveis para diferentes tipos de serviços
    agendamentoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agendamento' },
    pedidoUrgenteId: { type: mongoose.Schema.Types.ObjectId, ref: 'PedidoUrgente' },
    vagaRelampagoId: { type: mongoose.Schema.Types.ObjectId, ref: 'VagaRelampago' },
    projetoTimeId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjetoTime' },
    
    // Tipo de serviço para identificar qual referência usar
    tipoServico: { 
        type: String, 
        enum: ['agendamento', 'pedido_urgente', 'vaga_relampago', 'projeto_time'], 
        required: true 
    },
    
    clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    valor: { type: Number, required: true },
    taxaPlataforma: { type: Number, default: 0.05 }, // 5% padrão, pode ser configurável
    valorLiquido: { type: Number }, // Valor que o profissional recebe (valor - taxa)
    status: { 
        type: String, 
        enum: ['pendente', 'pago', 'liberado', 'reembolsado', 'cancelado'], 
        default: 'pendente' 
    },
    dataPagamento: { type: Date },
    dataLiberacao: { type: Date },
    metodoPagamento: { type: String },
    transacaoId: { type: String },
    // Flag para identificar serviços com Garantia Helpy (para XP extra)
    temGarantiaHelpy: { type: Boolean, default: true }
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

const PagamentoSeguro = mongoose.models.PagamentoSeguro || mongoose.model('PagamentoSeguro', pagamentoSeguroSchema);
const Oportunidade = mongoose.models.Oportunidade || mongoose.model('Oportunidade', oportunidadeSchema);

// 🔔 NOVO: Schema de Notificações
const notificacaoSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tipo: { 
        type: String, 
        enum: [
            'pagamento_garantido',
            'pagamento_liberado',
            'pagamento_reembolsado',
            'proposta_aceita',
            'servico_concluido',
            'disputa_aberta',
            'disputa_resolvida',
            'avaliacao_recebida',
            'pedido_urgente',
            'proposta_pedido_urgente'
        ], 
        required: true 
    },
    titulo: { type: String, required: true },
    mensagem: { type: String, required: true },
    lida: { type: Boolean, default: false },
    dataLeitura: { type: Date },
    dadosAdicionais: { type: mongoose.Schema.Types.Mixed }, // Dados extras (IDs, valores, etc.)
    link: { type: String } // Link para ação relacionada
}, { timestamps: true });

// ⚖️ NOVO: Schema de Disputas
const disputaSchema = new mongoose.Schema({
    pagamentoId: { type: mongoose.Schema.Types.ObjectId, ref: 'PagamentoSeguro', required: true },
    criadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Cliente ou Profissional
    tipo: { 
        type: String, 
        enum: ['cliente_nao_liberou', 'profissional_nao_executou', 'servico_nao_conforme', 'outro'], 
        required: true 
    },
    motivo: { type: String, required: true },
    status: { 
        type: String, 
        enum: ['aberta', 'em_analise', 'resolvida_cliente', 'resolvida_profissional', 'cancelada'], 
        default: 'aberta' 
    },
    resolucao: { type: String }, // Decisão do admin
    resolvidoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Admin que resolveu
    dataResolucao: { type: Date },
    evidencias: [{ type: String }] // URLs de imagens/comprovantes
}, { timestamps: true });

// 📊 NOVO: Schema de Histórico de Transações (auditoria)
const historicoTransacaoSchema = new mongoose.Schema({
    pagamentoId: { type: mongoose.Schema.Types.ObjectId, ref: 'PagamentoSeguro', required: true },
    acao: { 
        type: String, 
        enum: ['criado', 'pago', 'liberado', 'reembolsado', 'disputa_aberta', 'disputa_resolvida', 'cancelado'],
        required: true 
    },
    realizadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dadosAntes: { type: mongoose.Schema.Types.Mixed },
    dadosDepois: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
    userAgent: { type: String }
}, { timestamps: true });

const Notificacao = mongoose.models.Notificacao || mongoose.model('Notificacao', notificacaoSchema);
const Disputa = mongoose.models.Disputa || mongoose.model('Disputa', disputaSchema);
const HistoricoTransacao = mongoose.models.HistoricoTransacao || mongoose.model('HistoricoTransacao', historicoTransacaoSchema);

// 🔔 Função auxiliar para criar notificações
async function criarNotificacao(userId, tipo, titulo, mensagem, dadosAdicionais = {}, link = null) {
    try {
        const notificacao = new Notificacao({
            userId,
            tipo,
            titulo,
            mensagem,
            dadosAdicionais,
            link
        });
        await notificacao.save();
        
        // TODO: Aqui você pode integrar com serviços de push notification
        // Exemplo: Firebase Cloud Messaging, OneSignal, etc.
        // await enviarPushNotification(userId, titulo, mensagem);
        
        return notificacao;
    } catch (error) {
        console.error('Erro ao criar notificação:', error);
        // Não falha a operação principal se a notificação falhar
        return null;
    }
}

// 📊 Função auxiliar para registrar histórico de transações
async function registrarHistoricoTransacao(pagamentoId, acao, realizadoPor, dadosAntes = {}, dadosDepois = {}, req = null) {
    try {
        const historico = new HistoricoTransacao({
            pagamentoId,
            acao,
            realizadoPor,
            dadosAntes,
            dadosDepois,
            ip: req?.ip || req?.connection?.remoteAddress || null,
            userAgent: req?.get('user-agent') || null
        });
        await historico.save();
        return historico;
    } catch (error) {
        console.error('Erro ao registrar histórico:', error);
        return null;
    }
}

// 🌟 NOVO: Schema de Avaliação Verificada (Sistema Híbrido de Confiança)
const avaliacaoVerificadaSchema = new mongoose.Schema({
    profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    agendamentoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agendamento' }, // Opcional para pedidos urgentes
    pedidoUrgenteId: { type: mongoose.Schema.Types.ObjectId, ref: 'PedidoUrgente' }, // Para pedidos urgentes sem agendamento
    estrelas: { type: Number, required: true, min: 1, max: 5 },
    comentario: { type: String, trim: true },
    servico: { type: String }, // Nome do serviço prestado
    isVerificada: { type: Boolean, default: true }, // Sempre true para avaliações verificadas
    dataServico: { type: Date, required: true } // Data em que o serviço foi realizado
}, { timestamps: true });

// 🏢 NOVO: Schema de Time Local (Micro-Agência)
const timeLocalSchema = new mongoose.Schema({
    liderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    nome: { type: String, required: true },
    descricao: { type: String },
    categoria: { type: String, required: true }, // ex: "construcao", "pintura", "jardinagem"
    membros: [{
        profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        funcao: { type: String, required: true }, // ex: "Pintor", "Ajudante", "Eletricista"
        status: { type: String, enum: ['pendente', 'aceito', 'recusado'], default: 'pendente' },
        dataConvite: { type: Date, default: Date.now }
    }],
    nivelMedio: { type: Number, default: 1 }, // Média dos níveis dos membros
    projetosCompletos: { type: Number, default: 0 },
    avaliacaoMedia: { type: Number, default: 0 },
    isAtivo: { type: Boolean, default: true }
}, { timestamps: true });

// 📋 NOVO: Schema de Projeto de Time / Mutirão Pago
const projetoTimeSchema = new mongoose.Schema({
    clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    titulo: { type: String, required: true },
    descricao: { type: String, required: true },
    categoria: { type: String, required: true },
    localizacao: {
        endereco: { type: String, required: true },
        bairro: { type: String },
        cidade: { type: String, required: true },
        estado: { type: String, required: true },
        latitude: { type: Number },
        longitude: { type: Number }
    },
    dataServico: { type: Date, required: true },
    horaInicio: { type: String, required: true }, // Formato "HH:MM"
    horaFim: { type: String, required: true },
    profissionaisNecessarios: [{
        tipo: { type: String, required: true }, // ex: "pintor", "ajudante"
        quantidade: { type: Number, default: 1 },
        valorPorPessoa: { type: Number, required: true }
    }],
    valorTotal: { type: Number, required: true },
    candidatos: [{
        timeLocalId: { type: mongoose.Schema.Types.ObjectId, ref: 'TimeLocal' },
        proposta: { type: String },
        status: { type: String, enum: ['pendente', 'aceita', 'rejeitada'], default: 'pendente' },
        dataCandidatura: { type: Date, default: Date.now }
    }],
    status: { 
        type: String, 
        enum: ['aberto', 'em_andamento', 'concluido', 'cancelado'], 
        default: 'aberto' 
    },
    timeSelecionado: { type: mongoose.Schema.Types.ObjectId, ref: 'TimeLocal' }
}, { timestamps: true });

// 🚨 NOVO: Schema de Pedido Urgente ("Preciso Agora!")
const pedidoUrgenteSchema = new mongoose.Schema({
    clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    servico: { type: String, required: true }, // Tipo de serviço necessário
    descricao: { type: String },
    foto: { type: String }, // URL da foto do serviço
    localizacao: {
        endereco: { type: String, required: true }, // Rua completa (pode incluir número/bairro)
        rua: { type: String },
        numero: { type: String },
        bairro: { type: String },
        pontoReferencia: { type: String },
        cidade: { type: String, required: true },
        estado: { type: String, required: true },
        latitude: { type: Number },
        longitude: { type: Number }
    },
    categoria: { type: String, required: true }, // Para filtrar profissionais
    tipoAtendimento: { type: String, enum: ['urgente', 'agendado'], default: 'urgente' }, // urgente (agora) ou agendado
    prazoHoras: { type: Number, default: 1 }, // Prazo escolhido (1, 2, 5, 9, 12, 24)
    dataAgendada: { type: Date }, // Quando o cliente agendou o serviço (opcional)
    propostas: [{
        profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        valor: { type: Number, required: true },
        tempoChegada: { type: String, required: true }, // ex: "30 min", "1 hora"
        observacoes: { type: String },
        status: { type: String, enum: ['pendente', 'aceita', 'rejeitada', 'cancelada'], default: 'pendente' },
        dataProposta: { type: Date, default: Date.now }
    }],
    propostaSelecionada: { type: mongoose.Schema.Types.ObjectId },
    agendamentoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agendamento' },
    status: { 
        type: String, 
        enum: ['aberto', 'em_andamento', 'concluido', 'cancelado'], 
        default: 'aberto' 
    },
    motivoCancelamento: { type: String },
    canceladoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dataExpiracao: { type: Date }, // Pedidos urgentes expiram rápido
    notificacoesEnviadas: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Profissionais notificados
    notificacoesCriadas: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Notificacao' }] // IDs das notificações geradas
}, { timestamps: true });

const AvaliacaoVerificada = mongoose.models.AvaliacaoVerificada || mongoose.model('AvaliacaoVerificada', avaliacaoVerificadaSchema);
const TimeLocal = mongoose.models.TimeLocal || mongoose.model('TimeLocal', timeLocalSchema);
const ProjetoTime = mongoose.models.ProjetoTime || mongoose.model('ProjetoTime', projetoTimeSchema);
const PedidoUrgente = mongoose.models.PedidoUrgente || mongoose.model('PedidoUrgente', pedidoUrgenteSchema);

// 🏢 NOVO: Schema de Vaga-Relâmpago (para empresas)
const vagaRelampagoSchema = new mongoose.Schema({
    empresaId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    titulo: { type: String, required: true }, // ex: "Preciso de 2 Garçons"
    descricao: { type: String, required: true },
    cargo: { type: String, required: true }, // ex: "Garçom", "Carregador", "Vendedor"
    quantidade: { type: Number, required: true, min: 1 },
    dataServico: { type: Date, required: true }, // Quando precisa
    horaInicio: { type: String, required: true }, // Formato "HH:MM"
    horaFim: { type: String, required: true },
    valorPorPessoa: { type: Number, required: true }, // Pagamento por pessoa
    formaPagamento: { type: String, enum: ['via_helpy', 'direto'], default: 'via_helpy' },
    localizacao: {
        endereco: { type: String, required: true },
        cidade: { type: String, required: true },
        estado: { type: String, required: true },
        latitude: { type: Number },
        longitude: { type: Number }
    },
    candidatos: [{
        profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        status: { type: String, enum: ['pendente', 'aceito', 'rejeitado'], default: 'pendente' },
        dataCandidatura: { type: Date, default: Date.now }
    }],
    profissionaisAceitos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    status: { 
        type: String, 
        enum: ['aberta', 'em_andamento', 'concluida', 'cancelada'], 
        default: 'aberta' 
    },
    dataExpiracao: { type: Date }, // Vagas expiram rápido
    notificacoesEnviadas: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] // Profissionais notificados
}, { timestamps: true });

const VagaRelampago = mongoose.models.VagaRelampago || mongoose.model('VagaRelampago', vagaRelampagoSchema);

// 🛑 ATUALIZADO: Schema de Usuário
const userSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    slugPerfil: { type: String, unique: true, sparse: true },
    idade: { type: Number },
    cidade: { type: String }, 
    estado: { type: String }, 
    tipo: { type: String, enum: ['cliente', 'trabalhador', 'empresa'], required: true },
    atuacao: { type: String, default: null },
    telefone: { type: String, default: null },
    descricao: { type: String, default: null },
    email: { 
        type: String, 
        required: true, 
        unique: true,
        validate: {
            validator: function(v) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: props => `${props.value} não é um e-mail válido!`
        }
    },
    emailVerificado: { type: Boolean, default: false },
    codigoVerificacao: { type: String },
    codigoExpiracao: { type: Date },
    senha: { type: String, required: true },
    foto: { type: String, default: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png' },
    avatarUrl: { type: String, default: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png' },
    servicosImagens: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Servico' }],
    isVerified: { type: Boolean, default: false },
    emailVerificado: { type: Boolean, default: false },
    codigoVerificacao: { type: String, default: null },
    codigoVerificacaoExpira: { type: Date, default: null },
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
        mediaAvaliacoesVerificadas: { type: Number, default: 0 },
        totalAvaliacoesVerificadas: { type: Number, default: 0 },
        temSeloQualidade: { type: Boolean, default: false }, // Nível 10+
        temSeloHumano: { type: Boolean, default: false }, // Selo de trabalho 100% humano
        nivelReputacao: { type: String, enum: ['iniciante', 'validado', 'mestre'], default: 'iniciante' }
    },
    // 🆕 NOVO: Status de disponibilidade (para "Preciso agora!")
    disponivelAgora: { type: Boolean, default: false },
    // 👑 NOVO: Flag de administrador
    isAdmin: { type: Boolean, default: false }
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Postagem = mongoose.models.Postagem || mongoose.model('Postagem', postagemSchema);
const Servico = mongoose.models.Servico || mongoose.model('Servico', servicoSchema);
//----------------------------------------------------------------------

// Helper para gerar slug único de perfil (baseado no nome)
async function gerarSlugPerfil(nome) {
    if (!nome) {
        // Fallback simples se não tiver nome
        const base = `user-${Date.now()}`;
        return base;
    }

    const baseSlug = nome
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '') || `user-${Date.now()}`;

    let slug = baseSlug;
    let contador = 0;

    // Garante unicidade
    while (await User.exists({ slugPerfil: slug })) {
        contador += 1;
        slug = `${baseSlug}-${contador}`;
    }

    return slug;
}

// MIDDLEWARES (App.use, Auth, Multer)
// ----------------------------------------------------------------------
// Configuração do CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Servir arquivos estáticos
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

// Rotas amigáveis para páginas principais (sem expor .html)
app.get('/', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(publicDir, 'login.html'));
});

app.get('/cadastro', (req, res) => {
    res.sendFile(path.join(publicDir, 'cadastro.html'));
});

// Perfil por query (?id=...) - redireciona para slug amigável quando possível
app.get('/perfil', async (req, res) => {
    try {
        const { id } = req.query;
        if (id) {
            const usuario = await User.findById(id).select('slugPerfil');
            if (usuario && usuario.slugPerfil) {
                return res.redirect(`/perfil/${usuario.slugPerfil}`);
            }
        }
        // Fallback: serve a página normalmente
        res.sendFile(path.join(publicDir, 'perfil.html'));
    } catch (error) {
        console.error('Erro ao redirecionar perfil por id para slug:', error);
        res.sendFile(path.join(publicDir, 'perfil.html'));
    }
});

// Perfil por slug amigável: /perfil/:slug
app.get('/perfil/:slug', (req, res) => {
    res.sendFile(path.join(publicDir, 'perfil.html'));
});

// API: Buscar usuário por slug de perfil
app.get('/api/usuarios/slug/:slug', authMiddleware, async (req, res) => {
    try {
        const { slug } = req.params;
        const usuario = await User.findOne({ slugPerfil: slug }).select('-senha -codigoVerificacao -codigoExpiracao');
        if (!usuario) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        res.json({ success: true, usuario });
    } catch (error) {
        console.error('Erro ao buscar usuário por slug:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Inicialização dos serviços
app.use(async (req, res, next) => { 
    try { 
        await initializeServices(); 
        next(); 
    } catch (error) { 
        console.error("Falha na inicialização dos serviços:", error);
        if (!res.headersSent) {
            res.status(500).json({ 
                success: false, 
                message: "Erro interno do servidor. Não foi possível inicializar os serviços.",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    } 
});

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware para garantir Content-Type JSON em todas as rotas da API
app.use('/api', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
});

// Segredo JWT com fallback seguro em desenvolvimento (evita erro 500 se variável não estiver definida)
const JWT_SECRET = process.env.JWT_SECRET || 'helpy-dev-secret-2024';

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Token não fornecido ou inválido.' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Erro ao verificar token JWT:', error.message);
        return res.status(401).json({ message: 'Token inválido.' });
    }
}
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']; if (allowedTypes.includes(file.mimetype)) { cb(null, true); } else { cb(new Error('Tipo de arquivo não suportado.'), false); } } });
// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
// FUNÇÕES DE VERIFICAÇÃO DE EMAIL
// ----------------------------------------------------------------------

// Função para criar transporter de email
function criarTransporterEmail() {
    try {
        // Verifica se tem configurações SMTP
        const hasSMTPConfig = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
        
        if (!hasSMTPConfig) {
            console.warn('═══════════════════════════════════════════════════════════');
            console.warn('AVISO: Configurações SMTP não encontradas.');
            console.warn('Para enviar emails, configure as seguintes variáveis na Vercel:');
            console.warn('- SMTP_HOST (ex: smtp.gmail.com)');
            console.warn('- SMTP_PORT (ex: 587)');
            console.warn('- SMTP_USER (seu email)');
            console.warn('- SMTP_PASS (sua senha ou senha de app)');
            console.warn('- SMTP_SECURE (true para porta 465, false para 587)');
            console.warn('- SMTP_FROM (ex: Helpy <noreply@helpy.com>)');
            console.warn('═══════════════════════════════════════════════════════════');
            return null;
        }
        
        // Cria transporter com as configurações
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            requireTLS: process.env.SMTP_SECURE !== 'true', // Requer TLS para porta 587
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            // Timeout aumentado para evitar erros
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 10000
        });
        
        console.log('✅ Transporter de email configurado com sucesso');
        return transporter;
    } catch (error) {
        console.error('❌ Erro ao criar transporter de email:', error);
        return null;
    }
}

// Função para gerar código de verificação
function gerarCodigoVerificacao() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // Código de 6 dígitos
}

// Função para enviar código de verificação por email
async function enviarCodigoVerificacao(email, codigo) {
    try {
        const transporter = criarTransporterEmail();
        
        // Se não houver transporter configurado, apenas loga o código
        if (!transporter) {
            console.log('═══════════════════════════════════════');
            console.log('CÓDIGO DE VERIFICAÇÃO (SMTP não configurado):', codigo);
            console.log('Email:', email);
            console.log('═══════════════════════════════════════');
            // Sempre retorna true quando não há SMTP - código já foi salvo no banco
            return true;
        }
        
        const mailOptions = {
            from: process.env.SMTP_FROM || 'Helpy <noreply@helpy.com>',
            to: email,
            subject: 'Código de Verificação - Helpy',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4CAF50;">Verificação de Email - Helpy</h2>
                    <p>Olá!</p>
                    <p>Seu código de verificação é:</p>
                    <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
                        <h1 style="color: #4CAF50; font-size: 36px; letter-spacing: 5px; margin: 0;">${codigo}</h1>
                    </div>
                    <p>Este código expira em 10 minutos.</p>
                    <p>Se você não solicitou este código, ignore este email.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px;">Equipe Helpy</p>
                </div>
            `,
            text: `Seu código de verificação é: ${codigo}. Este código expira em 10 minutos.`
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email de verificação enviado com sucesso!');
        console.log('   Message ID:', info.messageId);
        console.log('   Para:', email);
        return true;
    } catch (error) {
        console.error('❌ Erro ao enviar email de verificação:', error);
        console.error('   Detalhes:', error.message);
        
        // Se houver SMTP configurado, tenta novamente ou retorna false
        if (process.env.SMTP_HOST) {
            console.error('   SMTP configurado mas falhou. Verifique as credenciais.');
            // Em produção com SMTP configurado, retorna false para alertar
            if (process.env.NODE_ENV === 'production') {
                return false;
            }
            // Em desenvolvimento, ainda retorna true para não bloquear testes
            console.warn('   MODO DEV: Continuando mesmo com erro (código salvo no banco)');
            console.warn('   Código de verificação:', codigo);
            return true;
        }
        
        // Sem SMTP configurado, retorna true (código já foi salvo no banco)
        console.log('MODO DEV/SEM SMTP: Código de verificação:', codigo);
        return true;
    }
}

// ----------------------------------------------------------------------
// ROTAS DE API
// ----------------------------------------------------------------------

// 🆕 NOVO: Rota para solicitar código de verificação de email
app.post('/api/verificar-email/solicitar', async (req, res) => {
    try {
        // Garante que os serviços estão inicializados
        await initializeServices();
        
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email é obrigatório.' });
        }

        const emailNormalizado = email.toLowerCase().trim();

        // Verifica se o email já está verificado em outra conta
        const emailJaVerificado = await User.findOne({ 
            email: emailNormalizado,
            emailVerificado: true 
        });

        if (emailJaVerificado) {
            return res.status(409).json({ 
                success: false, 
                message: 'Este email já está vinculado a outra conta verificada. Por favor, use outro email ou faça login na conta existente.' 
            });
        }

        // Gera código de verificação
        const codigo = gerarCodigoVerificacao();
        const expiraEm = new Date();
        expiraEm.setMinutes(expiraEm.getMinutes() + 10); // Expira em 10 minutos

        // Verifica se já existe um usuário temporário com este email (não verificado)
        let usuarioTemp = await User.findOne({ 
            email: emailNormalizado,
            emailVerificado: false 
        });

        if (usuarioTemp) {
            // Atualiza código existente
            usuarioTemp.codigoVerificacao = codigo;
            usuarioTemp.codigoVerificacaoExpira = expiraEm;
            await usuarioTemp.save();
        } else {
            // Cria usuário temporário apenas para armazenar o código
            usuarioTemp = new User({
                email: emailNormalizado,
                senha: 'temp_' + Date.now(), // Senha temporária
                nome: 'TEMP',
                tipo: 'cliente',
                codigoVerificacao: codigo,
                codigoVerificacaoExpira: expiraEm,
                emailVerificado: false
            });
            await usuarioTemp.save();
        }

        // Envia código por email (não bloqueia se falhar - código já foi salvo no banco)
        try {
            const emailEnviado = await enviarCodigoVerificacao(emailNormalizado, codigo);
            // Se o email não foi enviado mas estamos em produção E temos SMTP configurado, retorna erro
            // Caso contrário, continua normalmente (código já está salvo no banco)
            if (!emailEnviado && process.env.NODE_ENV === 'production' && process.env.SMTP_HOST) {
                console.warn('Email não foi enviado em produção, mas código foi salvo no banco');
                // Não retorna erro, apenas avisa - o código já está salvo e pode ser usado
            }
        } catch (emailError) {
            console.error('Erro ao tentar enviar email:', emailError);
            // Não bloqueia o processo - o código já foi salvo no banco
            // Em produção com SMTP configurado, apenas loga o erro
            if (process.env.NODE_ENV === 'production' && process.env.SMTP_HOST) {
                console.error('Erro crítico ao enviar email em produção com SMTP configurado');
                // Mesmo assim, não retorna erro porque o código foi salvo
            } else {
                console.log('MODO DEV/SEM SMTP: Continuando mesmo com erro no envio de email');
            }
        }

        return res.json({ 
            success: true, 
            message: 'Código de verificação enviado para seu email!',
            email: emailNormalizado
        });
    } catch (error) {
        console.error('Erro ao solicitar verificação de email:', error);
        console.error('Stack trace:', error.stack);
        console.error('Error name:', error.name);
        console.error('Error code:', error.code);
        
        // Garante que sempre retorna JSON
        if (!res.headersSent) {
            res.setHeader('Content-Type', 'application/json');
            
            if (error.code === 11000) {
                return res.status(409).json({ 
                    success: false, 
                    message: 'Este email já está cadastrado.' 
                });
            }
            
            // Se for erro de conexão com MongoDB
            if (error.message && error.message.includes('Falha na conexão')) {
                return res.status(500).json({ 
                    success: false, 
                    message: 'Erro ao conectar com o banco de dados. Tente novamente mais tarde.',
                    error: process.env.NODE_ENV === 'development' ? error.message : undefined
                });
            }
            
            return res.status(500).json({ 
                success: false, 
                message: 'Erro interno do servidor.',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
});

// 🆕 NOVO: Rota para validar código de verificação
app.post('/api/verificar-email/validar', async (req, res) => {
    try {
        const { email, codigo } = req.body;
        
        if (!email || !codigo) {
            return res.status(400).json({ success: false, message: 'Email e código são obrigatórios.' });
        }

        const emailNormalizado = email.toLowerCase().trim();

        // Verifica se o email já está verificado em outra conta (ANTES de validar o código)
        const emailJaVerificadoEmOutraConta = await User.findOne({ 
            email: emailNormalizado,
            emailVerificado: true
        });

        if (emailJaVerificadoEmOutraConta) {
            return res.status(409).json({ 
                success: false, 
                message: 'Este email já está vinculado a outra conta verificada. Por favor, use outro email ou faça login na conta existente.' 
            });
        }

        const usuario = await User.findOne({ 
            email: emailNormalizado 
        });

        if (!usuario) {
            return res.status(404).json({ success: false, message: 'Email não encontrado. Solicite um novo código.' });
        }

        // Verifica se o código está correto e não expirou
        if (usuario.codigoVerificacao !== codigo) {
            return res.status(400).json({ success: false, message: 'Código de verificação inválido.' });
        }

        if (usuario.codigoVerificacaoExpira && new Date() > usuario.codigoVerificacaoExpira) {
            return res.status(400).json({ success: false, message: 'Código de verificação expirado. Solicite um novo código.' });
        }

        // NÃO marca como verificado aqui - isso será feito no cadastro
        // Apenas valida o código e retorna sucesso
        res.json({ 
            success: true, 
            message: 'Código válido! Prosseguindo com o cadastro...',
            email: emailNormalizado
        });
    } catch (error) {
        console.error('Erro ao validar código:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// ----------------------------------------------------------------------
// 🔍 ROTA DE BUSCA GLOBAL (usuários, serviços, postagens)
// ----------------------------------------------------------------------
app.get('/api/busca', authMiddleware, async (req, res) => {
    try {
        const termoBruto = (req.query.q || '').toString().trim();

        if (!termoBruto) {
            return res.json({
                success: true,
                usuarios: [],
                servicos: [],
                posts: []
            });
        }

        // Escapa caracteres especiais para usar em RegExp
        const escaped = termoBruto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'i');

        const [usuarios, servicos, posts] = await Promise.all([
            User.find({
                $or: [
                    { nome: regex },
                    { atuacao: regex },
                    { cidade: regex },
                    { estado: regex },
                    { email: regex }
                ]
            })
            .select('nome cidade estado atuacao avatarUrl foto slugPerfil tipo')
            .limit(10),

            Servico.find({
                $or: [
                    { title: regex },
                    { description: regex },
                    { tecnologias: regex },
                    { desafio: regex }
                ]
            })
            .select('title description imagens ownerId')
            .limit(10),

            Postagem.find({
                $or: [
                    { content: regex }
                ]
            })
            .populate('userId', 'nome cidade estado tipo avatarUrl foto slugPerfil')
            .select('content mediaUrl mediaType createdAt userId')
            .limit(10)
        ]);

        res.json({
            success: true,
            usuarios,
            servicos,
            posts
        });
    } catch (error) {
        console.error('Erro na rota /api/busca:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao realizar busca.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Rota de Login
app.post('/api/login', async (req, res) => {
    console.log('Requisição de login recebida:', { email: req.body.email });
    
    try {
        const { email, senha } = req.body;
        
        if (!email || !senha) {
            console.log('Email ou senha não fornecidos');
            return res.status(400).json({ success: false, message: 'Email e senha são obrigatórios.' });
        }
        
        console.log('Buscando usuário no banco de dados...');
        const emailNormalizado = email.toLowerCase().trim();
        const user = await User.findOne({ email: emailNormalizado });
        
        if (!user) {
            console.log('Usuário não encontrado para o email:', email);
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        
        console.log('Usuário encontrado, verificando senha...');

        // Validação extra: garante que há uma senha hash válida antes de chamar o bcrypt
        if (!user.senha || typeof user.senha !== 'string' || !user.senha.startsWith('$2')) {
            console.warn('Usuário com senha inválida ou não-hash, bloqueando login para evitar erro 500:', email);
            return res.status(401).json({ 
                success: false, 
                message: 'Não foi possível fazer login com esta conta. Por favor, redefina sua senha ou finalize seu cadastro.' 
            });
        }

        // Verifica se a senha está correta
        const isMatch = await bcrypt.compare(senha, user.senha);
        
        if (!isMatch) {
            console.log('Senha incorreta para o usuário:', email);
            return res.status(401).json({ success: false, message: 'Senha incorreta.' });
        }
        
        console.log('Senha correta, verificando e-mail...');
        // Verifica se o e-mail foi verificado
        if (!user.emailVerificado) {
            console.log('E-mail não verificado para o usuário:', email);
            return res.status(403).json({ 
                success: false, 
                message: 'Por favor, verifique seu e-mail para fazer login. Verifique sua caixa de entrada ou spam.',
                needsVerification: true,
                email: user.email
            });
        }

        console.log('Gerando token JWT...');
        const token = jwt.sign(
            { 
                id: user._id, 
                email: user.email, 
                tipo: user.tipo 
            }, 
            JWT_SECRET, 
            { expiresIn: '1d' }
        );
        
        console.log('Token gerado com sucesso, enviando resposta...');
        const responseData = {
            success: true,
            message: 'Login bem-sucedido!',
            token,
            userId: user._id,
            userType: user.tipo,
            userName: user.nome,
            userPhotoUrl: user.avatarUrl || user.foto,
            userTheme: user.tema || 'light'
        };
        
        console.log('Dados da resposta:', JSON.stringify(responseData, null, 2));
        res.json(responseData);
    } catch (error) {
        console.error('Erro no login:', error);
        console.error('Stack trace:', error.stack);
        
        // Verifica se a resposta já foi enviada
        if (res.headersSent) {
            console.error('A resposta já foi enviada, não é possível enviar outra resposta.');
            return;
        }
        
        // Para evitar que a Vercel/servidor substitua nossa resposta JSON por HTML genérico,
        // sempre retornamos 200 aqui com success: false.
        res.json({ 
            success: false, 
            message: 'Erro interno do servidor ao fazer login. Tente novamente em alguns instantes.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Rota de Cadastro
// Rota para verificar e-mail
app.post('/api/verificar-email', async (req, res) => {
    try {
        const { email, codigo } = req.body;

        if (!email || !codigo) {
            return res.status(400).json({ 
                success: false, 
                message: 'E-mail e código são obrigatórios.' 
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'Usuário não encontrado.' 
            });
        }

        // Verifica se o e-mail já está verificado
        if (user.emailVerificado) {
            return res.json({ 
                success: true, 
                message: 'E-mail já verificado anteriormente.' 
            });
        }

        // Verifica se o código está correto e não expirou
        const agora = new Date();
        if (user.codigoVerificacao !== codigo || user.codigoExpiracao < agora) {
            return res.status(400).json({ 
                success: false, 
                message: 'Código inválido ou expirado. Por favor, solicite um novo código.' 
            });
        }

        // Atualiza o usuário como verificado
        user.emailVerificado = true;
        user.codigoVerificacao = undefined;
        user.codigoExpiracao = undefined;
        await user.save();

        // Gera token de autenticação
        const token = jwt.sign(
            { 
                id: user._id, 
                email: user.email, 
                tipo: user.tipo 
            }, 
            JWT_SECRET, 
            { expiresIn: '1d' }
        );

        res.json({
            success: true,
            message: 'E-mail verificado com sucesso!',
            token,
            userId: user._id,
            emailVerificado: true,
            userType: user.tipo,
            userName: user.nome,
            userPhotoUrl: user.avatarUrl,
            userTheme: user.tema || 'light'
        });
    } catch (error) {
        console.error('Erro ao verificar e-mail:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao verificar e-mail.' 
        });
    }
});

// Rota para reenviar código de verificação
app.post('/api/reenviar-codigo', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ 
                success: false, 
                message: 'E-mail é obrigatório.' 
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'Usuário não encontrado.' 
            });
        }

        // Gera novo código de verificação
        const novoCodigo = gerarCodigoVerificacao();
        const dataExpiracao = new Date();
        dataExpiracao.setHours(dataExpiracao.getHours() + 24); // Expira em 24 horas

        // Atualiza os dados do usuário
        user.codigoVerificacao = novoCodigo;
        user.codigoExpiracao = dataExpiracao;
        await user.save();

        // Envia o novo código por e-mail
        const emailEnviado = await enviarEmailVerificacao(email, novoCodigo);
        if (!emailEnviado) {
            return res.status(500).json({ 
                success: false, 
                message: 'Falha ao enviar e-mail de verificação.' 
            });
        }

        res.json({ 
            success: true, 
            message: 'Novo código de verificação enviado para seu e-mail.' 
        });
    } catch (error) {
        console.error('Erro ao reenviar código:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao processar sua solicitação.' 
        });
    }
});

app.post('/api/cadastro', upload.single('fotoPerfil'), async (req, res) => {
    try {
        const { nome, idade, cidade, estado, tipo, atuacao, telefone, descricao, email, senha, tema } = req.body;
        const avatarFile = req.file;

        if (!nome || !email || !senha || !tipo) {
            return res.status(400).json({ success: false, message: 'Campos obrigatórios (Nome, Email, Senha, Tipo) não preenchidos.' });
        }

        const emailNormalizado = email.toLowerCase().trim();

        // Verifica se já existe um usuário com este email
        let usuarioExistente = await User.findOne({ email: emailNormalizado });
        
        // Se existe um usuário verificado, retorna erro
        if (usuarioExistente && usuarioExistente.emailVerificado) {
            return res.status(400).json({ 
                success: false, 
                message: 'Este e-mail já está cadastrado. Por favor, use outro e-mail ou faça login.'
            });
        }

        // Se existe um usuário não verificado (temporário), vamos atualizá-lo
        const atualizarUsuario = usuarioExistente && !usuarioExistente.emailVerificado;

        // Se existe um usuário temporário, verifica se tem código de verificação válido
        if (atualizarUsuario && !usuarioExistente.codigoVerificacao) {
            return res.status(400).json({ 
                success: false, 
                message: 'Por favor, valide o código de verificação primeiro.'
            });
        }

        // --- Lógica de Upload S3 ou Local ---
        let fotoUrl = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
        if (avatarFile) {
            try {
                const sharp = getSharp();
                let imageBuffer;
                const mimeType = avatarFile.mimetype || '';
                
                if (sharp) {
                    // Processa a imagem com Sharp com máxima qualidade
                    // Usa tamanho 1000x1000 para melhor qualidade quando redimensionada pelo navegador
                    let pipeline = sharp(avatarFile.buffer)
                        .resize(1000, 1000, { 
                            fit: 'cover',
                            withoutEnlargement: true, // Não aumenta imagens menores
                            kernel: 'lanczos3' // Melhor algoritmo de redimensionamento
                        });

                    // Mantém PNG/WebP praticamente sem perda, e JPEG com qualidade muito alta
                    if (mimeType.includes('png')) {
                        imageBuffer = await pipeline
                            .png({
                                compressionLevel: 6,
                                adaptiveFiltering: true
                            })
                            .toBuffer();
                    } else if (mimeType.includes('webp')) {
                        imageBuffer = await pipeline
                            .webp({
                                quality: 98,
                                lossless: true
                            })
                            .toBuffer();
                    } else {
                        imageBuffer = await pipeline
                        .jpeg({ 
                            quality: 98, 
                            mozjpeg: true,
                            progressive: true,
                            optimizeScans: true,
                            trellisQuantisation: true,
                            overshootDeringing: true
                        })
                        .toBuffer();
                    }
                } else {
                    // Se Sharp não estiver disponível, usa o buffer original
                    imageBuffer = avatarFile.buffer;
                    console.warn('Sharp não disponível, usando imagem original sem redimensionamento');
                }

                if (s3Client) {
                    // Upload para S3
                    try {
                        const key = `avatars/${Date.now()}_${path.basename(avatarFile.originalname || 'avatar')}`;
                        const uploadCommand = new PutObjectCommand({ 
                            Bucket: bucketName, 
                            Key: key, 
                            Body: imageBuffer, 
                            ContentType: 'image/jpeg' 
                        });
                        await s3Client.send(uploadCommand);
                        fotoUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
                        console.log('✅ Foto enviada para S3:', fotoUrl);
                    } catch (s3Error) {
                        console.warn("Falha no upload da foto de perfil para o S3:", s3Error);
                        // Continua para o fallback local
                    }
                }
                
                // Fallback: Salvar localmente se S3 não estiver configurado ou falhou
                if (!s3Client || fotoUrl === 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png') {
                    const uploadsDir = path.join(__dirname, '../public/uploads/avatars');
                    
                    // Cria o diretório se não existir
                    if (!fs.existsSync(uploadsDir)) {
                        fs.mkdirSync(uploadsDir, { recursive: true });
                    }
                    
                    const fileName = `${Date.now()}_${path.basename(avatarFile.originalname || 'avatar.jpg')}`;
                    const filePath = path.join(uploadsDir, fileName);
                    
                    // Salva o arquivo
                    fs.writeFileSync(filePath, imageBuffer);
                    
                    // URL relativa para servir via express.static
                    fotoUrl = `/uploads/avatars/${fileName}`;
                    console.log('✅ Foto salva localmente:', fotoUrl);
                }
            } catch (uploadError) {
                console.error('Erro ao processar upload da foto:', uploadError);
                // Mantém a foto padrão em caso de erro
            }
        }
        // --- Fim da Lógica de Upload ---

        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(senha, salt);

        let usuarioFinal;

        if (atualizarUsuario) {
            // Atualiza o usuário temporário com os dados completos
            usuarioExistente.nome = nome;
            usuarioExistente.idade = idade;
            usuarioExistente.cidade = cidade;
            usuarioExistente.estado = estado;
            usuarioExistente.tipo = tipo;
            usuarioExistente.atuacao = tipo === 'trabalhador' ? atuacao : null;
            usuarioExistente.telefone = telefone;
            usuarioExistente.descricao = descricao;
            usuarioExistente.senha = senhaHash; // Atualiza com a senha hash correta
            usuarioExistente.foto = fotoUrl;
            usuarioExistente.avatarUrl = fotoUrl;
            usuarioExistente.tema = tema || 'light';
            // Marca email como verificado ao finalizar o cadastro
            usuarioExistente.emailVerificado = true;
            usuarioExistente.codigoVerificacao = null;
            usuarioExistente.codigoVerificacaoExpira = null;
            
            // Gera slug de perfil se ainda não existir
            if (!usuarioExistente.slugPerfil) {
                usuarioExistente.slugPerfil = await gerarSlugPerfil(nome);
            }
            
            await usuarioExistente.save();
            usuarioFinal = usuarioExistente;
        } else {
            // Cria novo usuário (caso não tenha passado pela verificação de email)
            const slugPerfil = await gerarSlugPerfil(nome);

            const newUser = new User({
                nome,
                idade,
                cidade,
                estado, 
                tipo,
                atuacao: tipo === 'trabalhador' ? atuacao : null,
                telefone,
                descricao,
                email: emailNormalizado,
                senha: senhaHash,
                foto: fotoUrl,
                avatarUrl: fotoUrl,
                slugPerfil,
                tema: tema || 'light',
                emailVerificado: true // Assumindo que já foi verificado antes de chegar aqui
            });

            await newUser.save();
            usuarioFinal = newUser;
        }

        // Gera token de autenticação
        const token = jwt.sign(
            { 
                id: usuarioFinal._id, 
                email: usuarioFinal.email, 
                tipo: usuarioFinal.tipo 
            }, 
            JWT_SECRET, 
            { expiresIn: '1d' }
        );
        
        // 🛑 ATUALIZADO: Envia o tema salvo
        res.status(201).json({ 
            success: true, 
            message: 'Cadastro realizado com sucesso!',
            token,
            userId: usuarioFinal._id,
            emailVerificado: usuarioFinal.emailVerificado,
            userType: usuarioFinal.tipo,
            userName: usuarioFinal.nome,
            userPhotoUrl: usuarioFinal.avatarUrl,
            userTheme: usuarioFinal.tema || 'light'
        });
    } catch (error) {
        console.error('Erro ao cadastrar usuário:', error);
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Este email já está cadastrado.' });
        }
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// 🆕 NOVO: Rota para solicitar código de redefinição de senha
app.post('/api/esqueci-senha/solicitar', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email é obrigatório.' });
        }

        const emailNormalizado = email.toLowerCase().trim();
        
        // Verifica se o usuário existe e está verificado
        const usuario = await User.findOne({ 
            email: emailNormalizado,
            emailVerificado: true
        });

        if (!usuario) {
            // Por segurança, não revela se o email existe ou não
            return res.json({ 
                success: true, 
                message: 'Se o email estiver cadastrado, você receberá um código de verificação.' 
            });
        }

        // Gera código de verificação
        const codigo = gerarCodigoVerificacao();
        const expiraEm = new Date();
        expiraEm.setMinutes(expiraEm.getMinutes() + 10); // Expira em 10 minutos

        // Salva o código no usuário
        usuario.codigoVerificacao = codigo;
        usuario.codigoVerificacaoExpira = expiraEm;
        await usuario.save();

        // Envia código por email
        try {
            await enviarCodigoVerificacao(emailNormalizado, codigo);
        } catch (emailError) {
            console.error('Erro ao enviar email de redefinição:', emailError);
            // Não bloqueia o processo - código já foi salvo
        }

        return res.json({ 
            success: true, 
            message: 'Se o email estiver cadastrado, você receberá um código de verificação.',
            email: emailNormalizado
        });
    } catch (error) {
        console.error('Erro ao solicitar redefinição de senha:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🆕 NOVO: Rota para validar código de redefinição (sem redefinir senha ainda)
app.post('/api/esqueci-senha/validar-codigo', async (req, res) => {
    try {
        const { email, codigo } = req.body;
        
        if (!email || !codigo) {
            return res.status(400).json({ success: false, message: 'Email e código são obrigatórios.' });
        }

        const emailNormalizado = email.toLowerCase().trim();
        
        // Busca o usuário
        const usuario = await User.findOne({ 
            email: emailNormalizado,
            emailVerificado: true
        });

        if (!usuario) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        // Verifica se o código está correto e não expirou
        if (usuario.codigoVerificacao !== codigo) {
            return res.status(400).json({ success: false, message: 'Código de verificação inválido.' });
        }

        if (usuario.codigoVerificacaoExpira && new Date() > usuario.codigoVerificacaoExpira) {
            return res.status(400).json({ success: false, message: 'Código de verificação expirado. Solicite um novo código.' });
        }

        res.json({ 
            success: true, 
            message: 'Código válido!'
        });
    } catch (error) {
        console.error('Erro ao validar código de redefinição:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🆕 NOVO: Rota para validar código e redefinir senha
app.post('/api/esqueci-senha/redefinir', async (req, res) => {
    try {
        const { email, codigo, novaSenha } = req.body;
        
        if (!email || !codigo || !novaSenha) {
            return res.status(400).json({ success: false, message: 'Email, código e nova senha são obrigatórios.' });
        }

        if (novaSenha.length < 6) {
            return res.status(400).json({ success: false, message: 'A senha deve ter pelo menos 6 caracteres.' });
        }

        const emailNormalizado = email.toLowerCase().trim();
        
        // Busca o usuário
        const usuario = await User.findOne({ 
            email: emailNormalizado,
            emailVerificado: true
        });

        if (!usuario) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        // Verifica se o código está correto e não expirou
        if (usuario.codigoVerificacao !== codigo) {
            return res.status(400).json({ success: false, message: 'Código de verificação inválido.' });
        }

        if (usuario.codigoVerificacaoExpira && new Date() > usuario.codigoVerificacaoExpira) {
            return res.status(400).json({ success: false, message: 'Código de verificação expirado. Solicite um novo código.' });
        }

        // Hash da nova senha
        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(novaSenha, salt);

        // Atualiza a senha e limpa o código
        usuario.senha = senhaHash;
        usuario.codigoVerificacao = null;
        usuario.codigoVerificacaoExpira = null;
        await usuario.save();

        res.json({ 
            success: true, 
            message: 'Senha redefinida com sucesso! Você já pode fazer login.'
        });
    } catch (error) {
        console.error('Erro ao redefinir senha:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
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
        // 🆕 Inclui campo 'tipo' (cliente / trabalhador / empresa)
        const { nome, idade, cidade, estado, telefone, atuacao, descricao, tipo } = req.body;
        const avatarFile = req.file;

        if (req.user.id !== id) {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        
        let fotoUrl = null;
        if (avatarFile) {
            try {
                const sharp = getSharp();
                let imageBuffer;
                const mimeType = avatarFile.mimetype || '';
                
                if (sharp) {
                    // Processa a imagem com Sharp com máxima qualidade
                    // Usa tamanho 1000x1000 para melhor qualidade quando redimensionada pelo navegador
                    let pipeline = sharp(avatarFile.buffer)
                        .resize(1000, 1000, { 
                            fit: 'cover',
                            withoutEnlargement: true, // Não aumenta imagens menores
                            kernel: 'lanczos3' // Melhor algoritmo de redimensionamento
                        });

                    // Mantém PNG/WebP praticamente sem perda, e JPEG com qualidade muito alta
                    if (mimeType.includes('png')) {
                        imageBuffer = await pipeline
                            .png({
                                compressionLevel: 6,
                                adaptiveFiltering: true
                            })
                            .toBuffer();
                    } else if (mimeType.includes('webp')) {
                        imageBuffer = await pipeline
                            .webp({
                                quality: 98,
                                lossless: true
                            })
                            .toBuffer();
                    } else {
                        imageBuffer = await pipeline
                        .jpeg({ 
                            quality: 98, 
                            mozjpeg: true,
                            progressive: true,
                            optimizeScans: true,
                            trellisQuantisation: true,
                            overshootDeringing: true
                        })
                        .toBuffer();
                    }
                } else {
                    // Se Sharp não estiver disponível, usa o buffer original
                    imageBuffer = avatarFile.buffer;
                    console.warn('Sharp não disponível, usando imagem original sem redimensionamento');
                }

                if (s3Client) {
                    // Upload para S3
                    try {
                        const key = `avatars/${Date.now()}_${path.basename(avatarFile.originalname || 'avatar')}`;
                        const uploadCommand = new PutObjectCommand({ 
                            Bucket: bucketName, 
                            Key: key, 
                            Body: imageBuffer, 
                            ContentType: 'image/jpeg' 
                        });
                        await s3Client.send(uploadCommand);
                        fotoUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
                        console.log('✅ Foto enviada para S3:', fotoUrl);
                    } catch (s3Error) {
                        console.warn("Falha no upload da foto de perfil para o S3:", s3Error);
                        // Continua para o fallback local
                    }
                }
                
                // Fallback: Salvar localmente se S3 não estiver configurado ou falhou
                if (!s3Client || !fotoUrl) {
                    const uploadsDir = path.join(__dirname, '../public/uploads/avatars');
                    
                    // Cria o diretório se não existir
                    if (!fs.existsSync(uploadsDir)) {
                        fs.mkdirSync(uploadsDir, { recursive: true });
                    }
                    
                    const fileName = `${Date.now()}_${path.basename(avatarFile.originalname || 'avatar.jpg')}`;
                    const filePath = path.join(uploadsDir, fileName);
                    
                    // Salva o arquivo
                    fs.writeFileSync(filePath, imageBuffer);
                    
                    // URL relativa para servir via express.static
                    fotoUrl = `/uploads/avatars/${fileName}`;
                    console.log('✅ Foto salva localmente:', fotoUrl);
                }
            } catch (uploadError) {
                console.error('Erro ao processar upload da foto:', uploadError);
                // Mantém fotoUrl como null em caso de erro
            }
        }
        
        // 🛑 ATUALIZAÇÃO: Objeto de updates
        const updates = { nome, idade, cidade, estado, telefone, atuacao, descricao, tipo };
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

// Rota para obter dados do usuário logado
app.get('/api/usuario/me', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId).select('-senha').exec();
        
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        
        res.json({
            ...user.toObject(),
            isAdmin: user.isAdmin || false
        });
    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
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

// Buscar Postagens (Feed) - Exibe todas as postagens ou filtra por cidade quando especificado
app.get('/api/posts', authMiddleware, async (req, res) => {
    try {
        const { cidade } = req.query;
        let query = Postagem.find();
        
        // Aplica filtro de cidade apenas se o parâmetro 'cidade' for fornecido
        if (cidade) {
            // Remove acentos e converte para minúsculas para busca flexível
            const normalizeString = (str) => {
                return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            };
            const cidadeNormalizada = normalizeString(cidade);
            
            // Busca todos os usuários e filtra por cidade
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

// 🆕 Destaques de serviços (mini vitrine tipo "Instagram do trabalho")
app.get('/api/destaques-servicos', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('cidade estado');

        // Filtro base: serviços com imagens
        const filter = { images: { $exists: true, $not: { $size: 0 } } };

        // Se o usuário tem cidade/estado, restringe aos profissionais próximos
        if (user?.cidade) {
            const cidadeRegex = new RegExp(user.cidade, 'i');
            const estadoRegex = user.estado ? new RegExp(`^${user.estado}$`, 'i') : null;

            const usuariosProximos = await User.find({
                ...(estadoRegex ? { estado: estadoRegex } : {}),
                $or: [
                    { cidade: cidadeRegex },
                    ...(estadoRegex ? [{ estado: estadoRegex }] : [])
                ]
            }).select('_id');

            const idsProximos = usuariosProximos.map(u => u._id);
            if (idsProximos.length > 0) {
                filter.userId = { $in: idsProximos };
            }
        }

        const destaques = await Servico.find(filter)
            .sort({ mediaAvaliacao: -1, totalValidacoes: -1, createdAt: -1 })
            .limit(30)
            .populate('userId', 'nome cidade estado foto avatarUrl mediaAvaliacao totalAvaliacoes tipo');

        const resposta = destaques.map(servico => {
            const images = (servico.images || []).slice(0, 6);
            const thumbs = (servico.thumbUrls || []).slice(0, 6);
            return {
                id: servico._id,
                title: servico.title,
                description: servico.description,
                images,
                thumbUrls: thumbs.length ? thumbs : images,
                user: servico.userId,
                mediaAvaliacao: servico.mediaAvaliacao,
                totalValidacoes: servico.totalValidacoes,
                createdAt: servico.createdAt
            };
        });

        res.json({ success: true, destaques: resposta });
    } catch (error) {
        console.error('Erro ao buscar destaques de serviços:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar destaques de serviços.' });
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
        let thumbUrls = [];
        if (files && files.length > 0 && s3Client) {
            const sharp = getSharp();
            if (!sharp) {
                console.warn('Sharp não disponível, pulando processamento de imagens');
            } else {
                await Promise.all(files.map(async (file) => {
                    try {
                        // Imagem principal (800x600)
                        const imageBuffer = await sharp(file.buffer).resize(800, 600, { fit: 'cover' }).toFormat('jpeg').toBuffer();
                        const baseName = `${Date.now()}_${path.basename(file.originalname)}`;
                        const key = `servicos/${userId}/${baseName}`;
                        const uploadCommand = new PutObjectCommand({ Bucket: bucketName, Key: key, Body: imageBuffer, ContentType: 'image/jpeg' });
                        await s3Client.send(uploadCommand);
                        const fullUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
                        imageUrls.push(fullUrl);

                        // Miniatura leve (400x300) para o feed de destaques
                        const thumbBuffer = await sharp(file.buffer).resize(400, 300, { fit: 'cover' }).toFormat('jpeg').toBuffer();
                        const thumbKey = `servicos/${userId}/thumbs/${baseName}`;
                        const thumbUpload = new PutObjectCommand({ Bucket: bucketName, Key: thumbKey, Body: thumbBuffer, ContentType: 'image/jpeg' });
                        await s3Client.send(thumbUpload);
                        thumbUrls.push(`https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${thumbKey}`);
                    } catch (error) {
                        console.error('Erro ao processar imagem:', error);
                    }
                }));
            }
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
            thumbUrls,
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

// 🌟 NOVO: Criar Avaliação Verificada (após serviço concluído)
app.post('/api/avaliacao-verificada', authMiddleware, async (req, res) => {
    try {
        const { profissionalId, agendamentoId, pedidoUrgenteId, estrelas, comentario, dataServico, servico } = req.body;
        const clienteId = req.user.id;

        let nomeServico = servico || '';
        let dataServicoFinal = dataServico;

        // Se tem pedidoUrgenteId (pedido urgente sem agendamento), valida o pedido primeiro
        if (pedidoUrgenteId) {
            const pedido = await PedidoUrgente.findById(pedidoUrgenteId);
            if (!pedido) {
                return res.status(404).json({ success: false, message: 'Pedido urgente não encontrado.' });
            }

            if (pedido.clienteId.toString() !== clienteId) {
                return res.status(403).json({ success: false, message: 'Você não pode avaliar este serviço.' });
            }

            if (pedido.status !== 'concluido') {
                return res.status(400).json({ success: false, message: 'O serviço precisa estar concluído para ser avaliado.' });
            }

            nomeServico = nomeServico || pedido.servico || '';
            dataServicoFinal = dataServicoFinal || pedido.updatedAt || new Date();
        }
        // Se tem agendamentoId (serviço agendado), valida o agendamento
        else if (agendamentoId) {
        const agendamento = await Agendamento.findById(agendamentoId);
        if (!agendamento) {
            return res.status(404).json({ success: false, message: 'Agendamento não encontrado.' });
        }

        if (agendamento.clienteId.toString() !== clienteId) {
            return res.status(403).json({ success: false, message: 'Você não pode avaliar este serviço.' });
        }

        if (agendamento.status !== 'concluido') {
            return res.status(400).json({ success: false, message: 'O serviço precisa estar concluído para ser avaliado.' });
        }

            nomeServico = nomeServico || agendamento.servico || '';
            dataServicoFinal = dataServicoFinal || agendamento.dataHora;
        }
        // Se não tem nem agendamentoId nem pedidoUrgenteId, retorna erro
        else {
            return res.status(400).json({ success: false, message: 'É necessário informar um agendamentoId ou pedidoUrgenteId.' });
        }

        // Permite múltiplas avaliações verificadas por agendamento/pedido (cada vez que o serviço for concluído e acessado pela notificação)

        // Cria a avaliação verificada
        console.log('💾 Criando avaliação verificada com:', {
            profissionalId,
            clienteId,
            agendamentoId: agendamentoId || undefined,
            pedidoUrgenteId: pedidoUrgenteId || undefined,
            servico: nomeServico,
            estrelas,
            comentario: comentario?.substring(0, 50) + '...'
        });
        
        const novaAvaliacao = new AvaliacaoVerificada({
            profissionalId,
            clienteId,
            agendamentoId: agendamentoId || undefined,
            pedidoUrgenteId: pedidoUrgenteId || undefined,
            estrelas,
            comentario,
            servico: nomeServico,
            dataServico: dataServicoFinal
        });

        await novaAvaliacao.save();
        console.log('✅ Avaliação verificada salva com servico:', novaAvaliacao.servico);

        // Atualiza XP do profissional baseado na avaliação verificada
        let xpGanho = 0;
        if (estrelas === 5) {
            xpGanho = 100; // Mais XP para avaliações verificadas 5 estrelas
        } else if (estrelas === 4) {
            xpGanho = 50;
        } else if (estrelas === 3) {
            xpGanho = 25;
        } else {
            xpGanho = 10; // Mesmo avaliações baixas dão XP (serviço foi feito)
        }

        await adicionarXP(profissionalId, xpGanho, `Avaliação verificada ${estrelas} estrelas`);

        // Recalcula média de avaliações verificadas do profissional
        const avaliacoesVerificadas = await AvaliacaoVerificada.find({ profissionalId });
        const mediaVerificada = avaliacoesVerificadas.reduce((acc, av) => acc + av.estrelas, 0) / avaliacoesVerificadas.length;
        
        await User.findByIdAndUpdate(profissionalId, {
            'gamificacao.mediaAvaliacoesVerificadas': mediaVerificada,
            'gamificacao.totalAvaliacoesVerificadas': avaliacoesVerificadas.length
        });

        res.status(201).json({ 
            success: true, 
            message: 'Avaliação verificada criada com sucesso!',
            avaliacao: novaAvaliacao,
            xpGanho
        });
    } catch (error) {
        console.error('Erro ao criar avaliação verificada:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🌟 NOVO: Listar Avaliações Verificadas de um Profissional (enriquece com nome do serviço)
app.get('/api/avaliacoes-verificadas/:profissionalId', async (req, res) => {
    try {
        const { profissionalId } = req.params;
        
        const avaliacoes = await AvaliacaoVerificada.find({ profissionalId })
            .populate('clienteId', 'nome foto avatarUrl')
            .populate('agendamentoId', 'servico dataHora')
            .sort({ createdAt: -1 })
            .exec();

        // Enriquecimento: tenta descobrir o nome do serviço via agendamentoId/pedido
        const avaliacoesEnriquecidas = [];
        for (const av of avaliacoes) {
            const plain = av.toObject();
            
            // 1. Se já tem servico salvo na avaliação e não é placeholder, usa ele
            const servicoAtual = plain.servico && plain.servico.trim() ? plain.servico.trim() : '';
            const isPlaceholder = servicoAtual && (
                servicoAtual.toLowerCase() === 'serviço concluído' ||
                servicoAtual.toLowerCase() === 'serviço prestado' ||
                servicoAtual.toLowerCase() === 'serviço realizado'
            );
            
            if (servicoAtual && !isPlaceholder) {
                avaliacoesEnriquecidas.push(plain);
                continue;
            }
            
            // Se tem placeholder ou está vazio, tenta buscar de outras fontes
            
            // 2. Tenta pegar do agendamento populado
            let servicoEncontrado = null;
            if (plain.agendamentoId) {
                // Se está populado (é um objeto com propriedades)
                if (typeof plain.agendamentoId === 'object' && plain.agendamentoId.servico) {
                    servicoEncontrado = plain.agendamentoId.servico;
                } else {
                    // Se é apenas um ObjectId, busca o agendamento
                    const agendamentoIdValue = plain.agendamentoId._id || plain.agendamentoId;
                    if (mongoose.Types.ObjectId.isValid(agendamentoIdValue)) {
                        try {
                            const agendamento = await Agendamento.findById(agendamentoIdValue).lean();
                            if (agendamento?.servico) {
                                servicoEncontrado = agendamento.servico;
                            } else {
                                // Se não encontrou no agendamento, tenta buscar em um pedido urgente que tenha este agendamentoId
                                const pedido = await PedidoUrgente.findOne({ agendamentoId: agendamentoIdValue }).lean();
                        if (pedido?.servico) {
                                    servicoEncontrado = pedido.servico;
                            plain.pedidoId = pedido._id;
                                }
                        }
                    } catch (e) {
                        console.warn('Falha ao enriquecer avaliação verificada com serviço', e);
                    }
                }
            }
            }
            
            // 3. Se não encontrou no agendamento, tenta do pedidoUrgenteId populado
            if (!servicoEncontrado && plain.pedidoUrgenteId) {
                // Se está populado (é um objeto com propriedades)
                if (typeof plain.pedidoUrgenteId === 'object' && plain.pedidoUrgenteId.servico) {
                    servicoEncontrado = plain.pedidoUrgenteId.servico;
                } else {
                    // Se é apenas um ObjectId, busca o pedido urgente
                    const pedidoIdValue = plain.pedidoUrgenteId._id || plain.pedidoUrgenteId;
                    if (mongoose.Types.ObjectId.isValid(pedidoIdValue)) {
                        try {
                            const pedido = await PedidoUrgente.findById(pedidoIdValue).lean();
                            if (pedido?.servico) {
                                servicoEncontrado = pedido.servico;
                            }
                        } catch (e) {
                            console.warn('Falha ao enriquecer avaliação verificada com serviço do pedido urgente', e);
                        }
                    }
                }
            }
            
            // Atribui o serviço encontrado (só se não for placeholder)
            if (servicoEncontrado && servicoEncontrado.trim()) {
                const servicoLimpo = servicoEncontrado.trim();
                const isPlaceholderEncontrado = (
                    servicoLimpo.toLowerCase() === 'serviço concluído' ||
                    servicoLimpo.toLowerCase() === 'serviço prestado' ||
                    servicoLimpo.toLowerCase() === 'serviço realizado'
                );
                
                if (!isPlaceholderEncontrado) {
                    plain.servico = servicoLimpo;
                    console.log(`✅ Nome do serviço atribuído à avaliação ${plain._id}: ${plain.servico}`);
                } else {
                    console.warn(`⚠️ Serviço encontrado é placeholder, não atribuindo: ${servicoLimpo}`);
                }
            } else {
                console.warn(`⚠️ Nenhum nome de serviço encontrado para avaliação ${plain._id}`);
            }
            
            avaliacoesEnriquecidas.push(plain);
        }

        res.json({ success: true, avaliacoes: avaliacoesEnriquecidas });
    } catch (error) {
        console.error('Erro ao buscar avaliações verificadas:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🆕 NOVO: Atualizar avaliação para adicionar XP automaticamente (MANTIDO PARA COMPATIBILIDADE)
app.post('/api/avaliar-trabalhador', authMiddleware, async (req, res) => {
    try {
        const { trabalhadorId, estrelas, comentario, servico, pedidoId, agendamentoId } = req.body;
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
            servico: servico || '',
            pedidoId: pedidoId || '',
            agendamentoId: agendamentoId || '',
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

// 🏢 NOVO: Rotas de Times Locais (Micro-Agências)
// Criar Time Local
app.post('/api/times-locais', authMiddleware, async (req, res) => {
    try {
        const { nome, descricao, categoria } = req.body;
        const liderId = req.user.id;
        
        const lider = await User.findById(liderId);
        if (!lider || lider.tipo !== 'trabalhador') {
            return res.status(403).json({ success: false, message: 'Apenas profissionais podem criar times locais.' });
        }

        // Verifica se o líder tem nível suficiente (Nível 10+)
        if ((lider.gamificacao?.nivel || 1) < 10) {
            return res.status(403).json({ success: false, message: 'Você precisa ser Nível 10 ou superior para criar um time local.' });
        }

        const novoTime = new TimeLocal({
            liderId,
            nome,
            descricao,
            categoria,
            nivelMedio: lider.gamificacao?.nivel || 1
        });

        await novoTime.save();
        
        res.status(201).json({ success: true, message: 'Time local criado com sucesso!', time: novoTime });
    } catch (error) {
        console.error('Erro ao criar time local:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Convidar membro para Time Local
app.post('/api/times-locais/:timeId/convidar', authMiddleware, async (req, res) => {
    try {
        const { timeId } = req.params;
        const { profissionalId, funcao } = req.body;
        const liderId = req.user.id;

        const time = await TimeLocal.findById(timeId);
        if (!time) {
            return res.status(404).json({ success: false, message: 'Time local não encontrado.' });
        }

        if (time.liderId.toString() !== liderId) {
            return res.status(403).json({ success: false, message: 'Apenas o líder pode convidar membros.' });
        }

        const profissional = await User.findById(profissionalId);
        if (!profissional || profissional.tipo !== 'trabalhador') {
            return res.status(400).json({ success: false, message: 'Usuário inválido.' });
        }

        // Verifica se já é membro
        const jaMembro = time.membros.some(m => m.profissionalId.toString() === profissionalId);
        if (jaMembro) {
            return res.status(400).json({ success: false, message: 'Este profissional já é membro do time.' });
        }

        time.membros.push({
            profissionalId,
            funcao,
            status: 'pendente'
        });

        // Recalcula nível médio
        const membrosAtivos = await User.find({ 
            _id: { $in: [...time.membros.map(m => m.profissionalId), time.liderId] } 
        });
        const nivelMedio = membrosAtivos.reduce((sum, m) => sum + (m.gamificacao?.nivel || 1), 0) / membrosAtivos.length;
        time.nivelMedio = Math.round(nivelMedio);

        await time.save();
        
        res.json({ success: true, message: 'Convite enviado com sucesso!' });
    } catch (error) {
        console.error('Erro ao convidar membro:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar Times Locais
app.get('/api/times-locais', async (req, res) => {
    try {
        const { categoria, cidade } = req.query;
        
        let query = { isAtivo: true };
        if (categoria) {
            query.categoria = categoria;
        }

        const times = await TimeLocal.find(query)
            .populate('liderId', 'nome foto avatarUrl atuacao cidade estado gamificacao')
            .populate('membros.profissionalId', 'nome foto avatarUrl atuacao gamificacao')
            .sort({ nivelMedio: -1, projetosCompletos: -1 })
            .exec();

        // Filtra por cidade se especificado
        let timesFiltrados = times;
        if (cidade) {
            const normalizeString = (str) => {
                return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            };
            const cidadeNormalizada = normalizeString(cidade);
            timesFiltrados = times.filter(time => {
                const cidadeLider = time.liderId?.cidade || '';
                return normalizeString(cidadeLider).includes(cidadeNormalizada) ||
                       cidadeNormalizada.includes(normalizeString(cidadeLider));
            });
        }

        res.json({ success: true, times: timesFiltrados });
    } catch (error) {
        console.error('Erro ao buscar times locais:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 📋 NOVO: Rotas de Projetos de Time / Mutirão Pago
// Criar Projeto de Time
app.post('/api/projetos-time', authMiddleware, async (req, res) => {
    try {
        const { titulo, descricao, categoria, localizacao, dataServico, horaInicio, horaFim, profissionaisNecessarios, valorTotal } = req.body;
        const clienteId = req.user.id;

        const novoProjeto = new ProjetoTime({
            clienteId,
            titulo,
            descricao,
            categoria,
            localizacao,
            dataServico: new Date(dataServico),
            horaInicio,
            horaFim,
            profissionaisNecessarios,
            valorTotal
        });

        await novoProjeto.save();
        
        res.status(201).json({ success: true, message: 'Projeto de time criado com sucesso!', projeto: novoProjeto });
    } catch (error) {
        console.error('Erro ao criar projeto de time:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Candidatar Time Local a Projeto
app.post('/api/projetos-time/:projetoId/candidatar', authMiddleware, async (req, res) => {
    try {
        const { projetoId } = req.params;
        const { timeLocalId, proposta } = req.body;
        const liderId = req.user.id;

        const projeto = await ProjetoTime.findById(projetoId);
        if (!projeto) {
            return res.status(404).json({ success: false, message: 'Projeto não encontrado.' });
        }

        const time = await TimeLocal.findById(timeLocalId);
        if (!time || time.liderId.toString() !== liderId) {
            return res.status(403).json({ success: false, message: 'Você não é líder deste time.' });
        }

        if (projeto.status !== 'aberto') {
            return res.status(400).json({ success: false, message: 'Este projeto não está mais aceitando candidatos.' });
        }

        projeto.candidatos.push({
            timeLocalId,
            proposta,
            status: 'pendente'
        });

        await projeto.save();
        
        res.json({ success: true, message: 'Candidatura enviada com sucesso!' });
    } catch (error) {
        console.error('Erro ao candidatar time:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar Projetos de Time
app.get('/api/projetos-time', async (req, res) => {
    try {
        const { cidade, categoria, status = 'aberto' } = req.query;
        
        let query = { status };
        if (categoria) {
            query.categoria = categoria;
        }

        const projetos = await ProjetoTime.find(query)
            .populate('clienteId', 'nome foto avatarUrl cidade estado')
            .populate('candidatos.timeLocalId')
            .populate('timeSelecionado')
            .sort({ createdAt: -1 })
            .exec();

        // Filtra por cidade se especificado
        let projetosFiltrados = projetos;
        if (cidade) {
            const normalizeString = (str) => {
                return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            };
            const cidadeNormalizada = normalizeString(cidade);
            projetosFiltrados = projetos.filter(projeto => {
                const cidadeProjeto = projeto.localizacao?.cidade || '';
                return normalizeString(cidadeProjeto).includes(cidadeNormalizada) ||
                       cidadeNormalizada.includes(normalizeString(cidadeProjeto));
            });
        }

        res.json({ success: true, projetos: projetosFiltrados });
    } catch (error) {
        console.error('Erro ao buscar projetos de time:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🚨 NOVO: Rotas de Pedidos Urgentes ("Preciso Agora!")
// Criar Pedido Urgente
app.post('/api/pedidos-urgentes', authMiddleware, upload.single('foto'), async (req, res) => {
    try {
        const { servico, descricao, localizacao, categoria, prazoHoras, tipoAtendimento, dataAgendada } = req.body;
        const clienteId = req.user.id;

        // Processa a foto se foi enviada
        let fotoUrl = null;
        if (req.file) {
            try {
                const sharp = getSharp();
                let imageBuffer = req.file.buffer;

                if (sharp) {
                    imageBuffer = await sharp(req.file.buffer)
                        .resize(800, 600, { fit: 'cover' })
                        .toFormat('jpeg', { quality: 90 })
                        .toBuffer();
                }
                    
                // Tenta enviar para o S3 se estiver configurado
                if (s3Client) {
                    try {
                    const key = `pedidos-urgentes/${clienteId}/${Date.now()}_${path.basename(req.file.originalname)}`;
                    const uploadCommand = new PutObjectCommand({
                        Bucket: bucketName,
                        Key: key,
                        Body: imageBuffer,
                        ContentType: 'image/jpeg'
                    });
                    await s3Client.send(uploadCommand);
                    fotoUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
                    } catch (s3Error) {
                        console.warn('Falha ao enviar foto de pedido urgente para S3, usando fallback local:', s3Error);
                    }
                }

                // Fallback local se não houver S3 ou se o upload falhar
                if (!s3Client || !fotoUrl) {
                    const uploadsDir = path.join(__dirname, '../public/uploads/pedidos-urgentes');
                    if (!fs.existsSync(uploadsDir)) {
                        fs.mkdirSync(uploadsDir, { recursive: true });
                    }
                    const fileName = `${Date.now()}_${path.basename(req.file.originalname || 'pedido-urgente.jpg')}`;
                    const filePath = path.join(uploadsDir, fileName);
                    fs.writeFileSync(filePath, imageBuffer);
                    // URL relativa servida via express.static
                    fotoUrl = `/uploads/pedidos-urgentes/${fileName}`;
                    console.log('✅ Foto de pedido urgente salva localmente:', fotoUrl);
                }
            } catch (fotoError) {
                console.error('Erro ao processar foto do pedido urgente:', fotoError);
            }
        }

        // Normaliza tipo de atendimento e data agendada (quando existir)
        const tipoAt = tipoAtendimento === 'agendado' ? 'agendado' : 'urgente';
        let dataAgendadaDate = null;
        if (tipoAt === 'agendado' && dataAgendada) {
            const parsed = new Date(dataAgendada);
            if (!isNaN(parsed.getTime())) {
                dataAgendadaDate = parsed;
            }
        }

        // Define expiração conforme prazo escolhido (padrão: 1h)
        const horasValidas = [1, 2, 5, 9, 12, 24];
        let horas = parseInt(prazoHoras, 10);
        if (isNaN(horas) || !horasValidas.includes(horas)) {
            horas = 1;
        }

        let dataExpiracao = new Date();
        dataExpiracao.setHours(dataExpiracao.getHours() + horas);

        // Para pedidos agendados, a expiração passa a ser a própria data agendada (quando válida)
        if (tipoAt === 'agendado' && dataAgendadaDate) {
            dataExpiracao = dataAgendadaDate;
        }

        // Garante objeto de localização consistente
        let localizacaoObj = localizacao;
        if (typeof localizacao === 'string') {
            try {
                localizacaoObj = JSON.parse(localizacao);
            } catch (e) {
                localizacaoObj = {};
            }
        }

        const novoPedido = new PedidoUrgente({
            clienteId,
            servico,
            descricao,
            foto: fotoUrl,
            localizacao: localizacaoObj,
            categoria,
            tipoAtendimento: tipoAt,
            prazoHoras: horas,
            dataAgendada: dataAgendadaDate,
            dataExpiracao
        });

        await novoPedido.save();

        // Busca profissionais online na região e categoria (case-insensitive, parcial)
        const queryProfissionais = {
            tipo: 'trabalhador',
            'localizacao.latitude': { $exists: true },
            'localizacao.longitude': { $exists: true },
            disponivelAgora: true // Campo que indica se está online/disponível
        };

        if (categoria) {
            // Usa regex case-insensitive para evitar falhas por capitalização/acentuação
            queryProfissionais.atuacao = { $regex: categoria, $options: 'i' };
        }

        const profissionais = await User.find(queryProfissionais)
            .select('nome foto avatarUrl atuacao cidade estado gamificacao localizacao disponivelAgora telefone')
            .exec();

        // Cria notificações no banco para cada profissional encontrado
        const notificacoesCriadas = [];
        for (const prof of profissionais) {
            try {
                const titulo = 'Pedido urgente próximo a você';
                let detalhesHorario = '';
                if (tipoAt === 'agendado' && dataAgendadaDate) {
                    const dataBR = dataAgendadaDate.toLocaleDateString('pt-BR');
                    const horaBR = dataAgendadaDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    detalhesHorario = ` (agendado para ${dataBR} às ${horaBR})`;
                }
                const cidadeLocal = localizacaoObj?.cidade || '';
                const estadoLocal = localizacaoObj?.estado || '';
                const mensagem = `Um cliente solicitou: ${servico} em ${cidadeLocal} - ${estadoLocal}${detalhesHorario}. Verifique agora.`;
                const notif = await criarNotificacao(
                    prof._id,
                    'pedido_urgente',
                    titulo,
                    mensagem,
                    { 
                        pedidoId: novoPedido._id,
                        servico,
                        cidade: cidadeLocal,
                        estado: estadoLocal,
                        tipoAtendimento: tipoAt,
                        dataAgendada: dataAgendadaDate
                    }
                );
                if (notif) notificacoesCriadas.push(notif._id);
            } catch (err) {
                console.error('Erro ao criar notificação para profissional', prof._id, err);
            }
        }

        // Salva os IDs dos profissionais e das notificações geradas (se precisar rastrear)
        novoPedido.notificacoesEnviadas = profissionais.map(p => p._id);
        if (notificacoesCriadas.length > 0) novoPedido.notificacoesCriadas = notificacoesCriadas;
        await novoPedido.save();

        res.status(201).json({ 
            success: true, 
            message: 'Pedido urgente criado! Profissionais foram notificados.',
            pedido: novoPedido,
            profissionaisNotificados: profissionais.length
        });
    } catch (error) {
        console.error('Erro ao criar pedido urgente:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Enviar Proposta Rápida para Pedido Urgente
app.post('/api/pedidos-urgentes/:pedidoId/proposta', authMiddleware, async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const { valor, tempoChegada, observacoes } = req.body;
        const profissionalId = req.user.id;

        const profissional = await User.findById(profissionalId);
        if (!profissional || profissional.tipo !== 'trabalhador') {
            return res.status(403).json({ success: false, message: 'Apenas profissionais podem enviar propostas.' });
        }

        const pedido = await PedidoUrgente.findById(pedidoId);
        if (!pedido) {
            return res.status(404).json({ success: false, message: 'Pedido urgente não encontrado.' });
        }

        // Impede que o próprio criador envie proposta para o seu pedido
        if (pedido.clienteId.toString() === profissionalId) {
            return res.status(400).json({ success: false, message: 'Você não pode enviar proposta para um pedido criado por você.' });
        }

        if (pedido.status !== 'aberto') {
            return res.status(400).json({ success: false, message: 'Este pedido não está mais aceitando propostas.' });
        }

        if (new Date() > pedido.dataExpiracao) {
            return res.status(400).json({ success: false, message: 'Este pedido expirou.' });
        }

        // Verifica se já enviou proposta
        const jaPropos = pedido.propostas.some(p => p.profissionalId.toString() === profissionalId);
        if (jaPropos) {
            return res.status(400).json({ success: false, message: 'Você já enviou uma proposta para este pedido.' });
        }

        pedido.propostas.push({
            profissionalId,
            valor,
            tempoChegada,
            observacoes,
            status: 'pendente'
        });

        await pedido.save();

        // Cria notificação para o cliente sobre a nova proposta
        try {
            const cliente = await User.findById(pedido.clienteId);
            if (cliente) {
                const titulo = 'Nova proposta recebida!';
                const mensagem = `${profissional.nome} enviou uma proposta de R$ ${valor.toFixed(2)} para seu pedido: ${pedido.servico}`;
                await criarNotificacao(
                    pedido.clienteId,
                    'proposta_pedido_urgente',
                    titulo,
                    mensagem,
                    { 
                        pedidoId: pedido._id,
                        propostaId: pedido.propostas[pedido.propostas.length - 1]._id,
                        profissionalId: profissionalId,
                        servico: pedido.servico
                    },
                    `#modal-propostas`
                );
            }
        } catch (notifError) {
            console.error('Erro ao criar notificação de proposta:', notifError);
            // Não falha a operação principal se a notificação falhar
        }
        
        res.json({ success: true, message: 'Proposta enviada com sucesso!' });
    } catch (error) {
        console.error('Erro ao enviar proposta:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar Propostas de um Pedido Urgente (para o cliente)
app.get('/api/pedidos-urgentes/:pedidoId/propostas', authMiddleware, async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const clienteId = req.user.id;

        const pedido = await PedidoUrgente.findById(pedidoId)
            .populate('propostas.profissionalId', 'nome foto avatarUrl atuacao cidade estado gamificacao mediaAvaliacao totalAvaliacoes')
            .exec();

        if (!pedido) {
            return res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
        }

        if (pedido.clienteId.toString() !== clienteId) {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }

        res.json({ 
            success: true, 
            propostas: pedido.propostas,
            pedido: {
                _id: pedido._id,
                servico: pedido.servico,
                descricao: pedido.descricao,
                foto: pedido.foto,
                categoria: pedido.categoria,
                localizacao: pedido.localizacao,
                tipoAtendimento: pedido.tipoAtendimento,
                dataAgendada: pedido.dataAgendada
            }
        });
    } catch (error) {
        console.error('Erro ao buscar propostas:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Recusar Proposta de Pedido Urgente (cliente não gostou da proposta)
app.post('/api/pedidos-urgentes/:pedidoId/recusar-proposta', authMiddleware, async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const { propostaId } = req.body;
        const clienteId = req.user.id;

        const pedido = await PedidoUrgente.findById(pedidoId);
        if (!pedido) {
            return res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
        }

        if (pedido.clienteId.toString() !== clienteId) {
            return res.status(403).json({ success: false, message: 'Apenas o cliente pode recusar propostas.' });
        }

        const proposta = pedido.propostas.id(propostaId);
        if (!proposta) {
            return res.status(404).json({ success: false, message: 'Proposta não encontrada.' });
        }

        if (proposta.status === 'aceita') {
            return res.status(400).json({ success: false, message: 'Não é possível recusar uma proposta já aceita.' });
        }

        proposta.status = 'rejeitada';
        await pedido.save();

        return res.json({ success: true, message: 'Proposta recusada com sucesso.', pedido });
    } catch (error) {
        console.error('Erro ao recusar proposta:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Buscar um pedido urgente por ID (dados básicos e foto) - restringe a ObjectId para não conflitar com /ativos, /meus etc.
app.get('/api/pedidos-urgentes/:pedidoId([a-fA-F0-9]{24})', authMiddleware, async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const pedido = await PedidoUrgente.findById(pedidoId)
            .populate('clienteId', 'nome foto avatarUrl cidade estado')
            .exec();

        if (!pedido) {
            return res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
        }

        res.json({
            success: true,
            pedido: {
                _id: pedido._id,
                servico: pedido.servico,
                descricao: pedido.descricao,
                foto: pedido.foto,
                localizacao: pedido.localizacao,
                categoria: pedido.categoria,
                clienteId: pedido.clienteId
            }
        });
    } catch (error) {
        console.error('Erro ao buscar pedido urgente:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Aceitar Proposta de Pedido Urgente
app.post('/api/pedidos-urgentes/:pedidoId/aceitar-proposta', authMiddleware, async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const { propostaId } = req.body;
        const clienteId = req.user.id;

        const pedido = await PedidoUrgente.findById(pedidoId);
        if (!pedido) {
            return res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
        }

        if (pedido.clienteId.toString() !== clienteId) {
            return res.status(403).json({ success: false, message: 'Apenas o cliente pode aceitar propostas.' });
        }

        const proposta = pedido.propostas.id(propostaId);
        if (!proposta) {
            return res.status(404).json({ success: false, message: 'Proposta não encontrada.' });
        }

        // Rejeita outras propostas
        pedido.propostas.forEach(p => {
            if (p._id.toString() !== propostaId) {
                p.status = 'rejeitada';
            }
        });

        proposta.status = 'aceita';
        pedido.propostaSelecionada = propostaId;

        // Cria agendamento automaticamente
        const dataHoraServico = pedido.dataAgendada || new Date(); // Se tiver horário agendado, usa ele

        const agendamento = new Agendamento({
            profissionalId: proposta.profissionalId,
            clienteId,
            dataHora: dataHoraServico,
            servico: pedido.servico,
            observacoes: `Pedido urgente: ${pedido.descricao || ''}. ${proposta.observacoes || ''}`,
            endereco: pedido.localizacao,
            status: 'confirmado'
        });

        await agendamento.save();

        // Vincula o agendamento ao pedido e marca como em andamento
        pedido.agendamentoId = agendamento._id;
        pedido.status = 'em_andamento';
        await pedido.save();

        // Notifica o profissional que a proposta foi aceita
        try {
            const profissional = await User.findById(proposta.profissionalId);
            if (profissional) {
                const titulo = 'Sua proposta foi aceita!';
                const mensagem = `Um cliente aceitou sua proposta para o pedido urgente: ${pedido.servico}. Prepare-se para o atendimento.`;
                await criarNotificacao(
                    proposta.profissionalId,
                    'proposta_aceita',
                    titulo,
                    mensagem,
                    {
                        pedidoId: pedido._id,
                        agendamentoId: agendamento._id
                    },
                    null
                );
            }
        } catch (notifError) {
            console.error('Erro ao criar notificação de proposta aceita:', notifError);
        }
        
        res.json({ 
            success: true, 
            message: 'Proposta aceita! Agora é só aguardar o profissional.',
            pedido,
            agendamento
        });
    } catch (error) {
        console.error('Erro ao aceitar proposta:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Cancelar Pedido Urgente (cliente)
app.post('/api/pedidos-urgentes/:pedidoId/cancelar', authMiddleware, async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const clienteId = req.user.id;

        const pedido = await PedidoUrgente.findById(pedidoId);
        if (!pedido) {
            return res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
        }

        if (pedido.clienteId.toString() !== clienteId) {
            return res.status(403).json({ success: false, message: 'Apenas o cliente pode cancelar o pedido.' });
        }

        if (pedido.status !== 'aberto') {
            return res.status(400).json({ success: false, message: 'Somente pedidos em aberto podem ser cancelados por aqui.' });
        }

        pedido.status = 'cancelado';
        // Marca propostas pendentes como canceladas
        pedido.propostas.forEach(p => {
            if (p.status === 'pendente') {
                p.status = 'cancelada';
            }
        });

        await pedido.save();

        return res.json({ success: true, message: 'Pedido cancelado com sucesso.', pedido });
    } catch (error) {
        console.error('Erro ao cancelar pedido urgente:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Cancelar serviço de pedido urgente após aceito (cliente ou profissional)
app.post('/api/pedidos-urgentes/:pedidoId/cancelar-servico', authMiddleware, async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const { motivo } = req.body;
        const userId = req.user.id;

        const pedido = await PedidoUrgente.findById(pedidoId);
        if (!pedido) {
            return res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
        }

        if (pedido.status !== 'em_andamento') {
            return res.status(400).json({ success: false, message: 'Somente serviços em andamento podem ser cancelados.' });
        }

        const propostaAceita = pedido.propostas.id(pedido.propostaSelecionada);
        if (!propostaAceita) {
            return res.status(400).json({ success: false, message: 'Nenhuma proposta aceita encontrada para este pedido.' });
        }

        const profissionalId = propostaAceita.profissionalId.toString();
        const clienteId = pedido.clienteId.toString();

        // Apenas o cliente ou o profissional responsável podem cancelar
        if (userId !== clienteId && userId !== profissionalId) {
            return res.status(403).json({ success: false, message: 'Você não tem permissão para cancelar este serviço.' });
        }

        pedido.status = 'cancelado';
        pedido.motivoCancelamento = motivo || null;
        pedido.canceladoPor = userId;
        await pedido.save();

        // Cancela agendamento relacionado, se existir
        if (pedido.agendamentoId) {
            await Agendamento.findByIdAndUpdate(pedido.agendamentoId, { status: 'cancelado' });
        }

        // Notifica a outra parte sobre o cancelamento
        try {
            const outroLadoId = userId === clienteId ? profissionalId : clienteId;
            const titulo = 'Serviço cancelado';
            const mensagem = `O serviço "${pedido.servico}" foi cancelado. Motivo: ${motivo || 'não informado.'}`;
            await criarNotificacao(
                outroLadoId,
                'disputa_aberta',
                titulo,
                mensagem,
                {
                    pedidoId: pedido._id,
                    canceladoPor: userId,
                    motivo: motivo || null
                },
                null
            );
        } catch (notifError) {
            console.error('Erro ao criar notificação de cancelamento de serviço:', notifError);
        }

        res.json({ success: true, message: 'Serviço cancelado com sucesso.' });
    } catch (error) {
        console.error('Erro ao cancelar serviço de pedido urgente:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar Pedidos Urgentes Disponíveis (para profissionais)
app.get('/api/pedidos-urgentes', authMiddleware, async (req, res) => {
    try {
        const { categoria, cidade } = req.query;
        const profissionalId = req.user.id;

        const profissional = await User.findById(profissionalId);
        if (!profissional || profissional.tipo !== 'trabalhador') {
            return res.status(403).json({ success: false, message: 'Apenas profissionais podem ver pedidos urgentes.' });
        }

        let query = { 
            status: 'aberto',
            dataExpiracao: { $gt: new Date() }, // Apenas pedidos não expirados
            clienteId: { $ne: profissionalId } // Não mostrar pedidos criados por este profissional
        };

        // Filtra por categoria apenas se especificado explicitamente
        if (categoria) {
            query.categoria = categoria;
        }

        const pedidos = await PedidoUrgente.find(query)
            .populate('clienteId', '_id nome foto avatarUrl cidade estado')
            .sort({ createdAt: -1 })
            .exec();

        // Filtra por profissão (atuacao) de forma flexível, se nenhuma categoria foi informada
        let pedidosFiltrados = pedidos;
        if (!categoria && profissional.atuacao) {
            const atuacaoNorm = profissional.atuacao
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .toLowerCase().trim();

            const filtraPorAtuacao = (texto) => {
                if (!texto) return false;
                const norm = String(texto)
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                    .toLowerCase().trim();
                return norm.includes(atuacaoNorm) || atuacaoNorm.includes(norm);
            };

            const porProfissao = pedidos.filter(p => 
                filtraPorAtuacao(p.categoria) || filtraPorAtuacao(p.servico)
            );

            // Se o filtro por profissão trouxer algum resultado, usa ele;
            // senão, mantém a lista completa para não esconder tudo.
            if (porProfissao.length > 0) {
                pedidosFiltrados = porProfissao;
            }
        }

        // Filtra por cidade se especificado
        if (cidade) {
            const normalizeString = (str) => {
                return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            };
            const cidadeNormalizada = normalizeString(cidade);
            pedidosFiltrados = pedidosFiltrados.filter(pedido => {
                const cidadePedido = pedido.localizacao?.cidade || '';
                return normalizeString(cidadePedido).includes(cidadeNormalizada) ||
                       cidadeNormalizada.includes(normalizeString(cidadePedido));
            });
        }

        res.json({ success: true, pedidos: pedidosFiltrados });
    } catch (error) {
        console.error('Erro ao buscar pedidos urgentes:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar Pedidos Urgentes do Cliente (seus próprios pedidos)
app.get('/api/pedidos-urgentes/meus', authMiddleware, async (req, res) => {
    try {
        const clienteId = req.user.id;
        const { status } = req.query;

        const cliente = await User.findById(clienteId);
        if (!cliente) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        let query = { clienteId };
        
        // Filtra por status se especificado
        if (status) {
            query.status = status;
        }

        const pedidos = await PedidoUrgente.find(query)
            .populate('clienteId', '_id nome foto avatarUrl cidade estado')
            .populate('propostas.profissionalId', '_id nome foto avatarUrl atuacao cidade estado gamificacao mediaAvaliacao totalAvaliacoes')
            .sort({ createdAt: -1 })
            .exec();

        const agora = new Date();
        const pedidosAtivos = [];
        const pedidosExpirados = [];

        pedidos.forEach(p => {
            const expirado = p.dataExpiracao && p.dataExpiracao <= agora && p.status === 'aberto';
            const plain = p.toObject();
            plain.expirado = expirado;
            if (expirado) {
                pedidosExpirados.push(plain);
            } else {
                pedidosAtivos.push(plain);
            }
        });

        res.json({ success: true, pedidos, pedidosAtivos, pedidosExpirados });
    } catch (error) {
        console.error('Erro ao buscar pedidos urgentes do cliente:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// ⚡ NOVO: Rotas de Vagas-Relâmpago (para empresas)
// Criar Vaga-Relâmpago
app.post('/api/vagas-relampago', authMiddleware, async (req, res) => {
    try {
        const { titulo, descricao, cargo, quantidade, dataServico, horaInicio, horaFim, valorPorPessoa, formaPagamento, localizacao } = req.body;
        const empresaId = req.user.id;

        const empresa = await User.findById(empresaId);
        if (!empresa || empresa.tipo !== 'empresa') {
            return res.status(403).json({ success: false, message: 'Apenas empresas podem criar vagas-relâmpago.' });
        }

        // Define expiração baseada na data do serviço (expira 1 hora antes do início)
        const dataServicoObj = new Date(dataServico);
        const dataExpiracao = new Date(dataServicoObj);
        dataExpiracao.setHours(dataExpiracao.getHours() - 1);

        const novaVaga = new VagaRelampago({
            empresaId,
            titulo,
            descricao,
            cargo,
            quantidade,
            dataServico: dataServicoObj,
            horaInicio,
            horaFim,
            valorPorPessoa,
            formaPagamento: formaPagamento || 'via_helpy',
            localizacao,
            dataExpiracao
        });

        await novaVaga.save();

        // Busca profissionais com a atuação correspondente ao cargo
        const profissionais = await User.find({
            tipo: 'trabalhador',
            $or: [
                { atuacao: { $regex: cargo, $options: 'i' } },
                { atuacao: { $regex: cargo.toLowerCase(), $options: 'i' } }
            ],
            'localizacao.latitude': { $exists: true },
            'localizacao.longitude': { $exists: true },
            disponivelAgora: true
        }).select('nome foto avatarUrl atuacao cidade estado gamificacao localizacao disponivelAgora').exec();

        // TODO: Implementar notificações push aqui
        novaVaga.notificacoesEnviadas = profissionais.map(p => p._id);
        await novaVaga.save();

        res.status(201).json({ 
            success: true, 
            message: 'Vaga-relâmpago criada! Profissionais foram notificados.',
            vaga: novaVaga,
            profissionaisNotificados: profissionais.length
        });
    } catch (error) {
        console.error('Erro ao criar vaga-relâmpago:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar Vagas-Relâmpago Disponíveis (para profissionais)
app.get('/api/vagas-relampago', authMiddleware, async (req, res) => {
    try {
        const { cargo, cidade } = req.query;
        const profissionalId = req.user.id;

        const profissional = await User.findById(profissionalId);
        if (!profissional || profissional.tipo !== 'trabalhador') {
            return res.status(403).json({ success: false, message: 'Apenas profissionais podem ver vagas-relâmpago.' });
        }

        let query = { 
            status: 'aberta',
            $or: [
                { dataExpiracao: { $gt: new Date() } },
                { dataExpiracao: { $exists: false } }
            ]
        };

        if (cargo) {
            query.cargo = { $regex: cargo, $options: 'i' };
        }

        const vagas = await VagaRelampago.find(query)
            .populate('empresaId', 'nome foto avatarUrl cidade estado')
            .sort({ createdAt: -1 })
            .exec();

        // Filtra por cidade se especificado
        let vagasFiltradas = vagas;
        if (cidade) {
            const normalizeString = (str) => {
                return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            };
            const cidadeNormalizada = normalizeString(cidade);
            vagasFiltradas = vagas.filter(vaga => {
                const cidadeVaga = vaga.localizacao?.cidade || '';
                return normalizeString(cidadeVaga).includes(cidadeNormalizada) ||
                       cidadeNormalizada.includes(normalizeString(cidadeVaga));
            });
        }

        res.json({ success: true, vagas: vagasFiltradas });
    } catch (error) {
        console.error('Erro ao buscar vagas-relâmpago:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Candidatar-se a uma Vaga-Relâmpago
app.post('/api/vagas-relampago/:vagaId/candidatar', authMiddleware, async (req, res) => {
    try {
        const { vagaId } = req.params;
        const profissionalId = req.user.id;

        const profissional = await User.findById(profissionalId);
        if (!profissional || profissional.tipo !== 'trabalhador') {
            return res.status(403).json({ success: false, message: 'Apenas profissionais podem se candidatar.' });
        }

        const vaga = await VagaRelampago.findById(vagaId);
        if (!vaga) {
            return res.status(404).json({ success: false, message: 'Vaga não encontrada.' });
        }

        if (vaga.status !== 'aberta') {
            return res.status(400).json({ success: false, message: 'Esta vaga não está mais aceitando candidatos.' });
        }

        if (new Date() > vaga.dataExpiracao) {
            return res.status(400).json({ success: false, message: 'Esta vaga expirou.' });
        }

        // Verifica se já se candidatou
        const jaCandidatou = vaga.candidatos.some(c => c.profissionalId.toString() === profissionalId);
        if (jaCandidatou) {
            return res.status(400).json({ success: false, message: 'Você já se candidatou a esta vaga.' });
        }

        // Verifica se já foi aceito
        const jaAceito = vaga.profissionaisAceitos.some(id => id.toString() === profissionalId);
        if (jaAceito) {
            return res.status(400).json({ success: false, message: 'Você já foi aceito nesta vaga.' });
        }

        vaga.candidatos.push({
            profissionalId,
            status: 'pendente'
        });

        await vaga.save();
        
        res.json({ success: true, message: 'Candidatura enviada com sucesso!' });
    } catch (error) {
        console.error('Erro ao candidatar-se:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar Candidatos de uma Vaga-Relâmpago (para empresa)
app.get('/api/vagas-relampago/:vagaId/candidatos', authMiddleware, async (req, res) => {
    try {
        const { vagaId } = req.params;
        const empresaId = req.user.id;

        const vaga = await VagaRelampago.findById(vagaId)
            .populate('candidatos.profissionalId', 'nome foto avatarUrl atuacao cidade estado gamificacao mediaAvaliacao totalAvaliacoes')
            .populate('profissionaisAceitos', 'nome foto avatarUrl atuacao cidade estado gamificacao')
            .exec();

        if (!vaga) {
            return res.status(404).json({ success: false, message: 'Vaga não encontrada.' });
        }

        if (vaga.empresaId.toString() !== empresaId) {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }

        res.json({ 
            success: true, 
            candidatos: vaga.candidatos,
            profissionaisAceitos: vaga.profissionaisAceitos,
            quantidadeNecessaria: vaga.quantidade,
            quantidadeAceita: vaga.profissionaisAceitos.length
        });
    } catch (error) {
        console.error('Erro ao buscar candidatos:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Aceitar/Rejeitar Candidato
app.post('/api/vagas-relampago/:vagaId/candidatos/:candidatoId/avaliar', authMiddleware, async (req, res) => {
    try {
        const { vagaId, candidatoId } = req.params;
        const { acao } = req.body; // 'aceitar' ou 'rejeitar'
        const empresaId = req.user.id;

        const vaga = await VagaRelampago.findById(vagaId);
        if (!vaga) {
            return res.status(404).json({ success: false, message: 'Vaga não encontrada.' });
        }

        if (vaga.empresaId.toString() !== empresaId) {
            return res.status(403).json({ success: false, message: 'Apenas a empresa pode avaliar candidatos.' });
        }

        if (vaga.status !== 'aberta') {
            return res.status(400).json({ success: false, message: 'Esta vaga não está mais aceitando candidatos.' });
        }

        // Verifica se já tem profissionais suficientes
        if (acao === 'aceitar' && vaga.profissionaisAceitos.length >= vaga.quantidade) {
            return res.status(400).json({ success: false, message: 'Todas as vagas já foram preenchidas.' });
        }

        const candidato = vaga.candidatos.id(candidatoId);
        if (!candidato) {
            return res.status(404).json({ success: false, message: 'Candidato não encontrado.' });
        }

        if (acao === 'aceitar') {
            candidato.status = 'aceito';
            if (!vaga.profissionaisAceitos.includes(candidato.profissionalId)) {
                vaga.profissionaisAceitos.push(candidato.profissionalId);
            }

            // Se preencheu todas as vagas, fecha a vaga
            if (vaga.profissionaisAceitos.length >= vaga.quantidade) {
                vaga.status = 'em_andamento';
            }
        } else if (acao === 'rejeitar') {
            candidato.status = 'rejeitado';
        }

        await vaga.save();
        
        res.json({ 
            success: true, 
            message: acao === 'aceitar' ? 'Candidato aceito!' : 'Candidato rejeitado.',
            vagasRestantes: Math.max(0, vaga.quantidade - vaga.profissionaisAceitos.length)
        });
    } catch (error) {
        console.error('Erro ao avaliar candidato:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar Vagas-Relâmpago da Empresa
app.get('/api/vagas-relampago/empresa/minhas', authMiddleware, async (req, res) => {
    try {
        const empresaId = req.user.id;

        const empresa = await User.findById(empresaId);
        if (!empresa || empresa.tipo !== 'empresa') {
            return res.status(403).json({ success: false, message: 'Apenas empresas podem ver suas vagas.' });
        }

        const vagas = await VagaRelampago.find({ empresaId })
            .populate('candidatos.profissionalId', 'nome foto avatarUrl atuacao cidade estado gamificacao')
            .populate('profissionaisAceitos', 'nome foto avatarUrl atuacao cidade estado gamificacao')
            .sort({ createdAt: -1 })
            .exec();

        res.json({ success: true, vagas });
    } catch (error) {
        console.error('Erro ao buscar vagas da empresa:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🆕 NOVO: Rotas de Times Locais (COMPATIBILIDADE - mantido para não quebrar código existente)
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

// Listar serviços ativos de pedidos urgentes para o profissional (propostas aceitas)
app.get('/api/pedidos-urgentes/ativos', authMiddleware, async (req, res) => {
    try {
        const profissionalId = req.user.id;

        const profissional = await User.findById(profissionalId);
        if (!profissional || profissional.tipo !== 'trabalhador') {
            return res.status(403).json({ success: false, message: 'Apenas profissionais podem ver serviços ativos.' });
        }

        const pedidos = await PedidoUrgente.find({
            status: 'em_andamento',
            'propostas.profissionalId': profissionalId,
            'propostas.status': 'aceita'
        })
            .populate('clienteId', 'nome foto avatarUrl cidade estado telefone')
            .sort({ updatedAt: -1 })
            .exec();

        res.json({ success: true, pedidos });
    } catch (error) {
        console.error('Erro ao buscar serviços ativos de pedidos urgentes:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Profissional marca serviço de pedido urgente como concluído
app.post('/api/pedidos-urgentes/:pedidoId/concluir-servico', authMiddleware, async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const profissionalId = req.user.id;

        const profissional = await User.findById(profissionalId);
        if (!profissional || profissional.tipo !== 'trabalhador') {
            return res.status(403).json({ success: false, message: 'Apenas profissionais podem marcar serviço como concluído.' });
        }

        const pedido = await PedidoUrgente.findById(pedidoId);
        if (!pedido) {
            return res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
        }

        if (pedido.status !== 'em_andamento') {
            return res.status(400).json({ success: false, message: 'Somente serviços em andamento podem ser concluídos.' });
        }

        const propostaAceita = pedido.propostas.id(pedido.propostaSelecionada);
        if (!propostaAceita || propostaAceita.profissionalId.toString() !== profissionalId) {
            return res.status(403).json({ success: false, message: 'Você não é o profissional responsável por este serviço.' });
        }

        // Marca pedido como concluído
        pedido.status = 'concluido';
        await pedido.save();

        // Marca agendamento (se existir) como concluído
        if (pedido.agendamentoId) {
            await Agendamento.findByIdAndUpdate(pedido.agendamentoId, { status: 'concluido' });
        }

        // Notifica o cliente que o serviço foi concluído (para avaliar)
        try {
            const titulo = 'Serviço concluído! Conte como foi 🙂';
            const mensagem = `O profissional concluiu o serviço: ${pedido.servico}. Deixe sua avaliação para ajudar a comunidade.`;
            await criarNotificacao(
                pedido.clienteId,
                'servico_concluido',
                titulo,
                mensagem,
                {
                    profissionalId: propostaAceita.profissionalId,
                    agendamentoId: pedido.agendamentoId || null,
                    pedidoId: pedido._id,
                    foto: pedido.foto || null
                },
                null
            );
        } catch (notifError) {
            console.error('Erro ao criar notificação de serviço concluído:', notifError);
        }

        res.json({ success: true, message: 'Serviço marcado como concluído.' });
    } catch (error) {
        console.error('Erro ao concluir serviço de pedido urgente:', error);
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


// 💰 NOVO: Rotas de Pagamento Seguro Helpy (Escrow) - EXPANDIDO
// Criar pagamento seguro (suporta todos os tipos de serviços)
app.post('/api/pagamento-seguro', authMiddleware, async (req, res) => {
    try {
        const { 
            tipoServico, // 'agendamento', 'pedido_urgente', 'vaga_relampago', 'projeto_time'
            agendamentoId, 
            pedidoUrgenteId,
            vagaRelampagoId,
            projetoTimeId,
            valor, 
            metodoPagamento,
            taxaPlataforma: taxaCustomizada // Opcional, padrão 5%
        } = req.body;
        const clienteId = req.user.id;
        
        if (!tipoServico || !valor) {
            return res.status(400).json({ success: false, message: 'Tipo de serviço e valor são obrigatórios.' });
        }

        let profissionalId = null;
        let referenciaId = null;

        // Busca profissional e valida acesso baseado no tipo de serviço
        switch (tipoServico) {
            case 'agendamento':
                if (!agendamentoId) {
                    return res.status(400).json({ success: false, message: 'ID do agendamento é obrigatório.' });
                }
                const agendamento = await Agendamento.findById(agendamentoId);
                if (!agendamento || agendamento.clienteId.toString() !== clienteId) {
                    return res.status(403).json({ success: false, message: 'Agendamento não encontrado ou acesso negado.' });
                }
                profissionalId = agendamento.profissionalId;
                referenciaId = agendamentoId;
                break;

            case 'pedido_urgente':
                if (!pedidoUrgenteId) {
                    return res.status(400).json({ success: false, message: 'ID do pedido urgente é obrigatório.' });
                }
                const pedidoUrgente = await PedidoUrgente.findById(pedidoUrgenteId);
                if (!pedidoUrgente || pedidoUrgente.clienteId.toString() !== clienteId) {
                    return res.status(403).json({ success: false, message: 'Pedido urgente não encontrado ou acesso negado.' });
                }
                if (!pedidoUrgente.propostaSelecionada) {
                    return res.status(400).json({ success: false, message: 'Nenhuma proposta foi aceita ainda.' });
                }
                const propostaAceita = pedidoUrgente.propostas.id(pedidoUrgente.propostaSelecionada);
                if (!propostaAceita || propostaAceita.status !== 'aceita') {
                    return res.status(400).json({ success: false, message: 'Proposta aceita não encontrada.' });
                }
                profissionalId = propostaAceita.profissionalId;
                referenciaId = pedidoUrgenteId;
                break;

            case 'vaga_relampago':
                if (!vagaRelampagoId) {
                    return res.status(400).json({ success: false, message: 'ID da vaga-relâmpago é obrigatório.' });
                }
                // Para vagas-relâmpago, o profissional já foi aceito pela empresa
                // O pagamento é feito pela empresa, não pelo cliente individual
                // Mas vamos manter flexível para casos futuros
                return res.status(400).json({ success: false, message: 'Pagamento de vagas-relâmpago será implementado em breve.' });
            
            case 'projeto_time':
                if (!projetoTimeId) {
                    return res.status(400).json({ success: false, message: 'ID do projeto de time é obrigatório.' });
                }
                const projetoTime = await ProjetoTime.findById(projetoTimeId);
                if (!projetoTime || projetoTime.clienteId.toString() !== clienteId) {
                    return res.status(403).json({ success: false, message: 'Projeto não encontrado ou acesso negado.' });
                }
                // Para projetos de time, o pagamento é feito ao time, não a um profissional individual
                return res.status(400).json({ success: false, message: 'Pagamento de projetos de time será implementado em breve.' });

            default:
                return res.status(400).json({ success: false, message: 'Tipo de serviço inválido.' });
        }

        // Calcula taxa da plataforma (padrão 5%, pode ser customizada)
        const taxa = taxaCustomizada || 0.05;
        const taxaPlataforma = valor * taxa;
        const valorLiquido = valor - taxaPlataforma; // Valor que o profissional recebe
        
        // Verifica se já existe pagamento para este serviço
        let queryPagamentoExistente = {};
        switch (tipoServico) {
            case 'agendamento':
                queryPagamentoExistente = { agendamentoId: referenciaId };
                break;
            case 'pedido_urgente':
                queryPagamentoExistente = { pedidoUrgenteId: referenciaId };
                break;
        }

        const pagamentoExistente = await PagamentoSeguro.findOne({
            ...queryPagamentoExistente,
            status: { $in: ['pendente', 'pago'] }
        });

        if (pagamentoExistente) {
            return res.status(400).json({ success: false, message: 'Já existe um pagamento seguro para este serviço.' });
        }
        
        const pagamento = new PagamentoSeguro({
            tipoServico,
            agendamentoId: tipoServico === 'agendamento' ? referenciaId : undefined,
            pedidoUrgenteId: tipoServico === 'pedido_urgente' ? referenciaId : undefined,
            clienteId,
            profissionalId,
            valor,
            taxaPlataforma,
            valorLiquido,
            metodoPagamento: metodoPagamento || 'cartao_credito',
            status: 'pago', // Em produção, seria 'pendente' até confirmação do gateway de pagamento
            dataPagamento: new Date(),
            temGarantiaHelpy: true
            // 💳 INTEGRAÇÃO COM GATEWAY DE PAGAMENTO
            // Exemplo com Stripe:
            // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
            // const paymentIntent = await stripe.paymentIntents.create({
            //     amount: Math.round(valorTotal * 100), // Stripe usa centavos
            //     currency: 'brl',
            //     payment_method: metodoPagamento, // ID do método de pagamento do cliente
            //     confirm: true,
            //     metadata: {
            //         pagamentoId: pagamento._id.toString(),
            //         clienteId: clienteId.toString(),
            //         profissionalId: profissionalId.toString()
            //     }
            // });
            // pagamento.transacaoId = paymentIntent.id;
            // pagamento.status = paymentIntent.status === 'succeeded' ? 'pago' : 'pendente';
            
            // Exemplo com PagSeguro:
            // const pagseguro = require('pagseguro-nodejs');
            // const transaction = await pagseguro.transaction({
            //     paymentMode: 'default',
            //     paymentMethod: metodoPagamento,
            //     currency: 'BRL',
            //     itemId1: pagamento._id.toString(),
            //     itemDescription1: `Serviço ${tipoServico}`,
            //     itemAmount1: valorTotal.toFixed(2),
            //     itemQuantity1: 1,
            //     reference: pagamento._id.toString()
            // });
            // pagamento.transacaoId = transaction.code;
            // pagamento.status = transaction.status === '3' ? 'pago' : 'pendente';
            
            // Exemplo com Mercado Pago:
            // const mercadopago = require('mercadopago');
            // mercadopago.configure({ access_token: process.env.MP_ACCESS_TOKEN });
            // const payment = await mercadopago.payment.save({
            //     transaction_amount: valorTotal,
            //     token: metodoPagamento, // Token do cartão
            //     description: `Serviço ${tipoServico}`,
            //     installments: 1,
            //     payment_method_id: 'visa',
            //     payer: { email: cliente.email }
            // });
            // pagamento.transacaoId = payment.body.id;
            // pagamento.status = payment.body.status === 'approved' ? 'pago' : 'pendente';
        });
        
        await pagamento.save();

        // 📊 Registra histórico
        await registrarHistoricoTransacao(
            pagamento._id,
            'criado',
            clienteId,
            {},
            { status: 'pago', valor, valorLiquido },
            req
        );

        // 🔔 Notifica o profissional que o pagamento está garantido
        await criarNotificacao(
            profissionalId,
            'pagamento_garantido',
            '💰 Pagamento Garantido!',
            `Um cliente garantiu o pagamento de R$ ${valor.toFixed(2)}. Você receberá R$ ${valorLiquido.toFixed(2)} após concluir o serviço.`,
            { pagamentoId: pagamento._id, valor, valorLiquido },
            '/pagamentos-garantidos'
        );

        // Atualiza status do serviço para indicar que tem pagamento garantido
        if (tipoServico === 'agendamento') {
            await Agendamento.findByIdAndUpdate(referenciaId, { status: 'confirmado' });
        } else if (tipoServico === 'pedido_urgente') {
            await PedidoUrgente.findByIdAndUpdate(referenciaId, { status: 'em_andamento' });
        }
        
        res.status(201).json({ 
            success: true, 
            message: 'Pagamento seguro criado! O profissional foi notificado que o pagamento está garantido.',
            pagamento: {
                ...pagamento.toObject(),
                valorLiquido,
                taxaPlataforma: taxaPlataforma.toFixed(2)
            }
        });
    } catch (error) {
        console.error('Erro ao criar pagamento seguro:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Liberar pagamento (quando cliente marca como concluído) - EXPANDIDO
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
        
        const dadosAntes = { status: pagamento.status };
        pagamento.status = 'liberado';
        pagamento.dataLiberacao = new Date();
        await pagamento.save();
        
        // 📊 Registra histórico
        await registrarHistoricoTransacao(
            pagamentoId,
            'liberado',
            userId,
            dadosAntes,
            { status: 'liberado', dataLiberacao: pagamento.dataLiberacao },
            req
        );

        // 🔔 Notifica o profissional que o pagamento foi liberado
        await criarNotificacao(
            pagamento.profissionalId,
            'pagamento_liberado',
            '✅ Pagamento Liberado!',
            `O cliente liberou o pagamento de R$ ${pagamento.valor.toFixed(2)}. Você receberá R$ ${(pagamento.valorLiquido || (pagamento.valor - pagamento.taxaPlataforma)).toFixed(2)}.`,
            { pagamentoId: pagamento._id, valor: pagamento.valor, valorLiquido: pagamento.valorLiquido },
            '/pagamentos-garantidos'
        );
        
        // Atualiza status do serviço baseado no tipo
        if (pagamento.tipoServico === 'agendamento' && pagamento.agendamentoId) {
            const agendamento = await Agendamento.findById(pagamento.agendamentoId);
            if (agendamento) {
                agendamento.status = 'concluido';
                await agendamento.save();
            }
        } else if (pagamento.tipoServico === 'pedido_urgente' && pagamento.pedidoUrgenteId) {
            const pedidoUrgente = await PedidoUrgente.findById(pagamento.pedidoUrgenteId);
            if (pedidoUrgente) {
                pedidoUrgente.status = 'concluido';
                await pedidoUrgente.save();
            }
        }

        // 💰 NOVO: Adiciona XP EXTRA para serviços com Garantia Helpy
        if (pagamento.temGarantiaHelpy) {
            // XP em dobro para serviços com garantia Helpy
            const xpBase = 50; // XP base por serviço concluído
            const xpExtra = xpBase * 2; // XP em dobro
            await adicionarXP(pagamento.profissionalId, xpExtra, `Serviço concluído com Garantia Helpy`);
        }
        
        res.json({ 
            success: true, 
            message: 'Pagamento liberado com sucesso! O profissional recebeu XP extra por usar a Garantia Helpy.',
            pagamento: {
                ...pagamento.toObject(),
                valorLiquido: pagamento.valorLiquido || (pagamento.valor - pagamento.taxaPlataforma)
            }
        });
    } catch (error) {
        console.error('Erro ao liberar pagamento:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 💰 NOVO: Reembolsar pagamento (se cliente cancelar antes do serviço)
app.post('/api/pagamento-seguro/:pagamentoId/reembolsar', authMiddleware, async (req, res) => {
    try {
        const { pagamentoId } = req.params;
        const userId = req.user.id;
        const { motivo } = req.body;
        
        const pagamento = await PagamentoSeguro.findById(pagamentoId);
        if (!pagamento) {
            return res.status(404).json({ success: false, message: 'Pagamento não encontrado.' });
        }
        
        // Só cliente pode solicitar reembolso
        if (pagamento.clienteId.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        
        if (pagamento.status !== 'pago') {
            return res.status(400).json({ success: false, message: 'Apenas pagamentos pagos podem ser reembolsados.' });
        }
        
        const dadosAntes = { status: pagamento.status };
        
        // 💳 INTEGRAÇÃO COM GATEWAY DE PAGAMENTO
        // Exemplo com Stripe:
        // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        // const refund = await stripe.refunds.create({ 
        //     payment_intent: pagamento.transacaoId,
        //     amount: Math.round(pagamento.valor * 100) // Stripe usa centavos
        // });
        // pagamento.transacaoIdReembolso = refund.id;
        
        // Exemplo com PagSeguro:
        // const pagseguro = require('pagseguro-nodejs');
        // const refund = await pagseguro.refund({
        //     transactionCode: pagamento.transacaoId,
        //     refundValue: pagamento.valor
        // });
        
        // Exemplo com Mercado Pago:
        // const mercadopago = require('mercadopago');
        // mercadopago.configure({ access_token: process.env.MP_ACCESS_TOKEN });
        // const refund = await mercadopago.payment.refund(pagamento.transacaoId);
        
        pagamento.status = 'reembolsado';
        await pagamento.save();
        
        // 📊 Registra histórico
        await registrarHistoricoTransacao(
            pagamentoId,
            'reembolsado',
            userId,
            dadosAntes,
            { status: 'reembolsado', motivo },
            req
        );

        // 🔔 Notifica ambos os usuários sobre o reembolso
        await criarNotificacao(
            pagamento.clienteId,
            'pagamento_reembolsado',
            '💸 Reembolso Processado',
            `Seu reembolso de R$ ${pagamento.valor.toFixed(2)} foi processado. O valor será devolvido em até 5 dias úteis.`,
            { pagamentoId: pagamento._id, valor: pagamento.valor },
            '/meus-pagamentos'
        );

        await criarNotificacao(
            pagamento.profissionalId,
            'pagamento_reembolsado',
            '⚠️ Pagamento Reembolsado',
            `O pagamento de R$ ${pagamento.valor.toFixed(2)} foi reembolsado ao cliente.`,
            { pagamentoId: pagamento._id, valor: pagamento.valor },
            '/pagamentos-garantidos'
        );
        
        // Atualiza status do serviço
        if (pagamento.tipoServico === 'agendamento' && pagamento.agendamentoId) {
            await Agendamento.findByIdAndUpdate(pagamento.agendamentoId, { status: 'cancelado' });
        } else if (pagamento.tipoServico === 'pedido_urgente' && pagamento.pedidoUrgenteId) {
            await PedidoUrgente.findByIdAndUpdate(pagamento.pedidoUrgenteId, { status: 'cancelado' });
        }
        
        res.json({ 
            success: true, 
            message: 'Reembolso processado. O valor será devolvido em até 5 dias úteis.',
            pagamento 
        });
    } catch (error) {
        console.error('Erro ao reembolsar pagamento:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar pagamentos do profissional - EXPANDIDO
app.get('/api/pagamento-seguro/profissional', authMiddleware, async (req, res) => {
    try {
        const profissionalId = req.user.id;
        const { status } = req.query; // Filtro opcional por status
        
        let query = { profissionalId };
        if (status) {
            query.status = status;
        }
        
        const pagamentos = await PagamentoSeguro.find(query)
            .populate('clienteId', 'nome foto avatarUrl')
            .populate('agendamentoId')
            .populate('pedidoUrgenteId')
            .sort({ createdAt: -1 })
            .exec();
        
        // Calcula totais
        const totalRecebido = pagamentos
            .filter(p => p.status === 'liberado')
            .reduce((sum, p) => sum + (p.valorLiquido || (p.valor - p.taxaPlataforma)), 0);
        
        const totalAReceber = pagamentos
            .filter(p => p.status === 'pago')
            .reduce((sum, p) => sum + (p.valorLiquido || (p.valor - p.taxaPlataforma)), 0);
        
        res.json({ 
            success: true, 
            pagamentos,
            resumo: {
                totalRecebido: totalRecebido.toFixed(2),
                totalAReceber: totalAReceber.toFixed(2),
                totalPagamentos: pagamentos.length
            }
        });
    } catch (error) {
        console.error('Erro ao buscar pagamentos:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar pagamentos do cliente - EXPANDIDO
app.get('/api/pagamento-seguro/cliente', authMiddleware, async (req, res) => {
    try {
        const clienteId = req.user.id;
        const { status } = req.query; // Filtro opcional por status
        
        let query = { clienteId };
        if (status) {
            query.status = status;
        }
        
        const pagamentos = await PagamentoSeguro.find(query)
            .populate('profissionalId', 'nome foto avatarUrl atuacao gamificacao')
            .populate('agendamentoId')
            .populate('pedidoUrgenteId')
            .sort({ createdAt: -1 })
            .exec();
        
        res.json({ success: true, pagamentos });
    } catch (error) {
        console.error('Erro ao buscar pagamentos:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 💰 NOVO: Verificar se serviço tem pagamento garantido
app.get('/api/pagamento-seguro/verificar/:tipoServico/:servicoId', authMiddleware, async (req, res) => {
    try {
        const { tipoServico, servicoId } = req.params;
        const userId = req.user.id;
        
        let query = {};
        switch (tipoServico) {
            case 'agendamento':
                query = { agendamentoId: servicoId };
                break;
            case 'pedido_urgente':
                query = { pedidoUrgenteId: servicoId };
                break;
            default:
                return res.status(400).json({ success: false, message: 'Tipo de serviço inválido.' });
        }
        
        const pagamento = await PagamentoSeguro.findOne(query)
            .populate('clienteId', 'nome')
            .populate('profissionalId', 'nome')
            .exec();
        
        if (!pagamento) {
            return res.json({ success: true, temPagamento: false });
        }
        
        // Verifica se o usuário tem acesso a este pagamento
        const temAcesso = pagamento.clienteId._id.toString() === userId || 
                         pagamento.profissionalId._id.toString() === userId;
        
        if (!temAcesso) {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        
        res.json({ 
            success: true, 
            temPagamento: true,
            pagamento: {
                status: pagamento.status,
                valor: pagamento.valor,
                valorLiquido: pagamento.valorLiquido || (pagamento.valor - pagamento.taxaPlataforma),
                taxaPlataforma: pagamento.taxaPlataforma,
                temGarantiaHelpy: pagamento.temGarantiaHelpy,
                dataPagamento: pagamento.dataPagamento,
                dataLiberacao: pagamento.dataLiberacao
            }
        });
    } catch (error) {
        console.error('Erro ao verificar pagamento:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🔔 NOVO: Rotas de Notificações
// Listar notificações do usuário
app.get('/api/notificacoes', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { lida, limit = 50 } = req.query;
        
        let query = { userId };
        if (lida !== undefined) {
            query.lida = lida === 'true';
        }
        
        const notificacoes = await Notificacao.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .exec();
        
        const naoLidas = await Notificacao.countDocuments({ userId, lida: false });
        
        res.json({ 
            success: true, 
            notificacoes,
            totalNaoLidas: naoLidas
        });
    } catch (error) {
        console.error('Erro ao buscar notificações:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Marcar notificação como lida
app.put('/api/notificacoes/:notificacaoId/lida', authMiddleware, async (req, res) => {
    try {
        const { notificacaoId } = req.params;
        const userId = req.user.id;
        
        const notificacao = await Notificacao.findById(notificacaoId);
        if (!notificacao || notificacao.userId.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'Notificação não encontrada.' });
        }
        
        notificacao.lida = true;
        notificacao.dataLeitura = new Date();
        await notificacao.save();
        
        res.json({ success: true, notificacao });
    } catch (error) {
        console.error('Erro ao marcar notificação como lida:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Marcar todas as notificações como lidas
app.put('/api/notificacoes/marcar-todas-lidas', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        
        await Notificacao.updateMany(
            { userId, lida: false },
            { lida: true, dataLeitura: new Date() }
        );
        
        res.json({ success: true, message: 'Todas as notificações foram marcadas como lidas.' });
    } catch (error) {
        console.error('Erro ao marcar notificações como lidas:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Deletar todas as notificações do usuário
app.delete('/api/notificacoes', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { ids } = req.body; // Array de IDs para deletar específicas
        
        let query = { userId };
        if (ids && Array.isArray(ids) && ids.length > 0) {
            // Deleta apenas as notificações especificadas
            query._id = { $in: ids };
        }
        // Se não passar ids, deleta todas
        
        const resultado = await Notificacao.deleteMany(query);
        
        res.json({ 
            success: true, 
            message: ids && ids.length > 0 ? 'Notificações selecionadas foram deletadas.' : 'Todas as notificações foram deletadas.',
            deletadas: resultado.deletedCount
        });
    } catch (error) {
        console.error('Erro ao deletar notificações:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// ⚖️ NOVO: Rotas de Disputas
// Criar disputa
app.post('/api/disputas', authMiddleware, async (req, res) => {
    try {
        const { pagamentoId, tipo, motivo, evidencias } = req.body;
        const criadorId = req.user.id;
        
        const pagamento = await PagamentoSeguro.findById(pagamentoId);
        if (!pagamento) {
            return res.status(404).json({ success: false, message: 'Pagamento não encontrado.' });
        }
        
        // Verifica se o usuário tem direito de criar disputa
        const podeCriarDisputa = pagamento.clienteId.toString() === criadorId || 
                                 pagamento.profissionalId.toString() === criadorId;
        if (!podeCriarDisputa) {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        
        // Verifica se já existe disputa aberta
        const disputaExistente = await Disputa.findOne({ 
            pagamentoId, 
            status: { $in: ['aberta', 'em_analise'] } 
        });
        if (disputaExistente) {
            return res.status(400).json({ success: false, message: 'Já existe uma disputa aberta para este pagamento.' });
        }
        
        // Só pode criar disputa se pagamento está pago mas não liberado
        if (pagamento.status !== 'pago') {
            return res.status(400).json({ success: false, message: 'Apenas pagamentos garantidos podem ter disputas.' });
        }
        
        const disputa = new Disputa({
            pagamentoId,
            criadorId,
            tipo,
            motivo,
            evidencias: evidencias || []
        });
        
        await disputa.save();
        
        // 📊 Registra histórico
        await registrarHistoricoTransacao(
            pagamentoId,
            'disputa_aberta',
            criadorId,
            {},
            { disputaId: disputa._id, tipo, motivo },
            req
        );
        
        // 🔔 Notifica ambos os usuários sobre a disputa
        const outroUsuario = pagamento.clienteId.toString() === criadorId ? 
                           pagamento.profissionalId : pagamento.clienteId;
        
        await criarNotificacao(
            outroUsuario,
            'disputa_aberta',
            '⚖️ Disputa Aberta',
            `Uma disputa foi aberta para o pagamento de R$ ${pagamento.valor.toFixed(2)}. Nossa equipe analisará o caso.`,
            { disputaId: disputa._id, pagamentoId },
            '/disputas'
        );
        
        res.status(201).json({ success: true, message: 'Disputa criada com sucesso!', disputa });
    } catch (error) {
        console.error('Erro ao criar disputa:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar disputas do usuário
app.get('/api/disputas', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Busca disputas onde o usuário é cliente ou profissional do pagamento
        const pagamentos = await PagamentoSeguro.find({
            $or: [{ clienteId: userId }, { profissionalId: userId }]
        }).select('_id');
        
        const pagamentoIds = pagamentos.map(p => p._id);
        
        const disputas = await Disputa.find({ pagamentoId: { $in: pagamentoIds } })
            .populate('pagamentoId')
            .populate('criadorId', 'nome foto avatarUrl')
            .populate('resolvidoPor', 'nome')
            .sort({ createdAt: -1 })
            .exec();
        
        res.json({ success: true, disputas });
    } catch (error) {
        console.error('Erro ao buscar disputas:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Resolver disputa (apenas admin)
app.post('/api/disputas/:disputaId/resolver', authMiddleware, async (req, res) => {
    try {
        const { disputaId } = req.params;
        const { resolucao, favoravelA } = req.body; // 'cliente' ou 'profissional'
        const adminId = req.user.id;
        
        // Verificar se usuário é admin
        const user = await User.findById(adminId);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ success: false, message: 'Apenas administradores podem resolver disputas.' });
        }
        
        const disputa = await Disputa.findById(disputaId)
            .populate('pagamentoId');
        
        if (!disputa) {
            return res.status(404).json({ success: false, message: 'Disputa não encontrada.' });
        }
        
        if (disputa.status !== 'aberta' && disputa.status !== 'em_analise') {
            return res.status(400).json({ success: false, message: 'Esta disputa já foi resolvida.' });
        }
        
        const pagamento = disputa.pagamentoId;
        
        // Resolve a disputa
        disputa.status = favoravelA === 'cliente' ? 'resolvida_cliente' : 'resolvida_profissional';
        disputa.resolucao = resolucao;
        disputa.resolvidoPor = adminId;
        disputa.dataResolucao = new Date();
        await disputa.save();
        
        // Atualiza pagamento baseado na resolução
        if (favoravelA === 'cliente') {
            // Reembolsa o cliente
            pagamento.status = 'reembolsado';
            await pagamento.save();
        } else {
            // Libera para o profissional
            pagamento.status = 'liberado';
            pagamento.dataLiberacao = new Date();
            await pagamento.save();
        }
        
        // 📊 Registra histórico
        await registrarHistoricoTransacao(
            pagamento._id,
            'disputa_resolvida',
            adminId,
            { status: 'pago' },
            { status: pagamento.status, resolucao },
            req
        );
        
        // 🔔 Notifica ambos os usuários
        await criarNotificacao(
            pagamento.clienteId,
            'disputa_resolvida',
            '⚖️ Disputa Resolvida',
            `A disputa foi resolvida. ${resolucao}`,
            { disputaId: disputa._id, pagamentoId: pagamento._id },
            '/disputas'
        );
        
        await criarNotificacao(
            pagamento.profissionalId,
            'disputa_resolvida',
            '⚖️ Disputa Resolvida',
            `A disputa foi resolvida. ${resolucao}`,
            { disputaId: disputa._id, pagamentoId: pagamento._id },
            '/disputas'
        );
        
        res.json({ success: true, message: 'Disputa resolvida com sucesso!', disputa, pagamento });
    } catch (error) {
        console.error('Erro ao resolver disputa:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 📊 NOVO: Rotas de Histórico de Transações
// Obter histórico de um pagamento
app.get('/api/pagamento-seguro/:pagamentoId/historico', authMiddleware, async (req, res) => {
    try {
        const { pagamentoId } = req.params;
        const userId = req.user.id;
        
        const pagamento = await PagamentoSeguro.findById(pagamentoId);
        if (!pagamento) {
            return res.status(404).json({ success: false, message: 'Pagamento não encontrado.' });
        }
        
        // Verifica acesso
        if (pagamento.clienteId.toString() !== userId && pagamento.profissionalId.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        
        const historico = await HistoricoTransacao.find({ pagamentoId })
            .populate('realizadoPor', 'nome foto avatarUrl')
            .sort({ createdAt: -1 })
            .exec();
        
        res.json({ success: true, historico });
    } catch (error) {
        console.error('Erro ao buscar histórico:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 📈 NOVO: Dashboard Administrativo
app.get('/api/admin/dashboard', authMiddleware, async (req, res) => {
    try {
        const adminId = req.user.id;
        
        // Verificar se usuário é admin
        const user = await User.findById(adminId);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ success: false, message: 'Acesso negado. Apenas administradores podem acessar o dashboard.' });
        }
        
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const inicioAno = new Date(hoje.getFullYear(), 0, 1);
        
        // Estatísticas de pagamentos
        const [
            totalPagamentos,
            pagamentosMes,
            pagamentosAno,
            pagamentosPendentes,
            pagamentosLiberados,
            pagamentosReembolsados,
            totalReceitaMes,
            totalReceitaAno,
            disputasAbertas,
            disputasResolvidasMes
        ] = await Promise.all([
            PagamentoSeguro.countDocuments(),
            PagamentoSeguro.countDocuments({ createdAt: { $gte: inicioMes } }),
            PagamentoSeguro.countDocuments({ createdAt: { $gte: inicioAno } }),
            PagamentoSeguro.countDocuments({ status: 'pago' }),
            PagamentoSeguro.countDocuments({ status: 'liberado' }),
            PagamentoSeguro.countDocuments({ status: 'reembolsado' }),
            PagamentoSeguro.aggregate([
                { $match: { status: 'liberado', dataLiberacao: { $gte: inicioMes } } },
                { $group: { _id: null, total: { $sum: '$taxaPlataforma' } } }
            ]),
            PagamentoSeguro.aggregate([
                { $match: { status: 'liberado', dataLiberacao: { $gte: inicioAno } } },
                { $group: { _id: null, total: { $sum: '$taxaPlataforma' } } }
            ]),
            Disputa.countDocuments({ status: { $in: ['aberta', 'em_analise'] } }),
            Disputa.countDocuments({ status: { $in: ['resolvida_cliente', 'resolvida_profissional'] }, dataResolucao: { $gte: inicioMes } })
        ]);
        
        // Pagamentos recentes
        const pagamentosRecentes = await PagamentoSeguro.find()
            .populate('clienteId', 'nome foto avatarUrl')
            .populate('profissionalId', 'nome foto avatarUrl')
            .sort({ createdAt: -1 })
            .limit(10)
            .exec();
        
        // Disputas recentes
        const disputasRecentes = await Disputa.find()
            .populate('pagamentoId')
            .populate('criadorId', 'nome foto avatarUrl')
            .sort({ createdAt: -1 })
            .limit(10)
            .exec();
        
        res.json({
            success: true,
            dashboard: {
                estatisticas: {
                    totalPagamentos,
                    pagamentosMes,
                    pagamentosAno,
                    pagamentosPendentes,
                    pagamentosLiberados,
                    pagamentosReembolsados,
                    receitaMes: totalReceitaMes[0]?.total || 0,
                    receitaAno: totalReceitaAno[0]?.total || 0,
                    disputasAbertas,
                    disputasResolvidasMes
                },
                pagamentosRecentes,
                disputasRecentes
            }
        });
    } catch (error) {
        console.error('Erro ao buscar dashboard:', error);
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

// Rota não encontrada (404)
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Rota não encontrada',
        path: req.path
    });
});

// Middleware de tratamento de erros global (deve vir após todas as rotas)
app.use((err, req, res, next) => {
    console.error('Erro não tratado:', err);
    console.error('Stack trace:', err.stack);
    
    // Garante que sempre retorna JSON
    if (!res.headersSent) {
        // Se for um erro de validação do Mongoose
        if (err.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Erro de validação',
                errors: Object.values(err.errors).map(e => e.message)
            });
        }
        
        // Se for um erro de autenticação
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token inválido ou expirado'
            });
        }
        
        // Se for um erro do multer (upload de arquivo)
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'Arquivo muito grande. O tamanho máximo permitido é 10MB.'
            });
        }
        
        // Erro padrão
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Exporta o app
module.exports = app;

// Execução do servidor
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const HOST = process.env.HOST || '0.0.0.0';
  
  // Inicializa serviços antes de iniciar o servidor
  initializeServices().then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      if (process.env.DOMINIO) {
        console.log(`🌐 Domínio: ${process.env.DOMINIO}`);
      }
    });
  }).catch((error) => {
    console.error('❌ Erro ao inicializar serviços:', error);
    process.exit(1);
  });
}