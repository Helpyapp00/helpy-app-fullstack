document.addEventListener('DOMContentLoaded', () => {
    // --- Identificação do Usuário ---
    const urlParams = new URLSearchParams(window.location.search);
    let agendamentoIdAvaliacao = urlParams.get('agendamentoId') || urlParams.get('agendamento');
    let pedidoIdAvaliacao = urlParams.get('pedidoId') || urlParams.get('pedido');
    const origemAvaliacao = urlParams.get('origem') || '';
    const hashSecaoAvaliacao = window.location.hash && window.location.hash.includes('secao-avaliacao');
    const pedidoIdUltimoServicoConcluido = localStorage.getItem('pedidoIdUltimoServicoConcluido') || '';
    const agendamentoIdUltimoServico = localStorage.getItem('agendamentoIdUltimoServico') || '';
    
    // IMPORTANTE: Quando vem de notificação, NUNCA usa localStorage - cada serviço tem seu próprio pedidoId
    // Se não tem pedidoId/agendamentoId na URL quando vem de notificação, não usa localStorage
    // Isso garante que cada serviço seja verificado independentemente
    if (!pedidoIdAvaliacao && !agendamentoIdAvaliacao && hashSecaoAvaliacao) {
        // Só usa localStorage se NÃO veio de notificação explícita
        if (origemAvaliacao !== 'servico_concluido') {
            pedidoIdAvaliacao = pedidoIdUltimoServicoConcluido || '';
            agendamentoIdAvaliacao = agendamentoIdUltimoServico || '';
            console.log('🔍 Usando pedidoId/agendamentoId do localStorage (não veio de notificação):', { pedidoIdAvaliacao, agendamentoIdAvaliacao });
        } else {
            console.log('⚠️ Veio de notificação mas não tem pedidoId/agendamentoId na URL - NÃO usando localStorage (cada serviço tem seu próprio ID)');
            // Limpa o localStorage para não confundir com serviço anterior
            pedidoIdAvaliacao = '';
            agendamentoIdAvaliacao = '';
        }
    }
    
    // Verifica se veio de uma notificação de serviço concluído
    // Se tem hash de avaliação, considera como vindo de notificação (mesmo sem origem explícita)
    const veioDeNotificacao = origemAvaliacao === 'servico_concluido' || 
                               (hashSecaoAvaliacao && (agendamentoIdAvaliacao || pedidoIdAvaliacao)) ||
                               hashSecaoAvaliacao; // Se tem hash, provavelmente veio de notificação
    
    console.log('🔍 Debug notificação:', {
        pedidoIdDaURL: urlParams.get('pedidoId'),
        agendamentoIdDaURL: urlParams.get('agendamentoId'),
        origemAvaliacao,
        hashSecaoAvaliacao,
        agendamentoIdAvaliacao,
        pedidoIdAvaliacao,
        veioDeNotificacao,
        windowLocationHash: window.location.hash,
        windowLocationSearch: window.location.search,
        pedidoIdUltimoServicoConcluido,
        agendamentoIdUltimoServico,
        observacao: 'Cada serviço tem seu próprio pedidoId único - não pode usar localStorage'
    });
    
    // Só considera fluxo de serviço se houver parâmetros EXPLÍCITOS na URL OU veio de notificação
    const temParametrosExplicitos = !!(agendamentoIdAvaliacao || pedidoIdAvaliacao || origemAvaliacao === 'servico_concluido');
    let serviceScopeId = agendamentoIdAvaliacao || pedidoIdAvaliacao || '';
    
    // Se veio de notificação mas não tem serviceScopeId na URL, tenta usar do localStorage
    if (!serviceScopeId && veioDeNotificacao) {
        serviceScopeId = agendamentoIdUltimoServico || pedidoIdUltimoServicoConcluido || '';
    }
    
    // isFluxoServico é verdadeiro se:
    // 1. Tem origem explícita de serviço concluído OU
    // 2. Tem hash de avaliação E parâmetros explícitos (pedidoId/agendamentoId) OU
    // 3. Tem hash de avaliação E veio de notificação (mesmo sem pedidoId/agendamentoId explícito)
    const isFluxoServico = !!(origemAvaliacao === 'servico_concluido' || 
                              (hashSecaoAvaliacao && temParametrosExplicitos) ||
                              (hashSecaoAvaliacao && veioDeNotificacao));
    
    console.log('🔍 Debug fluxo:', {
        isFluxoServico,
        veioDeNotificacao,
        temParametrosExplicitos,
        serviceScopeId
    });

    // Captura o nome do serviço vindo via URL para uso posterior nos cards de avaliação
    const servicoParamUrl = urlParams.get('servico') || urlParams.get('titulo') || '';
    if (servicoParamUrl) {
        try {
            localStorage.setItem('ultimoServicoNome', servicoParamUrl);
            localStorage.setItem('ultimaDescricaoPedido', servicoParamUrl);
        } catch (e) {
            console.warn('Falha ao cachear servicoParamUrl', e);
        }
    }
    const loggedInUserId = localStorage.getItem('userId');
    // Suporte a slug em /perfil/:slug e também query ?id=...
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const slugFromPath = (pathParts.length >= 2 && pathParts[0] === 'perfil') ? pathParts[1] : null;
    const profileIdFromUrl = urlParams.get('id');
    let profileId = profileIdFromUrl || null; // resolve slug e, se faltar, cai para o logado
    let isOwnProfile = false;

    // Não limpar mais a URL para evitar confusão de identidade no cabeçalho
    
    const token = localStorage.getItem('jwtToken');
    const userType = localStorage.getItem('userType'); 

    if (!loggedInUserId || !token) {
        alert('Você precisa estar logado para acessar esta página.');
        window.location.href = '/login';
        return;
    }

    // --- Elementos do DOM (Header) ---
    const userAvatarHeader = document.getElementById('user-avatar-header');
    const userNameHeader = document.getElementById('user-name-header');
    const feedButton = document.getElementById('feed-button');
    const logoutButton = document.getElementById('logout-button');
    const logoBox = document.querySelector('.logo-box');
    const btnNotificacoes = document.getElementById('btn-notificacoes');
    const badgeNotificacoes = document.getElementById('badge-notificacoes');
    const modalNotificacoes = document.getElementById('modal-notificacoes');
    const listaNotificacoes = document.getElementById('lista-notificacoes');
    const btnMarcarTodasLidas = document.getElementById('btn-marcar-todas-lidas');
    const btnLimparNotificacoes = document.getElementById('btn-limpar-notificacoes');
    // Notificações agora são gerenciadas pelo header-notificacoes.js
    const profileButton = document.getElementById('profile-button'); // pode não existir; evita ReferenceError
    const btnAdicionarHorario = document.getElementById('btn-adicionar-horario');
    const formHorarios = document.getElementById('form-horarios');

    // --- Elementos do DOM (Card Principal) ---
    const fotoPerfil = document.getElementById('fotoPerfil');
    const nomePerfil = document.getElementById('nomePerfil');
    const mediaAvaliacaoContainer = document.getElementById('media-avaliacao-container');
    const mediaEstrelas = document.getElementById('mediaEstrelas');
    const totalAvaliacoes = document.getElementById('totalAvaliacoes');
    
    // Infos (Spans e Links)
    const emailPerfil = document.getElementById('emailPerfil'); 
    const telefonePerfil = document.getElementById('telefonePerfil');
    const idadePerfil = document.getElementById('idadePerfil');
    const atuacaoPerfil = document.getElementById('atuacaoPerfil');
    const atuacaoItem = document.getElementById('atuacao-item');
    const descricaoPerfil = document.getElementById('descricaoPerfil');
    
    // 🛑 ATUALIZAÇÃO: Seletores de Localização (agora juntos)
    const localizacaoPerfil = document.getElementById('localizacaoPerfil');
    const localizacaoItem = document.getElementById('localizacao-item');
    // Mantém compatibilidade com elementos antigos se existirem
    const cidadePerfil = document.getElementById('cidadePerfil');
    const estadoPerfil = document.getElementById('estadoPerfil');
    const cidadeItem = document.getElementById('cidade-item');
    const estadoItem = document.getElementById('estado-item');

    // Inputs de Edição (Ocultos)
    const labelInputFotoPerfil = document.getElementById('labelInputFotoPerfil');
    const inputFotoPerfil = document.getElementById('inputFotoPerfil');
    const inputNome = document.getElementById('inputNome');
    const inputEmail = document.getElementById('inputEmail');
    const inputIdade = document.getElementById('inputIdade');
    const inputWhatsapp = document.getElementById('inputWhatsapp');
    const inputAtuacao = document.getElementById('inputAtuacao');
    const inputDescricao = document.getElementById('inputDescricao');
    const inputCidade = document.getElementById('inputCidade');
    const inputEstado = document.getElementById('inputEstado');

    // Botões de Ação
    const btnEditarPerfil = document.getElementById('editarPerfilBtn'); 
    const botoesEdicao = document.querySelector('.botoes-edicao');
    const btnSalvarPerfil = document.getElementById('btnSalvarPerfil');
    const btnCancelarEdicao = document.getElementById('btnCancelarEdicao');

    // --- Elementos do DOM (Abas e Seções) ---
    const secaoServicos = document.getElementById('secao-servicos');
    const secaoPostagens = document.getElementById('secao-postagens');
    const mostrarServicosBtn = document.getElementById('mostrarServicosBtn');
    const mostrarPostagensBtn = document.getElementById('mostrarPostagensBtn');
    const galeriaServicos = document.getElementById('galeriaServicos');
    const addServicoBtn = document.getElementById('addServicoBtn');
    const inputFotoServico = document.getElementById('inputFotoServico'); 
    const minhasPostagensContainer = document.getElementById('minhasPostagens');
    
    // --- Elementos do DOM (Modais) ---
    const imageModal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const closeImageModalBtn = document.getElementById('close-image-modal');
    
    // --- Elementos do DOM (Avaliação) ---
    const secaoAvaliacao = document.getElementById('secao-avaliacao');
    const formAvaliacao = document.getElementById('formAvaliacao');
    const estrelasAvaliacao = document.querySelectorAll('#estrelas-avaliacao-input span');
    const notaSelecionada = document.getElementById('notaSelecionada');
    const comentarioAvaliacaoInput = document.getElementById('comentarioAvaliacaoInput');
    const btnEnviarAvaliacao = document.getElementById('btnEnviarAvaliacao');

    // --- Elementos do Modal de Pré-visualização de Avatar ---
    const modalPreviewAvatar = document.getElementById('modal-preview-avatar');
    const avatarPreviewArea = document.getElementById('avatar-preview-area');
    const avatarPreviewImg = document.getElementById('avatar-preview-img');
    const avatarPreviewCancelBtn = document.getElementById('avatar-preview-cancel');
    const avatarPreviewSaveBtn = document.getElementById('avatar-preview-save');
    
    // --- Elementos do DOM (Logout Modal) ---
    const logoutConfirmModal = document.getElementById('logout-confirm-modal');
    const confirmLogoutYesBtn = document.getElementById('confirm-logout-yes');
    const confirmLogoutNoBtn = document.getElementById('confirm-logout-no');

    // --- Clique no logo/nome "Helpy" vai para o feed (e recarrega se já estiver no feed) ---
    function irParaFeedOuRecarregar() {
        const currentPath = window.location.pathname;
        if (currentPath === '/' || currentPath === '/index.html') {
            window.location.reload();
        } else {
            window.location.href = '/';
        }
    }

    if (logoBox) {
        logoBox.addEventListener('click', irParaFeedOuRecarregar);
    }

    // --- Função para garantir que o logo seja carregado corretamente ---
    function loadLogo() {
        const logoImg = document.querySelector('.logo-box img');
        if (logoImg) {
            // Garante que o caminho está correto (tenta relativo e absoluto)
            const logoPaths = [
                'imagens/helpy-feed.png',
                '/imagens/helpy-feed.png',
                './imagens/helpy-feed.png'
            ];
            
            let currentPathIndex = 0;
            
            // Se a imagem não carregou ou deu erro, tenta outros caminhos
            logoImg.onerror = function() {
                currentPathIndex++;
                if (currentPathIndex < logoPaths.length) {
                    console.log(`🔄 Tentando carregar logo do caminho: ${logoPaths[currentPathIndex]}`);
                    logoImg.src = logoPaths[currentPathIndex] + '?t=' + Date.now();
                } else {
                    console.error('❌ Não foi possível carregar o logo de nenhum caminho disponível');
                }
            };
            
            // Verifica se a imagem já foi carregada corretamente
            if (!logoImg.complete || logoImg.naturalHeight === 0) {
                // Se não carregou, força reload com o primeiro caminho
                logoImg.src = logoPaths[0] + '?t=' + Date.now();
            }
            
            // Garante que a imagem está visível
            logoImg.style.display = '';
            logoImg.style.visibility = 'visible';
        }
    }
    
    // Carrega o logo quando a página estiver pronta
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadLogo);
    } else {
        loadLogo();
    }

    // ===== Notificações removidas - agora gerenciadas pelo header-notificacoes.js =====
    // Todo o código de notificações foi movido para header-notificacoes.js para evitar conflitos
    // Removido: carregarNotificacoesPerfil, handleClickLixeira, configurarBotaoLixeira, toggleModoSelecao, etc.
    
    /*
    async function carregarNotificacoesPerfil() {
        if ((!badgeNotificacoes && !listaNotificacoes) || !token || !loggedInUserId) return;
        try {
            const resp = await fetch('/api/notificacoes?limit=50', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            if (!data.success) throw new Error(data.message || 'Erro ao carregar');

            // Badge
            if (badgeNotificacoes) {
                if (data.totalNaoLidas > 0) {
                    badgeNotificacoes.textContent = data.totalNaoLidas > 99 ? '99+' : data.totalNaoLidas;
                    badgeNotificacoes.style.display = 'flex';
                } else {
                    badgeNotificacoes.style.display = 'none';
                }
            }

            // Lista, se modal aberto
            if (listaNotificacoes && modalNotificacoes && !modalNotificacoes.classList.contains('hidden')) {
                const notificacoes = data.notificacoes || [];
                if (notificacoes.length === 0) {
                    listaNotificacoes.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-secondary);">Nenhuma notificação.</p>';
                } else {
                    const iconMap = {
                        pagamento_garantido: '💰',
                        pagamento_liberado: '✅',
                        pagamento_reembolsado: '💸',
                        disputa_aberta: '⚖️',
                        disputa_resolvida: '⚖️',
                        proposta_aceita: '🎉',
                        proposta_pedido_urgente: '💼',
                        pedido_urgente: '⚡',
                        servico_concluido: '✨',
                        avaliacao_recebida: '⭐'
                    };
                    listaNotificacoes.innerHTML = notificacoes.map(notif => {
                        const dataFmt = new Date(notif.createdAt).toLocaleString('pt-BR');
                        const isSelecionada = notificacoesSelecionadas.has(notif._id);
                        const modoSelecaoClass = modoSelecao ? 'modo-selecao' : '';
                        const selecionadaClass = isSelecionada ? 'selecionada' : '';
                        const paddingLeft = modoSelecao ? '35px' : '15px';
                        return `
                            <div class="notificacao-card ${notif.lida ? '' : 'nao-lida'} ${modoSelecaoClass} ${selecionadaClass}" data-notif-id="${notif._id}">
                                <div style="display: flex; gap: 15px; align-items: flex-start; padding-left: ${paddingLeft};">
                                    <div style="font-size: 24px;">${iconMap[notif.tipo] || '🔔'}</div>
                                    <div style="flex: 1;">
                                        <strong>${notif.titulo || 'Notificação'}</strong>
                                        <p style="margin: 5px 0; color: var(--text-secondary);">${notif.mensagem || ''}</p>
                                        <small style="color: var(--text-secondary);">${dataFmt}</small>
                                    </div>
                                    ${!notif.lida ? '<span style="background: #007bff; width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-top: 5px;"></span>' : ''}
                                </div>
                            </div>
                        `;
                    }).join('');

                    // Clique em cada notificação
                    document.querySelectorAll('.notificacao-card').forEach(card => {
                        card.addEventListener('click', async (e) => {
                            const notifId = card.dataset.notifId;
                            if (!notifId) return;
                            
                            // Se estiver em modo de seleção, apenas seleciona/desseleciona
                            if (modoSelecao) {
                                e.stopPropagation();
                                if (notificacoesSelecionadas.has(notifId)) {
                                    notificacoesSelecionadas.delete(notifId);
                                    card.classList.remove('selecionada');
                                } else {
                                    notificacoesSelecionadas.add(notifId);
                                    card.classList.add('selecionada');
                                }
                                atualizarBotaoSelecionarTudo();
                                return;
                            }
                            
                            // Comportamento normal quando não está em modo de seleção
                            try {
                                await fetch(`/api/notificacoes/${notifId}/lida`, {
                                    method: 'PUT',
                                    headers: { 'Authorization': `Bearer ${token}` }
                                });
                            } catch (err) {
                                console.error('Erro ao marcar notificação como lida', err);
                            }
                            // Redireciona se for serviço concluído (abre avaliação) ou proposta aceita
                            const notif = (data.notificacoes || []).find(n => n._id === notifId);
                            if (notif?.tipo === 'servico_concluido' && notif.dadosAdicionais?.profissionalId) {
                                const params = new URLSearchParams({
                                    id: notif.dadosAdicionais.profissionalId,
                                    origem: 'servico_concluido'
                                });
                                
                                // Prioriza pedidoId (pedido urgente) sobre agendamentoId
                                // Cada notificação tem seu próprio pedidoId/agendamentoId
                                
                                // Tenta extrair o nome do serviço da mensagem da notificação
                                let nomeServicoDaMensagem = '';
                                if (notif.mensagem) {
                                    const match = notif.mensagem.match(/serviço:\s*([^.]+)/i);
                                    if (match && match[1]) {
                                        nomeServicoDaMensagem = match[1].trim();
                                        console.log('✅ Nome do serviço extraído da mensagem:', nomeServicoDaMensagem);
                                    }
                                }
                                
                                const pedidoId = notif.dadosAdicionais.pedidoId || '';
                                if (pedidoId) {
                                    const pidClean = String(pedidoId).match(/[a-fA-F0-9]{24}/)?.[0] || '';
                                    if (pidClean) {
                                        params.set('pedidoId', pidClean);
                                        // Busca o nome do serviço do pedido e adiciona aos parâmetros
                                        try {
                                            const pedidoResp = await fetch(`/api/pedidos-urgentes/${pidClean}`, {
                                                headers: { 'Authorization': `Bearer ${token}` }
                                            });
                                            if (pedidoResp.ok) {
                                                const pedido = await pedidoResp.json();
                                                const nomeServico = pedido?.servico || pedido?.titulo || pedido?.descricao || nomeServicoDaMensagem || '';
                                                if (nomeServico) {
                                                    params.set('servico', nomeServico);
                                                    localStorage.setItem('ultimoServicoNome', nomeServico);
                                                    localStorage.setItem(`nomeServico:${pidClean}`, nomeServico);
                                                    console.log('✅ Nome do serviço salvo do pedido:', nomeServico);
                                                }
                                            }
                                        } catch (e) {
                                            console.warn('Erro ao buscar nome do serviço do pedido:', e);
                                            // Se falhar, usa o nome da mensagem
                                            if (nomeServicoDaMensagem) {
                                                params.set('servico', nomeServicoDaMensagem);
                                                localStorage.setItem('ultimoServicoNome', nomeServicoDaMensagem);
                                            }
                                        }
                                    }
                                } else if (notif.dadosAdicionais.agendamentoId) {
                                    // Se não tem pedidoId, tenta buscar do agendamento através da lista de agendamentos do cliente
                                    try {
                                        const agendamentoId = notif.dadosAdicionais.agendamentoId;
                                        const agendamentosResp = await fetch(`/api/agenda/cliente`, {
                                            headers: { 'Authorization': `Bearer ${token}` }
                                        });
                                        if (agendamentosResp.ok) {
                                            const data = await agendamentosResp.json();
                                            const agendamento = data?.agendamentos?.find(a => a._id === agendamentoId || String(a._id) === String(agendamentoId));
                                            const nomeServico = agendamento?.servico || nomeServicoDaMensagem || '';
                                            if (nomeServico) {
                                                params.set('servico', nomeServico);
                                                localStorage.setItem('ultimoServicoNome', nomeServico);
                                                console.log('✅ Nome do serviço salvo do agendamento:', nomeServico);
                                            }
                                        }
                                    } catch (e) {
                                        console.warn('Erro ao buscar nome do serviço do agendamento:', e);
                                        // Se falhar, usa o nome da mensagem
                                        if (nomeServicoDaMensagem) {
                                            params.set('servico', nomeServicoDaMensagem);
                                            localStorage.setItem('ultimoServicoNome', nomeServicoDaMensagem);
                                        }
                                    }
                                } else if (nomeServicoDaMensagem) {
                                    // Se não tem nem pedidoId nem agendamentoId, usa o nome extraído da mensagem
                                    params.set('servico', nomeServicoDaMensagem);
                                    localStorage.setItem('ultimoServicoNome', nomeServicoDaMensagem);
                                    console.log('✅ Nome do serviço usado da mensagem:', nomeServicoDaMensagem);
                                }
                                const fotoServico = notif.dadosAdicionais.foto || localStorage.getItem('fotoUltimoServicoConcluido') || localStorage.getItem('ultimaFotoPedido');
                                if (fotoServico) params.set('foto', fotoServico);
                                window.location.href = `/perfil?${params.toString()}#secao-avaliacao`;
                                return;
                            }
                            if (notif?.tipo === 'proposta_aceita' && notif.dadosAdicionais?.agendamentoId) {
                                modalNotificacoes?.classList.add('hidden');
                                // Aproveita modal de serviços ativos já existente em feed? aqui apenas recarrega.
                                window.location.reload();
                                return;
                            }
                        });
                    });
                }
            }
        } catch (error) {
            console.error('Erro ao carregar notificações (perfil):', error);
            if (badgeNotificacoes) badgeNotificacoes.style.display = 'none';
            if (listaNotificacoes && modalNotificacoes && !modalNotificacoes.classList.contains('hidden')) {
                listaNotificacoes.innerHTML = '<p style="color: var(--error-color);">Erro ao carregar notificações.</p>';
            }
        }
    }

    if (btnNotificacoes) {
        btnNotificacoes.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!modalNotificacoes) return;
            const estavaOculto = modalNotificacoes.classList.contains('hidden');
            if (!estavaOculto) {
                modalNotificacoes.classList.add('hidden');
                return;
            }
            if (listaNotificacoes) listaNotificacoes.innerHTML = '<p style="text-align: center; padding: 20px;">Carregando notificações...</p>';
            modalNotificacoes.classList.remove('hidden');
            await carregarNotificacoesPerfil();
            // Configura o botão lixeira quando o modal é aberto (depois de carregar notificações)
            setTimeout(() => {
                console.log('⏰ Configurando botão lixeira após abrir modal...');
                const configurado = configurarBotaoLixeira();
                if (!configurado) {
                    console.error('❌ Falha ao configurar botão lixeira');
                } else {
                    // Testa se o botão está clicável
                    const btnTeste = document.getElementById('btn-limpar-notificacoes');
                    if (btnTeste) {
                        console.log('✅ Botão encontrado após configuração:', btnTeste);
                        console.log('✅ Botão tem onclick?', btnTeste.onclick !== null);
                        console.log('✅ Botão está visível?', btnTeste.offsetParent !== null);
                        console.log('✅ Botão tem atributo onclick?', btnTeste.getAttribute('onclick') !== null);
                    }
                }
            }, 300);
            // marca todas como lidas ao abrir
            try {
                await fetch('/api/notificacoes/marcar-todas-lidas', {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                await carregarNotificacoesPerfil();
            } catch (err) {
                console.error('Erro ao marcar todas como lidas:', err);
            }
        });

        document.addEventListener('click', (ev) => {
            if (!modalNotificacoes || modalNotificacoes.classList.contains('hidden')) return;
            const cliqueDentro = modalNotificacoes.contains(ev.target);
            const cliqueNoBotao = btnNotificacoes.contains(ev.target);
            if (!cliqueDentro && !cliqueNoBotao) {
                modalNotificacoes.classList.add('hidden');
                // Sai do modo de seleção ao fechar o modal
                if (modoSelecao) {
                    toggleModoSelecao();
                }
            }
        });
    }

    if (btnMarcarTodasLidas) {
        btnMarcarTodasLidas.addEventListener('click', async () => {
            try {
                await fetch('/api/notificacoes/marcar-todas-lidas', {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                await carregarNotificacoesPerfil();
            } catch (err) {
                console.error('Erro ao marcar todas notificações como lidas:', err);
            }
        });
    }

    // Função para lidar com o clique no botão lixeira (tornada global para acesso via onclick)
    window.handleClickLixeira = async function handleClickLixeira(e) {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        console.log('🔴🔴🔴 BOTÃO LIXEIRA CLICADO! Modo seleção atual:', modoSelecao);
        console.log('🔴 Estado:', { modoSelecao, selecionadas: notificacoesSelecionadas.size });
        
        // Se não está em modo de seleção, entra no modo
        if (!modoSelecao) {
            console.log('✅ Entrando no modo de seleção...');
            toggleModoSelecao();
            return;
        }
        
        // Se está em modo de seleção e tem notificações selecionadas, deleta
        if (notificacoesSelecionadas.size === 0) {
            alert('Selecione pelo menos uma notificação para deletar.');
            return;
        }
        
        if (!confirm(`Tem certeza que deseja deletar ${notificacoesSelecionadas.size} notificação(ões)? Esta ação não pode ser desfeita.`)) {
            return;
        }
        
        try {
            const response = await fetch('/api/notificacoes', {
                method: 'DELETE',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ids: Array.from(notificacoesSelecionadas) })
            });
            const data = await response.json();
            if (response.ok && data.success) {
                notificacoesSelecionadas.clear();
                toggleModoSelecao(); // Sai do modo de seleção
                await carregarNotificacoesPerfil();
            } else {
                throw new Error(data.message || 'Erro ao deletar notificações');
            }
        } catch (err) {
            console.error('Erro ao deletar notificações:', err);
            alert('Erro ao deletar notificações. Tente novamente.');
        }
    };
    
    // Mantém referência local também
    const handleClickLixeira = window.handleClickLixeira;

    // Função para configurar o botão lixeira (chamada quando necessário)
    function configurarBotaoLixeira() {
        const btnLixeira = document.getElementById('btn-limpar-notificacoes');
        if (!btnLixeira) {
            console.warn('⚠️ Botão lixeira não encontrado no DOM');
            return false;
        }
        
        console.log('🔍 Botão lixeira encontrado:', btnLixeira);
        
        // Remove todos os listeners antigos clonando o elemento
        const novoBtn = btnLixeira.cloneNode(true);
        btnLixeira.parentNode.replaceChild(novoBtn, btnLixeira);
        
        // Função wrapper para garantir que funcione
        const clickHandler = function(e) {
            console.log('🟢 CLIQUE CAPTURADO NO BOTÃO LIXEIRA!');
            e.stopPropagation();
            e.preventDefault();
            handleClickLixeira(e);
            return false;
        };
        
        // Adiciona múltiplos listeners para garantir que funcione
        novoBtn.addEventListener('click', clickHandler, true); // Capture phase
        novoBtn.addEventListener('click', clickHandler, false); // Bubble phase
        novoBtn.onclick = clickHandler;
        
        // Adiciona também onclick inline como último recurso
        novoBtn.setAttribute('onclick', 'console.log("🟢 onclick inline executado"); event.stopPropagation(); event.preventDefault(); if (window.handleClickLixeira) { window.handleClickLixeira(event); } return false;');
        
        // Adiciona também no ícone dentro do botão
        const icon = novoBtn.querySelector('.fa-trash');
        if (icon) {
            icon.style.pointerEvents = 'none'; // Deixa o clique passar para o botão
        }
        
        // Teste: adiciona um listener de mousedown também
        novoBtn.addEventListener('mousedown', function(e) {
            console.log('🟡 Mouse down no botão lixeira!');
        });
        
        console.log('✅ Listener do botão lixeira configurado (múltiplos métodos)');
        return true;
    }

    // Função para atualizar o botão "Selecionar tudo"
    function atualizarBotaoSelecionarTudo() {
        if (!btnSelecionarTudo) return;
        const todasCards = document.querySelectorAll('.notificacao-card');
        const todasSelecionadas = todasCards.length > 0 && notificacoesSelecionadas.size === todasCards.length;
        btnSelecionarTudo.innerHTML = todasSelecionadas 
            ? '<i class="fas fa-square"></i> Desselecionar tudo'
            : '<i class="fas fa-check-square"></i> Selecionar tudo';
    }

    // Função para entrar/sair do modo de seleção
    function toggleModoSelecao() {
        modoSelecao = !modoSelecao;
        notificacoesSelecionadas.clear();
        console.log('🔄 Modo de seleção alterado para:', modoSelecao);
        
        // Busca o botão novamente (pode ter sido clonado)
        const btnLixeiraAtual = document.getElementById('btn-limpar-notificacoes');
        
        if (modoSelecao) {
            if (btnLixeiraAtual) {
                btnLixeiraAtual.classList.add('modo-selecao');
                console.log('✅ Classe modo-selecao adicionada ao botão');
            }
            if (selecionarTudoContainer) {
                selecionarTudoContainer.style.display = 'block';
                console.log('✅ Container selecionar tudo exibido');
            }
        } else {
            if (btnLixeiraAtual) {
                btnLixeiraAtual.classList.remove('modo-selecao');
            }
            if (selecionarTudoContainer) {
                selecionarTudoContainer.style.display = 'none';
            }
        }
        
        // Recarrega as notificações para atualizar o visual
    carregarNotificacoesPerfil();
    }

    // Usa delegação de eventos no modal para garantir que funcione (capture phase)
    if (modalNotificacoes) {
        modalNotificacoes.addEventListener('click', (e) => {
            // Verifica se o clique foi no botão lixeira ou no ícone dentro dele
            const btnLixeira = e.target.closest('#btn-limpar-notificacoes');
            const iconLixeira = e.target.closest('.fa-trash');
            const isLixeira = btnLixeira || (iconLixeira && iconLixeira.closest('#btn-limpar-notificacoes'));
            
            if (isLixeira) {
                e.stopPropagation();
                e.preventDefault();
                console.log('🔴 Clique detectado via delegação no modal!');
                handleClickLixeira(e);
                return false;
            }
        }, true); // Capture phase - captura antes de outros eventos
        console.log('✅ Delegação de eventos configurada no modal (capture phase)');
    }
    
    // Tenta configurar o botão lixeira imediatamente (caso já esteja no DOM)
    setTimeout(() => {
        const configurado = configurarBotaoLixeira();
        if (configurado) {
            console.log('✅ Botão lixeira configurado no carregamento inicial');
        }
    }, 500);

    if (btnSelecionarTudo) {
        btnSelecionarTudo.addEventListener('click', () => {
            const todasCards = document.querySelectorAll('.notificacao-card');
            const todasSelecionadas = notificacoesSelecionadas.size === todasCards.length;
            
            if (todasSelecionadas) {
                // Desseleciona todas
                notificacoesSelecionadas.clear();
                todasCards.forEach(card => card.classList.remove('selecionada'));
            } else {
                // Seleciona todas
                todasCards.forEach(card => {
                    const notifId = card.dataset.notifId;
                    if (notifId) {
                        notificacoesSelecionadas.add(notifId);
                        card.classList.add('selecionada');
                    }
                });
            }
            atualizarBotaoSelecionarTudo();
        });
    }

    */
    // setInterval e carregarNotificacoesPerfil removidos - agora gerenciados por header-notificacoes.js

    // --- Avatar + nome no header levam SEMPRE para o próprio perfil ---
    if (userAvatarHeader) {
        userAvatarHeader.style.cursor = 'pointer';
        userAvatarHeader.addEventListener('click', () => {
            if (loggedInUserId) {
                window.location.href = `/perfil.html?id=${loggedInUserId}`;
            }
        });
    }

    if (userNameHeader) {
        userNameHeader.style.cursor = 'pointer';
        userNameHeader.addEventListener('click', () => {
            if (loggedInUserId) {
                window.location.href = `/perfil.html?id=${loggedInUserId}`;
            }
        });
    }


    // --- Buscar dados do usuário quando acessado por slug ---
    async function fetchUsuarioPorSlug(slug) {
        try {
            const resp = await fetch(`/api/usuarios/slug/${encodeURIComponent(slug)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await resp.json();
            if (!data.success) return null;
            return data.usuario;
        } catch (error) {
            console.error('Erro ao buscar usuário por slug:', error);
            return null;
        }
    }

    // Controle de avaliações (1 por serviço concluído ou, sem serviço, 1 por visita)
    let avaliacaoSessionKeyBase = '';
    let avaliacaoSessionKey = '';
    let chaveStars = '';

    function atualizarChavesAvaliacao() {
        const pid = profileId || profileIdFromUrl || slugFromPath || 'desconhecido';
        avaliacaoSessionKeyBase = `avaliacaoPerfil:${loggedInUserId || userId}-${pid}`;
        const servicoScope = serviceScopeId;
        avaliacaoSessionKey = servicoScope
            ? `${avaliacaoSessionKeyBase}:servico:${servicoScope}`
            : `${avaliacaoSessionKeyBase}:sessao`;
        chaveStars = `${avaliacaoSessionKey}:stars`;
    }
    // Inicializa as chaves imediatamente (usa slug/id da URL se ainda não resolveu o _id)
    atualizarChavesAvaliacao();

    // Variável para armazenar se já avaliou (verificado via API)
    let avaliacaoJaFeitaCache = null;
    
    // Função assíncrona para verificar se já avaliou via API
    // Função para verificar se já avaliou este serviço específico (pedidoId ou agendamentoId)
    async function verificarAvaliacaoServicoEspecifico(pedidoId, agendamentoId) {
        if (!pedidoId && !agendamentoId) {
            return false; // Sem serviço específico, não pode verificar
        }
        
        if (!profileId || !loggedInUserId) {
            return false;
        }
        
        try {
            const response = await fetch(`/api/avaliacoes-verificadas/${profileId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                return false;
            }
            
            const data = await response.json();
            const avaliacoes = data.avaliacoes || [];
            
            console.log('🔍 Verificando avaliação específica do serviço:', {
                pedidoId,
                agendamentoId,
                totalAvaliacoes: avaliacoes.length
            });
            
            // Verifica se alguma avaliação é do usuário logado E deste serviço específico
            const jaAvaliouServico = avaliacoes.some(av => {
                const clienteId = av.clienteId?._id || av.clienteId?.id || av.clienteId;
                const usuarioId = av.usuarioId?._id || av.usuarioId?.id || av.usuarioId;
                
                const clienteIdStr = clienteId ? String(clienteId) : null;
                const usuarioIdStr = usuarioId ? String(usuarioId) : null;
                const loggedInUserIdStr = String(loggedInUserId);
                
                const usuarioMatch = clienteIdStr === loggedInUserIdStr || usuarioIdStr === loggedInUserIdStr;
                
                if (!usuarioMatch) return false;
                
                // Verifica se é deste serviço específico
                const avPedidoId = av.pedidoUrgenteId?._id || av.pedidoUrgenteId;
                const avAgendamentoId = av.agendamentoId?._id || av.agendamentoId;
                
                const pedidoMatch = pedidoId && avPedidoId && String(avPedidoId) === String(pedidoId);
                const agendamentoMatch = agendamentoId && avAgendamentoId && String(avAgendamentoId) === String(agendamentoId);
                
                console.log('🔍 Comparando serviço específico:', {
                    pedidoId,
                    avPedidoId,
                    pedidoMatch,
                    agendamentoId,
                    avAgendamentoId,
                    agendamentoMatch,
                    match: pedidoMatch || agendamentoMatch
                });
                
                return pedidoMatch || agendamentoMatch;
            });
            
            console.log('🔍 verificarAvaliacaoServicoEspecifico - resultado:', jaAvaliouServico);
            return jaAvaliouServico;
        } catch (error) {
            console.warn('Erro ao verificar avaliação específica do serviço:', error);
            return false;
        }
    }
    
    async function verificarAvaliacaoJaFeitaAPI() {
        if (avaliacaoJaFeitaCache !== null) {
            return avaliacaoJaFeitaCache;
        }
        
        // Se não tem profileId ou loggedInUserId, não pode verificar
        if (!profileId || !loggedInUserId) {
            avaliacaoJaFeitaCache = false;
            return false;
        }
        
        try {
            const response = await fetch(`/api/avaliacoes-verificadas/${profileId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                avaliacaoJaFeitaCache = false;
                return false;
            }
            
            const data = await response.json();
            const avaliacoes = data.avaliacoes || [];
            
            console.log('🔍 verificarAvaliacaoJaFeitaAPI - avaliacoes recebidas:', avaliacoes.length);
            console.log('🔍 verificarAvaliacaoJaFeitaAPI - loggedInUserId:', loggedInUserId);
            console.log('🔍 verificarAvaliacaoJaFeitaAPI - profileId:', profileId);
            
            // Verifica se alguma avaliação é do usuário logado
            const jaAvaliou = avaliacoes.some(av => {
                const clienteId = av.clienteId?._id || av.clienteId?.id || av.clienteId;
                const usuarioId = av.usuarioId?._id || av.usuarioId?.id || av.usuarioId;
                
                const clienteIdStr = clienteId ? String(clienteId) : null;
                const usuarioIdStr = usuarioId ? String(usuarioId) : null;
                const loggedInUserIdStr = String(loggedInUserId);
                
                const clienteMatch = clienteIdStr === loggedInUserIdStr;
                const usuarioMatch = usuarioIdStr === loggedInUserIdStr;
                
                console.log('🔍 Comparando avaliação:', {
                    clienteId: clienteId,
                    clienteIdStr: clienteIdStr,
                    usuarioId: usuarioId,
                    usuarioIdStr: usuarioIdStr,
                    loggedInUserId: loggedInUserId,
                    loggedInUserIdStr: loggedInUserIdStr,
                    clienteMatch: clienteMatch,
                    usuarioMatch: usuarioMatch,
                    match: clienteMatch || usuarioMatch
                });
                
                return clienteMatch || usuarioMatch;
            });
            
            console.log('🔍 verificarAvaliacaoJaFeitaAPI - resultado:', jaAvaliou);
            
            avaliacaoJaFeitaCache = jaAvaliou;
            
            // Se já avaliou, marca como permanente no localStorage
            if (jaAvaliou) {
                const chavePermanente = `avaliacaoPerfil:${loggedInUserId}-${profileId}:permanente`;
                localStorage.setItem(chavePermanente, '1');
                console.log('✅ Avaliação encontrada na API, marcando como permanente:', chavePermanente);
            } else {
                console.log('❌ Nenhuma avaliação do usuário logado encontrada');
            }
            
            return jaAvaliou;
        } catch (error) {
            console.warn('Erro ao verificar avaliação via API:', error);
            avaliacaoJaFeitaCache = false;
            return false;
        }
    }
    
    const avaliacaoJaFeita = async () => {
        // Se veio de notificação, SEMPRE verifica apenas o serviço específico, não a avaliação geral
        if (veioDeNotificacao || hashSecaoAvaliacao) {
            // IMPORTANTE: Quando vem de notificação, SEMPRE usa apenas pedidoId da URL (não do localStorage)
            // Cada serviço tem seu próprio pedidoId único - não pode usar o do localStorage
            const pedidoIdParaVerificar = pedidoIdAvaliacao; // SEMPRE da URL quando vem de notificação
            const agendamentoIdParaVerificar = agendamentoIdAvaliacao; // SEMPRE da URL quando vem de notificação
            
            console.log('🔍 Verificando avaliação - pedidoId da URL:', pedidoIdAvaliacao);
            console.log('🔍 Verificando avaliação - pedidoId do localStorage:', pedidoIdUltimoServicoConcluido);
            console.log('🔍 Verificando avaliação - usando pedidoIdParaVerificar:', pedidoIdParaVerificar);
            
            // Se não tem pedidoId nem agendamentoId na URL quando vem de notificação, PERMITE avaliar
            // Não bloqueia por avaliação geral quando vem de notificação sem ID específico
            if (!pedidoIdParaVerificar && !agendamentoIdParaVerificar) {
                console.log('⚠️ Veio de notificação mas não tem pedidoId/agendamentoId na URL, PERMITINDO avaliação (não bloqueia)');
                return false; // Permite avaliar - não bloqueia
            }
            
            console.log('🔍 Verificando avaliação específica do serviço (vindo de notificação):', {
                pedidoIdAvaliacao,
                pedidoIdParaVerificar,
                agendamentoIdAvaliacao,
                agendamentoIdParaVerificar,
                chaveEsperada: pedidoIdParaVerificar 
                    ? `avaliacaoServico:${loggedInUserId}-${pedidoIdParaVerificar}`
                    : `avaliacaoServico:${loggedInUserId}-${agendamentoIdParaVerificar}`
            });
            
            // Verifica storage específico do serviço
            const chaveServico = pedidoIdParaVerificar 
                ? `avaliacaoServico:${loggedInUserId}-${pedidoIdParaVerificar}`
                : `avaliacaoServico:${loggedInUserId}-${agendamentoIdParaVerificar}`;
            
            const temNoStorageServico = !!localStorage.getItem(chaveServico) || !!sessionStorage.getItem(chaveServico);
            if (temNoStorageServico) {
                console.log('✅ avaliacaoJaFeita: encontrado no storage do serviço específico:', chaveServico);
                return true;
            }
            
            // Verifica via API se já avaliou este serviço específico
            const jaAvaliouServico = await verificarAvaliacaoServicoEspecifico(pedidoIdParaVerificar, agendamentoIdParaVerificar);
            if (jaAvaliouServico) {
                console.log('✅ avaliacaoJaFeita: encontrado via API para serviço específico');
                // Marca no storage para próximas verificações
                localStorage.setItem(chaveServico, '1');
                return true;
            }
            
            console.log('❌ avaliacaoJaFeita: serviço específico não avaliado ainda - PERMITINDO avaliação');
            return false; // Não avaliou este serviço específico - permite avaliar
        }
        
        // Se não veio de notificação, verifica avaliação geral do perfil
        // Primeiro verifica localStorage/sessionStorage (rápido)
        const temNoStorage = !!sessionStorage.getItem(avaliacaoSessionKey) || !!localStorage.getItem(avaliacaoSessionKey);
        if (temNoStorage) {
            console.log('✅ avaliacaoJaFeita: encontrado no storage');
            return true;
        }
        
        // Verifica chave permanente no localStorage (para visitas normais)
        const chavePermanente = `avaliacaoPerfil:${loggedInUserId || userId}-${profileId || profileIdFromUrl || slugFromPath || 'desconhecido'}:permanente`;
        const temPermanente = !!localStorage.getItem(chavePermanente);
        if (temPermanente) {
            console.log('✅ avaliacaoJaFeita: encontrado na chave permanente:', chavePermanente);
            return true;
        }
        
        // Se não tem no storage, retorna o cache da API (pode ser null na primeira chamada)
        if (avaliacaoJaFeitaCache === true) {
            console.log('✅ avaliacaoJaFeita: encontrado no cache da API');
            return true;
        }
        
        console.log('❌ avaliacaoJaFeita: não encontrado, retornando false');
        return false;
    };

    const estrelasAvaliacaoSalvas = () =>
        sessionStorage.getItem(chaveStars) || localStorage.getItem(chaveStars) || '';

    const marcarAvaliacaoFeita = (estrelas, pedidoIdForcado = null, agendamentoIdForcado = null) => {
        if (!avaliacaoSessionKey) atualizarChavesAvaliacao();
        sessionStorage.setItem(avaliacaoSessionKey, '1');
        localStorage.setItem(avaliacaoSessionKey, '1');
        
        // Usa os valores forçados, depois da URL, depois do localStorage
        const pedidoIdFinal = pedidoIdForcado || pedidoIdAvaliacao || pedidoIdUltimoServicoConcluido;
        const agendamentoIdFinal = agendamentoIdForcado || agendamentoIdAvaliacao || agendamentoIdUltimoServico;
        
        // Se tem pedidoId ou agendamentoId, marca também como avaliado este serviço específico
        if (pedidoIdFinal || agendamentoIdFinal) {
            const chaveServico = pedidoIdFinal 
                ? `avaliacaoServico:${loggedInUserId}-${pedidoIdFinal}`
                : `avaliacaoServico:${loggedInUserId}-${agendamentoIdFinal}`;
            localStorage.setItem(chaveServico, '1');
            sessionStorage.setItem(chaveServico, '1');
            console.log('✅ Marcado como avaliado o serviço específico:', chaveServico, {
                pedidoIdFinal,
                agendamentoIdFinal,
                pedidoIdForcado,
                agendamentoIdForcado
            });
        } else {
            console.log('⚠️ Não foi possível identificar pedidoId/agendamentoId para marcar como avaliado');
        }
        
        // Marca também como permanente para visitas normais
        const chavePermanente = `avaliacaoPerfil:${loggedInUserId || userId}-${profileId || profileIdFromUrl || slugFromPath || 'desconhecido'}:permanente`;
        localStorage.setItem(chavePermanente, '1');
        
        // Atualiza o cache
        avaliacaoJaFeitaCache = true;
        
        if (estrelas) {
            sessionStorage.setItem(chaveStars, String(estrelas));
            localStorage.setItem(chaveStars, String(estrelas));
        }
    };

    const avaliacaoLiberadaGeral = async () => isFluxoServico || !(await avaliacaoJaFeita());

    async function bloquearAvaliacaoGeral() {
        if (!secaoAvaliacao) return;
        // Se já avaliou (storage), esconde completamente a seção
        if (await avaliacaoJaFeita()) {
            secaoAvaliacao.style.display = 'none';
            return;
        }
        // Verifica via API também antes de mostrar
        const jaAvaliouAPI = await verificarAvaliacaoJaFeitaAPI();
        if (jaAvaliouAPI) {
            secaoAvaliacao.style.display = 'none';
            return;
        }
        // Se chegou aqui, não avaliou ainda, mas NÃO deve mostrar a seção em visitas normais
        // A função bloquearAvaliacaoGeral só deve esconder, não mostrar
        // A lógica de mostrar está em outro lugar (visita normal)
        secaoAvaliacao.style.display = 'none';
    }

    // Função de inicialização da página (chamada depois de resolver slug/ID)
    function inicializarPagina() {
        loadHeaderInfo();
        fetchUserProfile();
        setupSectionSwitching();
    }

    // Se veio por slug (/perfil/:slug), resolve o _id antes de continuar
    (async () => {
        if (!profileId && slugFromPath) {
            const usuario = await fetchUsuarioPorSlug(slugFromPath);
            if (!usuario) {
                console.warn('Slug não encontrado, voltando para perfil pelo ID.');
                if (profileIdFromUrl || loggedInUserId) {
                    profileId = profileIdFromUrl || loggedInUserId;
                    // volta para a URL com id para não quebrar próximos acessos
                    window.history.replaceState({}, '', `/perfil.html?id=${profileId}`);
                } else {
                    alert('Perfil não encontrado.');
                    window.location.href = '/';
                    return;
                }
            }
            profileId = usuario?._id || profileId;
        }

        // Se ainda não há profileId, cai para o logado
        if (!profileId) {
            profileId = loggedInUserId;
        }

        isOwnProfile = (profileId === loggedInUserId);
        atualizarChavesAvaliacao();

        inicializarPagina();
    })();

    // A partir daqui, funções normais da página (usadas após resolver profileId)

    // --- FUNÇÃO PARA CARREGAR O HEADER ---
    function loadHeaderInfo() {
        const storedName = localStorage.getItem('userName') || 'Usuário';
        const storedPhotoUrl = localStorage.getItem('userPhotoUrl');
        if (userNameHeader) {
            userNameHeader.textContent = storedName.split(' ')[0];
        }
        if (userAvatarHeader) {
            if (storedPhotoUrl && storedPhotoUrl !== 'undefined' && !storedPhotoUrl.includes('pixabay')) {
                // Técnica similar ao Facebook: carrega a imagem com cache busting para forçar alta qualidade
                userAvatarHeader.src = '';
                
                // Adiciona timestamp para evitar cache e garantir carregamento fresco
                const separator = storedPhotoUrl.includes('?') ? '&' : '?';
                const freshUrl = storedPhotoUrl + separator + '_t=' + Date.now();
                
                // Cria uma nova imagem para pré-carregar, sem crossOrigin (evita erros de CORS com S3)
                const preloadImg = new Image();
                
                preloadImg.onload = function() {
                    userAvatarHeader.src = freshUrl;
                    userAvatarHeader.loading = 'eager';
                    userAvatarHeader.decoding = 'sync';
                    
                    userAvatarHeader.style.opacity = '0';
                    setTimeout(() => {
                        userAvatarHeader.style.opacity = '1';
                        userAvatarHeader.offsetHeight;
                    }, 10);
                };
                
                preloadImg.onerror = function() {
                    // Se a foto do usuário falhar, usa a imagem padrão
                    userAvatarHeader.src = '/imagens/default-user.png';
                    userAvatarHeader.loading = 'eager';
                };
                
                preloadImg.src = freshUrl;
            } else {
                // Sem foto do usuário, usa a imagem padrão
                userAvatarHeader.src = '/imagens/default-user.png';
            }
        }
    }

    // --- FUNÇÕES DE CARREGAMENTO E RENDERIZAÇÃO ---

    // Bloqueia se já existe avaliação (não vinda de serviço concluído) do visitante
    async function aplicarBloqueioHistorico(user) {
        // Não aplica bloqueio se veio de notificação (permite avaliar novo serviço)
        if (!user || origemAvaliacao === 'servico_concluido' || veioDeNotificacao || hashSecaoAvaliacao) {
            console.log('⚠️ Não aplicando bloqueio histórico - veio de notificação ou serviço concluído');
            return;
        }
        const avaliacoes = user.avaliacoes || [];
        const minhas = avaliacoes.filter(a => {
            const uid = a.usuarioId?._id || a.usuarioId || a.usuario;
            return uid && String(uid) === String(loggedInUserId);
        });
        if (minhas.length > 0) {
            const ultima = minhas[ minhas.length - 1 ];
            const estrelas = ultima?.estrelas || ultima?.nota || '';
            // Não passa pedidoId/agendamentoId para não marcar serviço específico como avaliado
            marcarAvaliacaoFeita(estrelas, null, null);
            await bloquearAvaliacaoGeral();
        }
    }
    // Atualiza a URL do navegador para usar o slug, sem recarregar a página
    function atualizarUrlPerfil(user) {
        try {
            if (!user || !user.slugPerfil) return; // só troca se tiver slug salvo
            const slug = user.slugPerfil;
            const cleanPath = `/perfil/${slug}`;
            const currentPath = window.location.pathname;

            // Só troca se for diferente para evitar loop
            if (currentPath !== cleanPath) {
                const newUrl = cleanPath + window.location.search.replace(/(\?|&)id=[^&]*/g, '');
                window.history.replaceState({}, '', newUrl);
            }
        } catch (e) {
            console.error('Erro ao atualizar URL do perfil:', e);
        }
    }

    async function fetchUserProfile() {
        if (!profileId) { console.error("Nenhum ID de perfil para buscar."); return; }
        
        try {
            const response = await fetch(`/api/usuario/${profileId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Falha ao buscar dados do perfil.');
            }
            const user = await response.json(); 
            
            if (isOwnProfile) {
                localStorage.setItem('userName', user.nome);
                localStorage.setItem('userPhotoUrl', user.avatarUrl || user.foto);
                // Aplicar o tema do usuário ao carregar o perfil
                if (user.tema) {
                    localStorage.setItem('theme', user.tema);
                    document.documentElement.classList.toggle('dark-mode', user.tema === 'dark');
                }
            }

        // Deixa a URL bonita: /perfil/slug-do-usuario, somente se for o próprio perfil
        if (isOwnProfile) {
            atualizarUrlPerfil(user);
        }
            
            loadHeaderInfo();
            renderUserProfile(user);

            // Se já existe avaliação deste visitante (qualquer origem) e NÃO é link de serviço concluído,
            // bloqueia o formulário e grava as estrelas mais recentes.
            await aplicarBloqueioHistorico(user);
            
            // Carregar ambas as seções
            if (user.tipo === 'trabalhador') {
                fetchServicos(user._id);
            }
            fetchPostagens(user._id);
            
            // Configurar as abas
            setupSectionSwitching();
            
            // Verifica se já avaliou após carregar o perfil e esconde a seção se necessário
            // IMPORTANTE: Não executa se veio de notificação (já foi processado acima)
            setTimeout(async () => {
                if (!secaoAvaliacao) return;
                
                // Se veio de notificação ou tem hash de avaliação, não processa aqui (já foi processado acima)
                const temHashAvaliacao = window.location.hash && window.location.hash.includes('secao-avaliacao');
                const temOrigemServico = origemAvaliacao === 'servico_concluido';
                if (temHashAvaliacao || temOrigemServico || veioDeNotificacao) {
                    console.log('🔍 Veio de notificação ou tem hash, não processando verificação assíncrona aqui');
                    return;
                }
                
                // Primeiro verifica storage (rápido)
                const jaAvaliouStorage = avaliacaoJaFeita && avaliacaoJaFeita();
                
                if (jaAvaliouStorage) {
                    console.log('✅ Perfil carregado - já avaliou (storage), mantendo seção oculta');
                    secaoAvaliacao.style.display = 'none';
                    await mostrarMensagemAvaliado();
                    return;
                }
                
                // Se não tem no storage, verifica via API ANTES de mostrar
                console.log('🔍 Verificando via API após carregar perfil...');
                const jaAvaliouAPI = await verificarAvaliacaoJaFeitaAPI();
                
                if (jaAvaliouAPI) {
                    console.log('✅ Perfil carregado - já avaliou (API), mantendo seção oculta');
                    secaoAvaliacao.style.display = 'none';
                    await mostrarMensagemAvaliado();
                } else {
                    // Só mostra se realmente não avaliou E não for o próprio perfil
                    if (!isOwnProfile) {
                        console.log('✅ Perfil carregado - primeira visita, verificando se deve mostrar seção...');
                        // A lógica de mostrar está no bloco else if (secaoAvaliacao) abaixo
                        // Não mostra aqui para evitar duplicação
                    } else {
                        secaoAvaliacao.style.display = 'none';
                    }
                }
            }, 1000); // Aguarda 1 segundo para garantir que tudo foi carregado
            
        } catch (error) {
            console.error('Erro ao buscar perfil:', error); 
            if (nomePerfil) nomePerfil.textContent = "Erro ao carregar perfil.";
        }
    }

    let avaliacoesCarregadas = false;

    function renderUserProfile(user) {
        if (!user) return;
        
        // Armazena dados brutos no dataset
        if(fotoPerfil) {
            fotoPerfil.dataset.cidade = user.cidade || '';
            fotoPerfil.dataset.estado = user.estado || '';
        }

        const fotoFinal = (user.avatarUrl && !user.avatarUrl.includes('pixabay')) 
                          ? user.avatarUrl 
                          : (user.foto && !user.foto.includes('pixabay') 
                             ? user.foto 
                             : '/imagens/default-user.png');
        
        if (fotoPerfil) fotoPerfil.src = fotoFinal;
        if (nomePerfil) nomePerfil.textContent = user.nome || 'Nome não informado';
        if (idadePerfil) idadePerfil.textContent = user.idade ? `${user.idade} anos` : 'Não informado';
        if (descricaoPerfil) descricaoPerfil.textContent = user.descricao || 'Nenhuma descrição disponível.';
        
        if (emailPerfil) {
            emailPerfil.textContent = user.email || 'Não informado';
            emailPerfil.href = `mailto:${user.email}`;
        }
        
        if (telefonePerfil) { 
            if (user.telefone) {
                telefonePerfil.href = `https://wa.me/55${user.telefone.replace(/\D/g, '')}`;
                telefonePerfil.textContent = user.telefone;
                telefonePerfil.target = '_blank';
                const phoneIcon = telefonePerfil.previousElementSibling; 
                if (phoneIcon) {
                    phoneIcon.className = 'fab fa-whatsapp';
                    phoneIcon.style.color = '#25d366';
                }
            } else {
                telefonePerfil.textContent = 'Não informado';
                telefonePerfil.href = '#';
                telefonePerfil.target = '';
                const phoneIcon = telefonePerfil.previousElementSibling; 
                if (phoneIcon) {
                    phoneIcon.className = 'fas fa-phone';
                    phoneIcon.style.color = 'var(--text-link)'; 
                }
            }
        }
        
        // 🛑 ATUALIZAÇÃO: Renderização de Localização (Cidade - Estado juntos)
        const localizacaoPerfil = document.getElementById('localizacaoPerfil');
        if (localizacaoPerfil) {
            const cidade = user.cidade || 'Não informado';
            const estado = user.estado ? user.estado.toUpperCase() : '';
            if (estado) {
                localizacaoPerfil.textContent = `${cidade} - ${estado}`;
            } else {
                localizacaoPerfil.textContent = cidade;
            }
        }
        
        // Mantém compatibilidade com elementos antigos se existirem
        const cidadePerfil = document.getElementById('cidadePerfil');
        const estadoPerfil = document.getElementById('estadoPerfil');
        if (cidadePerfil) cidadePerfil.textContent = user.cidade || 'Não informado';
        if (estadoPerfil) estadoPerfil.textContent = user.estado ? user.estado.toUpperCase() : 'Não informado';

        // Carrega avaliações verificadas para qualquer perfil acessado
        if (!avaliacoesCarregadas) {
            avaliacoesCarregadas = true;
            loadAvaliacoesVerificadas(user._id);
        }

        if (user.tipo === 'trabalhador') {
            if (atuacaoPerfil) atuacaoPerfil.textContent = user.atuacao || 'Não informado';
            if (atuacaoItem) atuacaoItem.style.display = 'flex'; 
            if (mediaAvaliacaoContainer) mediaAvaliacaoContainer.style.display = 'block';
            if (secaoServicos) secaoServicos.style.display = 'block';
            if (mostrarServicosBtn) mostrarServicosBtn.style.display = 'inline-block';
            
            // 🆕 ATUALIZADO: Exibir nível (todos) e XP (só dono)
            const nivelContainer = document.getElementById('nivel-container');
            const gamificacaoContainer = document.getElementById('gamificacao-container');
            
            if (user.gamificacao) {
                // Nível sempre visível para trabalhadores
                if (nivelContainer) {
                    nivelContainer.style.display = 'block';
                    const nivelUsuario = document.getElementById('nivelUsuario');
                    if (nivelUsuario) nivelUsuario.textContent = user.gamificacao.nivel || 1;
                }
                
                // XP só para o dono do perfil
                if (isOwnProfile && gamificacaoContainer) {
                    gamificacaoContainer.style.display = 'block';
                    const xpAtual = document.getElementById('xpAtual');
                    const xpProximo = document.getElementById('xpProximo');
                    const xpBarFill = document.getElementById('xp-bar-fill');
                    
                    if (xpAtual) xpAtual.textContent = user.gamificacao.xp || 0;
                    if (xpProximo) xpProximo.textContent = user.gamificacao.xpProximoNivel || 100;
                    
                    if (xpBarFill && user.gamificacao.xpProximoNivel) {
                        const porcentagem = ((user.gamificacao.xp || 0) / user.gamificacao.xpProximoNivel) * 100;
                        xpBarFill.style.width = `${Math.min(porcentagem, 100)}%`;
                    }
                } else if (gamificacaoContainer) {
                    gamificacaoContainer.style.display = 'none';
                }
            }
            
            if (user.totalAvaliacoes > 0) {
                renderMediaAvaliacao(user.mediaAvaliacao);
                if (totalAvaliacoes) totalAvaliacoes.textContent = `${user.totalAvaliacoes} avaliações`;
            } else {
                if (mediaEstrelas) mediaEstrelas.innerHTML = '<span class="no-rating">Nenhuma avaliação</span>';
                if (totalAvaliacoes) totalAvaliacoes.textContent = '';
            }
            // 🆕 NOVO: Botão de disponibilidade
            const disponibilidadeContainer = document.getElementById('disponibilidade-container');
            const toggleDisponibilidade = document.getElementById('toggle-disponibilidade');
            const disponibilidadeTexto = document.getElementById('disponibilidade-texto');
            
            if (isOwnProfile && disponibilidadeContainer && toggleDisponibilidade) {
                disponibilidadeContainer.style.display = 'flex';
                toggleDisponibilidade.checked = user.disponivelAgora || false;
                
                if (disponibilidadeTexto) {
                    disponibilidadeTexto.textContent = user.disponivelAgora ? 'Disponível agora' : 'Indisponível';
                }
                
                toggleDisponibilidade.addEventListener('change', async () => {
                    const disponivel = toggleDisponibilidade.checked;
                    try {
                        const response = await fetch('/api/user/disponibilidade', {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ disponivelAgora: disponivel })
                        });
                        
                        const data = await response.json();
                        if (data.success && disponibilidadeTexto) {
                            disponibilidadeTexto.textContent = disponivel ? 'Disponível agora' : 'Indisponível';
                        }
                    } catch (error) {
                        console.error('Erro ao atualizar disponibilidade:', error);
                        toggleDisponibilidade.checked = !disponivel; // Reverte
                    }
                });
            }
            
            if (isOwnProfile && addServicoBtn) {
                addServicoBtn.style.display = 'block';
            }
            // Não mostra a seção de avaliação aqui - será controlada pela lógica abaixo
            // que verifica se já avaliou antes de mostrar
        } else { 
            if (atuacaoItem) atuacaoItem.style.display = 'none';
            if (mediaAvaliacaoContainer) mediaAvaliacaoContainer.style.display = 'none';
            if (secaoServicos) secaoServicos.style.display = 'none';
            if (mostrarServicosBtn) mostrarServicosBtn.style.display = 'none';
            if (mostrarPostagensBtn) mostrarPostagensBtn.click();
        }

        if (isOwnProfile) {
            if (btnEditarPerfil) btnEditarPerfil.style.display = 'block';
            if (labelInputFotoPerfil) labelInputFotoPerfil.classList.remove('oculto');
        } else {
            if (btnEditarPerfil) btnEditarPerfil.style.display = 'none';
            if (labelInputFotoPerfil) labelInputFotoPerfil.classList.add('oculto');
        }
    }

    async function fetchServicos(id) { /* ... (sem alteração) ... */ }
    function renderServicos(servicos) { /* ... (sem alteração) ... */ }
    async function fetchPostagens(id) { /* ... (sem alteração) ... */ }
    function renderPostagens(posts) { /* ... (sem alteração) ... */ }
    function renderMediaAvaliacao(media) { /* ... (sem alteração) ... */ }
    
    // Busca nome do serviço (pedido/agendamento) para fallback do título
    async function obterNomeServicoFallback() {
        const pidLocal = localStorage.getItem('pedidoIdUltimoServicoConcluido') || '';
        const scopeId = serviceScopeId || pidLocal;
        let nome =
            urlParams.get('servico') ||
            urlParams.get('titulo') ||
            localStorage.getItem('ultimoServicoNome') ||
            localStorage.getItem('ultimaDescricaoPedido') ||
            localStorage.getItem('ultimaCategoriaPedido') ||
            localStorage.getItem('ultimaDemanda') ||
            '';
        if (nome) return nome;
        if (!scopeId) return '';
        try {
            const resp = await fetch(`/api/pedidos-urgentes/${scopeId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resp.ok) {
                const pedido = await resp.json();
                nome =
                    pedido?.servico ||
                    pedido?.titulo ||
                    pedido?.nome ||
                    pedido?.categoria ||
                    pedido?.descricao ||
                    pedido?.tipoServico ||
                    pedido?.categoriaServico ||
                    pedido?.nomeServico ||
                    pedido?.tipo ||
                    '';
                if (nome) {
                    localStorage.setItem('ultimoServicoNome', nome);
                    localStorage.setItem('ultimaDescricaoPedido', pedido?.descricao || nome);
                    localStorage.setItem('ultimaCategoriaPedido', pedido?.categoria || '');
                }
            }
        } catch (e) {
            console.warn('Falha ao buscar nome do serviço:', e);
        }
        // Não use string fixa; se não achar, devolve vazio para não exibir "Serviço concluído"
        return nome || '';
    }

    // 🌟 NOVO: Carregar Avaliações Verificadas
    async function loadAvaliacoesVerificadas(profissionalId) {
        const secaoAvaliacoesVerificadas = document.getElementById('secao-avaliacoes-verificadas');
        const listaAvaliacoes = document.getElementById('lista-avaliacoes-verificadas');
        if (!secaoAvaliacoesVerificadas || !listaAvaliacoes) return;

        try {
            const response = await fetch(`/api/avaliacoes-verificadas/${profissionalId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Falha ao buscar avaliações verificadas.');

            const data = await response.json();
            let avaliacoes = data.avaliacoes || [];
            
            // Verifica se o usuário logado já avaliou este perfil
            if (loggedInUserId && profissionalId) {
                console.log('🔍 loadAvaliacoesVerificadas - Verificando se usuário já avaliou:', {
                    loggedInUserId: loggedInUserId,
                    profissionalId: profissionalId,
                    totalAvaliacoes: avaliacoes.length
                });
                
                const jaAvaliou = avaliacoes.some(av => {
                    const clienteId = av.clienteId?._id || av.clienteId?.id || av.clienteId;
                    const usuarioId = av.usuarioId?._id || av.usuarioId?.id || av.usuarioId;
                    
                    const clienteIdStr = clienteId ? String(clienteId) : null;
                    const usuarioIdStr = usuarioId ? String(usuarioId) : null;
                    const loggedInUserIdStr = String(loggedInUserId);
                    
                    const clienteMatch = clienteIdStr === loggedInUserIdStr;
                    const usuarioMatch = usuarioIdStr === loggedInUserIdStr;
                    const match = clienteMatch || usuarioMatch;
                    
                    console.log('🔍 loadAvaliacoesVerificadas - Comparando:', {
                        clienteId: clienteId,
                        clienteIdStr: clienteIdStr,
                        usuarioId: usuarioId,
                        usuarioIdStr: usuarioIdStr,
                        loggedInUserId: loggedInUserId,
                        loggedInUserIdStr: loggedInUserIdStr,
                        clienteMatch: clienteMatch,
                        usuarioMatch: usuarioMatch,
                        match: match
                    });
                    
                    if (match) {
                        console.log('✅ Avaliação do usuário logado encontrada em loadAvaliacoesVerificadas');
                    }
                    return match;
                });
                
                if (jaAvaliou) {
                    // Atualiza o cache
                    avaliacaoJaFeitaCache = true;
                    // Marca como permanente no localStorage
                    const chavePermanente = `avaliacaoPerfil:${loggedInUserId}-${profissionalId}:permanente`;
                    localStorage.setItem(chavePermanente, '1');
                    console.log('✅ Avaliação encontrada, cache atualizado e chave permanente criada:', chavePermanente);
                } else {
                    console.log('❌ Nenhuma avaliação do usuário logado encontrada em loadAvaliacoesVerificadas');
                }
            }
            
            console.log('📥 Avaliações verificadas recebidas da API:', JSON.stringify(avaliacoes, null, 2));
            avaliacoes.forEach((av, idx) => {
                console.log(`📥 Avaliação ${idx}:`, {
                    _id: av._id,
                    servico: av.servico,
                    agendamentoId: av.agendamentoId,
                    agendamentoIdServico: av.agendamentoId?.servico,
                    clienteId: av.clienteId?.nome
                });
            });
            
            if (avaliacoes.length === 0) {
                // fallback: tenta usar última avaliação local (geral) do usuário atual neste perfil
                try {
                    const cacheKey = `ultimaAvaliacaoGeral:${profissionalId}:${loggedInUserId || userId || ''}`;
                    const cacheStr = localStorage.getItem(cacheKey);
                    if (cacheStr) {
                        const cacheObj = JSON.parse(cacheStr);
                        if (cacheObj && cacheObj.clienteId) {
                            avaliacoes = [cacheObj];
                        }
                    }
                } catch (e) {
                    console.warn('Falha ao ler cache da avaliação local:', e);
                }
            }

            if (avaliacoes.length === 0) {
                secaoAvaliacoesVerificadas.style.display = 'block';
                listaAvaliacoes.innerHTML = '<p style="padding:16px; color: var(--text-secondary);">Nenhuma avaliação verificada.</p>';
                
                // Se já avaliou E veio de notificação, mostra mensagem pequena no título
                if (avaliacaoJaFeita && avaliacaoJaFeita() && veioDeNotificacao) {
                    const h3Titulo = secaoAvaliacoesVerificadas.querySelector('h3');
                    if (h3Titulo) {
                        // Remove mensagem antiga se existir
                        const mensagemAntiga = h3Titulo.querySelector('.mensagem-avaliado-pequena');
                        if (mensagemAntiga) {
                            mensagemAntiga.remove();
                        }
                        
                        // Cria mensagem pequena no h3
                        const mensagemEl = document.createElement('span');
                        mensagemEl.className = 'mensagem-avaliado-pequena';
                        mensagemEl.style.cssText = 'color: #ffc107; font-size: 12px; font-weight: 600; margin-left: 10px; display: inline-flex; align-items: center; gap: 4px;';
                        mensagemEl.innerHTML = '<span style="color: #28a745;">✓</span> Perfil já avaliado';
                        h3Titulo.appendChild(mensagemEl);
                    }
                }
                return;
            }

            let servicoNomeFallbackGlobal = await obterNomeServicoFallback();
            const pidLocalGlobal = serviceScopeId || localStorage.getItem('pedidoIdUltimoServicoConcluido') || '';
            const pidLocalClean = String(pidLocalGlobal || '').match(/[a-fA-F0-9]{24}/)?.[0] || '';

            // Prefetch do nome do serviço, se ainda não existir em cache
            if (pidLocalClean) {
                const hasNomeCache =
                    localStorage.getItem(`nomeServico:${pidLocalClean}`) ||
                    localStorage.getItem('nomeServicoConcluido') ||
                    localStorage.getItem('ultimoServicoNome') ||
                    localStorage.getItem('ultimaDescricaoPedido');

                if (!hasNomeCache) {
                    try {
                        const resp = await fetch(`/api/pedidos-urgentes/${pidLocalClean}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (resp.ok) {
                            const pedido = await resp.json();
                            const nomePedido =
                                pedido?.servico ||
                                pedido?.titulo ||
                                pedido?.descricao ||
                                pedido?.nome ||
                                pedido?.categoria ||
                                pedido?.tipoServico ||
                                pedido?.nomeServico ||
                                '';
                            if (nomePedido) {
                                localStorage.setItem(`nomeServico:${pidLocalClean}`, nomePedido);
                                localStorage.setItem('nomeServicoConcluido', nomePedido);
                                localStorage.setItem('ultimoServicoNome', nomePedido);
                                localStorage.setItem('ultimaDescricaoPedido', pedido?.descricao || nomePedido);
                                servicoNomeFallbackGlobal = servicoNomeFallbackGlobal || nomePedido;
                            }
                        }
                    } catch (e) {
                        console.warn('Falha ao prefetch do nome do serviço', e);
                    }
                }
            }
            // Se ainda não achou e temos um ID de serviço/pedido, tenta buscar direto na API
            if (!servicoNomeFallbackGlobal) {
                if (pidLocalGlobal) {
                    const pidClean = String(pidLocalGlobal).match(/[a-fA-F0-9]{24}/)?.[0] || '';
                    try {
                        const resp = await fetch(`/api/pedidos-urgentes/${pidClean}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (resp.ok) {
                            const pedido = await resp.json();
                            servicoNomeFallbackGlobal =
                                pedido?.servico ||
                                pedido?.titulo ||
                                pedido?.descricao ||
                                pedido?.nome ||
                                pedido?.categoria ||
                                pedido?.tipoServico ||
                                pedido?.nomeServico ||
                                '';
                            if (servicoNomeFallbackGlobal) {
                                localStorage.setItem('ultimoServicoNome', servicoNomeFallbackGlobal);
                                localStorage.setItem('ultimaDescricaoPedido', pedido?.descricao || servicoNomeFallbackGlobal);
                                localStorage.setItem('nomeServicoConcluido', servicoNomeFallbackGlobal);
                                if (pidClean) localStorage.setItem(`nomeServico:${pidClean}`, servicoNomeFallbackGlobal);
                            }
                        } else {
                            console.warn('Fetch pedido fallback falhou', resp.status);
                        }
                    } catch (e) {
                        console.warn('Falha ao buscar nome do pedido (fallback global)', e);
                    }
                }
            }

            const viewerId = loggedInUserId || userId || '';
            const viewerName = (localStorage.getItem('userName') || '').trim().toLowerCase();
            const sameId = (a, b) => a && b && String(a) === String(b);
            const sameName = (nome) => nome && viewerName && nome.trim().toLowerCase() === viewerName;

            const ehMinha = (av) => {
                const idsPossiveis = [
                    av.clienteId?._id, av.clienteId?.id, av.clienteId,
                    av.usuarioId?._id, av.usuarioId?.id, av.usuarioId,
                    av.userId, av.usuario,
                    av.cliente, av.clienteID, av.cliente_id, av.usuario_id
                ];
                if (viewerId && idsPossiveis.some(v => sameId(v, viewerId))) return true;
                const nome = av.clienteId?.nome || av.usuarioId?.nome || av.nome || '';
                if (sameName(nome)) return true;
                return false;
            };

            let ordenadas = avaliacoes;
            let encontrouMinha = false;
            if (viewerId) {
                const minhas = avaliacoes.filter(av => {
                    const m = ehMinha(av);
                    if (m) encontrouMinha = true;
                    return m;
                });
                const outras = avaliacoes.filter(av => !ehMinha(av));
                ordenadas = [...minhas, ...outras];
            }

            // Fallback: se ainda não achou a minha, mas há flag local da última avaliação enviada
            if (!encontrouMinha) {
                const ultimaId = localStorage.getItem('ultimaAvaliacaoClienteId');
                if (ultimaId && viewerId && String(ultimaId) === String(viewerId) && ordenadas.length > 0) {
                    ordenadas = [ordenadas[0], ...ordenadas.slice(1)];
                    encontrouMinha = true;
                }
            }

            secaoAvaliacoesVerificadas.style.display = 'block';
            
            // Se já avaliou E veio de notificação, adiciona mensagem pequena no título
            if (avaliacaoJaFeita && avaliacaoJaFeita() && veioDeNotificacao) {
                const h3Titulo = secaoAvaliacoesVerificadas.querySelector('h3');
                if (h3Titulo) {
                    // Remove mensagem antiga se existir
                    const mensagemAntiga = h3Titulo.querySelector('.mensagem-avaliado-pequena');
                    if (mensagemAntiga) {
                        mensagemAntiga.remove();
                    }
                    
                    // Cria mensagem pequena no h3, ao lado do badge "Cliente Verificado"
                    const mensagemEl = document.createElement('span');
                    mensagemEl.className = 'mensagem-avaliado-pequena';
                    mensagemEl.style.cssText = 'color: #ffc107; font-size: 12px; font-weight: 600; margin-left: 10px; display: inline-flex; align-items: center; gap: 4px;';
                    mensagemEl.innerHTML = '<span style="color: #28a745;">✓</span> Perfil já avaliado';
                    h3Titulo.appendChild(mensagemEl);
                }
                // Esconde a seção de avaliação se ainda estiver visível
                if (secaoAvaliacao) {
                    secaoAvaliacao.style.display = 'none';
                }
            }
            
            // Separa primeira avaliação das outras
            const primeiraAvaliacao = ordenadas.length > 0 ? ordenadas[0] : null;
            const outrasAvaliacoes = ordenadas.slice(1);
            
            let html = '';
            
            // Função auxiliar para renderizar uma avaliação (será usada abaixo)
            const renderizarAvaliacaoCompleta = (av, index) => {
                const isMinha = ehMinha(av);
                const nomeBase = av.clienteId?.nome || 'Cliente';
                const nomeExibicao = isMinha ? `${nomeBase} · VOCÊ` : nomeBase;
                const avatar = av.clienteId?.avatarUrl || av.clienteId?.foto || '/imagens/default-user.png';
                const estrelas = '★'.repeat(av.estrelas) + '☆'.repeat(5 - av.estrelas);
                const dataServico = av.dataServico ? new Date(av.dataServico).toLocaleDateString('pt-BR') : '';
                
                // Prioriza o campo servico que vem da API (já enriquecido pelo backend)
                let servicoTxt = '';
                
                // 1. Primeiro tenta pegar diretamente do campo servico da avaliação (vindo da API)
                    console.log('🔍 Avaliação verificada recebida:', {
                        _id: av._id,
                        servico: av.servico,
                        agendamentoId: av.agendamentoId,
                        agendamentoIdServico: av.agendamentoId?.servico,
                        pedidoUrgenteId: av.pedidoUrgenteId,
                        pedidoUrgenteIdServico: av.pedidoUrgenteId?.servico,
                        pedidoUrgenteIdId: av.pedidoUrgenteId?._id || av.pedidoUrgenteId,
                        serviceScopeId: serviceScopeId
                    });
                
                // Verifica se é placeholder
                const isPlaceholderValue = (valor) => {
                    if (!valor || !valor.trim()) return true;
                    const valLower = valor.trim().toLowerCase();
                    return valLower === 'serviço concluído' || 
                           valLower === 'serviço prestado' || 
                           valLower === 'serviço realizado';
                };
                
                // 1. Tenta do campo servico direto da avaliação
                if (av.servico && av.servico.trim() && !isPlaceholderValue(av.servico)) {
                    servicoTxt = av.servico.trim();
                    console.log('✅ Nome do serviço encontrado em av.servico:', servicoTxt);
                } 
                // 2. PRIORIDADE: Tenta do pedidoUrgenteId populado (pedidos urgentes) - antes do agendamento
                else if (av.pedidoUrgenteId) {
                    const pedidoServico = typeof av.pedidoUrgenteId === 'object' 
                        ? av.pedidoUrgenteId.servico 
                        : null;
                    if (pedidoServico && pedidoServico.trim() && !isPlaceholderValue(pedidoServico)) {
                        servicoTxt = pedidoServico.trim();
                        console.log('✅ Nome do serviço encontrado em pedidoUrgenteId.servico:', servicoTxt);
                    } else {
                        // Se pedidoUrgenteId não tem servico populado, tenta buscar do cache usando o ID
                        const pedidoIdValue = av.pedidoUrgenteId._id || av.pedidoUrgenteId;
                        if (pedidoIdValue) {
                            const pidClean = String(pedidoIdValue).match(/[a-fA-F0-9]{24}/)?.[0];
                            if (pidClean) {
                                const nomeCache = localStorage.getItem(`nomeServico:${pidClean}`);
                                if (nomeCache && !isPlaceholderValue(nomeCache)) {
                                    servicoTxt = nomeCache;
                                    console.log('✅ Nome do serviço encontrado no cache do pedidoUrgenteId:', servicoTxt);
                                }
                            }
                        }
                    }
                }
                // 3. Se não tem pedidoUrgenteId, tenta do agendamento populado (serviços agendados) - só se não for placeholder
                if (!servicoTxt && av.agendamentoId) {
                    const agendamentoServico = typeof av.agendamentoId === 'object' 
                        ? av.agendamentoId.servico 
                        : null;
                    if (agendamentoServico && agendamentoServico.trim() && !isPlaceholderValue(agendamentoServico)) {
                        servicoTxt = agendamentoServico.trim();
                        console.log('✅ Nome do serviço encontrado em agendamentoId.servico:', servicoTxt);
                    } else {
                        console.warn('⚠️ agendamentoId.servico é placeholder ou inválido:', agendamentoServico);
                    }
                }
                
                // 4. Fallbacks: SEMPRE tenta buscar dos fallbacks se não encontrou um nome válido
                if (!servicoTxt || isPlaceholderValue(servicoTxt)) {
                    console.log('🔍 Buscando nome do serviço nos fallbacks...');
                    
                    // Primeiro tenta buscar do pedidoUrgenteId se disponível (mesmo que não populado)
                    const pedidoUrgenteIdValue = av.pedidoUrgenteId?._id || av.pedidoUrgenteId;
                    if (pedidoUrgenteIdValue) {
                        const pidClean = String(pedidoUrgenteIdValue).match(/[a-fA-F0-9]{24}/)?.[0];
                        if (pidClean) {
                            const nomeCacheId = localStorage.getItem(`nomeServico:${pidClean}`) || '';
                            if (nomeCacheId && !isPlaceholderValue(nomeCacheId)) {
                                servicoTxt = nomeCacheId;
                                console.log('✅ Nome do serviço encontrado no cache do pedidoUrgenteId:', servicoTxt);
                            }
                        }
                    }
                    
                    // Se ainda não encontrou, tenta do serviceScopeId (disponível na página)
                    if (!servicoTxt && serviceScopeId) {
                        const nomeCacheScope = localStorage.getItem(`nomeServico:${serviceScopeId}`) || '';
                        if (nomeCacheScope && !isPlaceholderValue(nomeCacheScope)) {
                            servicoTxt = nomeCacheScope;
                            console.log('✅ Nome do serviço encontrado no cache do serviceScopeId:', servicoTxt);
                        }
                    }
                    
                    // Se ainda não encontrou, tenta outros fallbacks
                    if (!servicoTxt) {
                        servicoTxt =
                    av.servicoNome ||
                    av.titulo ||
                    av.nome ||
                    av.categoria ||
                    av.descricao ||
                    av.tipoServico ||
                    av.categoriaServico ||
                    av.pedido?.servico ||
                    av.pedido?.titulo ||
                    av.pedido?.descricao ||
                    av.pedido?.nome ||
                    av.detalhes?.servico ||
                    av.dadosAdicionais?.servico ||
                    av.servicoConcluido ||
                    av.servicoAvaliado ||
                    (pidLocalGlobal ? localStorage.getItem(`nomeServico:${pidLocalGlobal}`) : '') ||
                    localStorage.getItem('nomeServicoConcluido') ||
                    localStorage.getItem('ultimaAvaliacaoServico') ||
                    localStorage.getItem('ultimoServicoNome') ||
                    localStorage.getItem('ultimaDescricaoPedido') ||
                    localStorage.getItem('ultimaCategoriaPedido') ||
                    localStorage.getItem('ultimaDemanda') ||
                        urlParams.get('servico') ||
                        urlParams.get('titulo') ||
                            servicoNomeFallbackGlobal ||
                            '';

                        // Remove placeholders indesejados
                        if (isPlaceholderValue(servicoTxt)) {
                            servicoTxt = '';
                        }
                    }
                    
                    // Se ainda não encontrou, tenta do pidLocalClean como última tentativa
                    if (!servicoTxt && pidLocalClean) {
                    const nomeCacheId = localStorage.getItem(`nomeServico:${pidLocalClean}`) || '';
                        if (nomeCacheId && !isPlaceholderValue(nomeCacheId)) {
                            servicoTxt = nomeCacheId;
                            console.log('✅ Nome do serviço encontrado no cache por pidLocalClean:', servicoTxt);
                        }
                    }
                    
                    // Se ainda não encontrou, NÃO usa fallback genérico - deixa vazio
                    if (!servicoTxt || isPlaceholderValue(servicoTxt)) {
                        servicoTxt = '';
                        console.warn('⚠️ Nome do serviço não encontrado ou é placeholder, deixando vazio');
                    } else {
                        console.log('✅ Nome do serviço encontrado nos fallbacks:', servicoTxt);
                    }
                }
                const temServico = servicoTxt && servicoTxt.trim().length > 0;
                
                console.log('📋 Valor final de servicoTxt para renderização:', servicoTxt);
                console.log('📋 temServico:', temServico);

                // Se for a minha e achamos o serviço, cacheia para uso futuro
                if (isMinha && temServico && servicoTxt !== 'Serviço prestado' && servicoTxt !== 'Serviço concluído') {
                    try {
                        localStorage.setItem('ultimoServicoNome', servicoTxt);
                        localStorage.setItem('ultimaDescricaoPedido', servicoTxt);
                    } catch (e) {
                        console.warn('Falha ao cachear servicoTxt da minha avaliação', e);
                    }
                }
                const comentarioHtml = av.comentario ? `<p class="avaliacao-comentario">${av.comentario}</p>` : '';
                
                // Só exibe o serviço se não for placeholder
                const isPlaceholderFinal = servicoTxt && (
                    servicoTxt.trim().toLowerCase() === 'serviço concluído' ||
                    servicoTxt.trim().toLowerCase() === 'serviço prestado' ||
                    servicoTxt.trim().toLowerCase() === 'serviço realizado'
                );
                
                const servicoMeta = (servicoTxt && servicoTxt.trim().length > 0 && !isPlaceholderFinal)
                    ? `<span style="margin-left: 10px;">
                            <i class="fas fa-briefcase"></i> ${servicoTxt}
                       </span>`
                    : '';
                
                console.log('📋 servicoMeta gerado:', servicoMeta);

                return (
`<div class="avaliacao-verificada-item ${index > 0 ? 'avaliacao-oculta' : ''}" data-index="${index}">
    <div class="avaliacao-header">
        <div class="avaliacao-cliente">
            <img src="${avatar}" alt="${nomeBase}" class="avatar-pequeno">
            <div>
                <strong>${nomeExibicao}</strong>
                <span class="badge-verificado-item">
                    <i class="fas fa-check-circle"></i> Cliente Verificado
                </span>
            </div>
        </div>
        <div class="avaliacao-estrelas">
            ${estrelas}
        </div>
    </div>
            ${comentarioHtml}
    <div class="avaliacao-meta">
        <small>
            <i class="fas fa-calendar"></i> ${dataServico}
            ${servicoMeta}
        </small>
    </div>
</div>`
                );
            };
            
            // Sempre mostra a primeira avaliação
            if (primeiraAvaliacao) {
                html += renderizarAvaliacaoCompleta(primeiraAvaliacao, 0);
            }
            
            // Adiciona seta para expandir/colapsar outras avaliações (se houver mais de uma)
            if (outrasAvaliacoes.length > 0) {
                html += `
                    <div class="avaliacoes-expandir-container" style="position: relative; margin: 2px 0; text-align: center;">
                        <button class="btn-expandir-avaliacoes" id="btn-expandir-avaliacoes" aria-label="Ver mais avaliações">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </div>
                `;
                
                // Renderiza outras avaliações (inicialmente ocultas)
                outrasAvaliacoes.forEach((av, idx) => {
                    html += renderizarAvaliacaoCompleta(av, idx + 1);
                });
            }

            listaAvaliacoes.innerHTML = html;
            
            // Configura o botão de expandir/colapsar
            const btnExpandir = document.getElementById('btn-expandir-avaliacoes');
            if (btnExpandir) {
                let expandido = false;
                const avaliacoesOcultas = listaAvaliacoes.querySelectorAll('.avaliacao-oculta');
                
                // Inicialmente oculta outras avaliações
                avaliacoesOcultas.forEach(av => {
                    av.style.display = 'none';
                });
                
                btnExpandir.addEventListener('click', () => {
                    expandido = !expandido;
                    const icon = btnExpandir.querySelector('i');
                    
                    if (expandido) {
                        avaliacoesOcultas.forEach(av => {
                            av.style.display = 'block';
                        });
                        if (icon) {
                            icon.classList.remove('fa-chevron-down');
                            icon.classList.add('fa-chevron-up');
                        }
                        btnExpandir.setAttribute('aria-label', 'Ocultar avaliações');
                    } else {
                        avaliacoesOcultas.forEach(av => {
                            av.style.display = 'none';
                        });
                        if (icon) {
                            icon.classList.remove('fa-chevron-up');
                            icon.classList.add('fa-chevron-down');
                        }
                        btnExpandir.setAttribute('aria-label', 'Ver mais avaliações');
                    }
                });
            }
        } catch (error) {
            console.error('Erro ao carregar avaliações verificadas:', error);
            secaoAvaliacoesVerificadas.style.display = 'block';
            listaAvaliacoes.innerHTML = '<p style="padding:16px; color: var(--error-color);">Erro ao carregar avaliações.</p>';
        }
    }

    // (Funções de renderização de serviços, postagens, etc.)
    async function fetchServicos(id) { if (!galeriaServicos) return; try { const response = await fetch(`/api/servicos/${id}`, { headers: { 'Authorization': `Bearer ${token}` } }); if (!response.ok) throw new Error('Falha ao buscar serviços.'); const servicos = await response.json(); renderServicos(servicos); } catch (error) { console.error('Erro ao buscar serviços:', error); galeriaServicos.innerHTML = '<p class="mensagem-vazia">Erro ao carregar serviços.</p>'; } }
    // 🆕 ATUALIZADO: Renderiza projetos com validações por pares
    function renderServicos(servicos) {
        if (!galeriaServicos) return;
        galeriaServicos.innerHTML = '';
        if (!servicos || servicos.length === 0) {
            galeriaServicos.innerHTML = '<p class="mensagem-vazia">Nenhum projeto cadastrado ainda.</p>';
            return;
        }
        
        servicos.forEach(servico => {
            const imageUrl = servico.images && servico.images.length > 0 ? servico.images[0] : 'https://placehold.co/200?text=Projeto';
            const servicoElement = document.createElement('div');
            servicoElement.className = 'servico-item-container';
            
            let deleteBtn = '';
            if (isOwnProfile) {
                deleteBtn = `<button class="btn-remover-foto" data-id="${servico._id}">&times;</button>`;
            }
            
            const totalValidacoes = servico.totalValidacoes || 0;
            const validacoesHTML = totalValidacoes > 0 
                ? `<span class="validacoes-badge" title="Validado por ${totalValidacoes} profissional(is)">🛡️ ${totalValidacoes}</span>`
                : '';
            
            const tecnologiasHTML = servico.tecnologias && servico.tecnologias.length > 0
                ? `<div class="tecnologias-tags">${servico.tecnologias.map(t => `<span class="tag-tecnologia">${t}</span>`).join('')}</div>`
                : '';
            
            const desafioHelpyBadge = servico.isDesafioHelpy 
                ? `<span class="badge-desafio">#DesafioHelpy</span>`
                : '';
            
            // 🆕 Verifica se o usuário já validou este projeto
            const jaValidou = servico.validacoesPares && servico.validacoesPares.some(
                v => v.profissionalId && (v.profissionalId._id || v.profissionalId).toString() === (loggedInUserId || userId)
            );
            
            const validacaoAnterior = jaValidou && servico.validacoesPares.find(
                v => v.profissionalId && (v.profissionalId._id || v.profissionalId).toString() === (loggedInUserId || userId)
            );
            
            let botaoValidar = '';
            if (!isOwnProfile && userType === 'trabalhador') {
                if (jaValidou) {
                    botaoValidar = `<button class="btn-validar-projeto ja-validado" data-id="${servico._id}" title="Você já validou este projeto">🛡️ Validado</button>`;
                } else {
                    botaoValidar = `<button class="btn-validar-projeto" data-id="${servico._id}">🛡️ Validar Projeto</button>`;
                }
            }
            
            servicoElement.innerHTML = `
                <div class="servico-item" data-id="${servico._id}">
                    <img src="${imageUrl}" alt="${servico.title || 'Projeto'}" class="foto-servico">
                    ${deleteBtn}
                    <div class="servico-info">
                        <p class="servico-titulo">${servico.title || 'Projeto'}</p>
                        ${validacoesHTML}
                        ${desafioHelpyBadge}
                        ${tecnologiasHTML}
                        ${botaoValidar}
                    </div>
                </div>
            `;
            galeriaServicos.appendChild(servicoElement);
        });
        
        // Adiciona listeners
        document.querySelectorAll('.btn-remover-foto').forEach(btn => {
            btn.addEventListener('click', handleDeleteServico);
        });
        
        document.querySelectorAll('.foto-servico').forEach(img => {
            img.addEventListener('click', handleShowServicoDetails);
        });
        
        // 🆕 ATUALIZADO: Listener para validar projeto (com modal melhorado)
        document.querySelectorAll('.btn-validar-projeto:not(.ja-validado)').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const servicoId = btn.dataset.id;
                
                // Abre modal de validação
                const modalValidacao = document.getElementById('modal-validar-projeto');
                if (modalValidacao) {
                    modalValidacao.dataset.servicoId = servicoId;
                    modalValidacao.classList.remove('hidden');
                } else {
                    // Fallback para prompt se modal não existir
                    const comentario = prompt('Deixe um comentário sobre a validação (opcional):');
                    await enviarValidacao(servicoId, comentario);
                }
            });
        });
        
        // Listener para botões já validados (mostra validação anterior)
        document.querySelectorAll('.btn-validar-projeto.ja-validado').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const servicoId = btn.dataset.id;
                // Busca e mostra validação anterior
                try {
                    const response = await fetch(`/api/servico/${servicoId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const servico = await response.json();
                    const minhaValidacao = servico.validacoesPares?.find(
                        v => v.profissionalId && (v.profissionalId._id || v.profissionalId).toString() === (loggedInUserId || userId)
                    );
                    if (minhaValidacao) {
                        alert(`Você validou este projeto em ${new Date(minhaValidacao.dataValidacao).toLocaleDateString('pt-BR')}.\n${minhaValidacao.comentario ? `Comentário: ${minhaValidacao.comentario}` : 'Sem comentário.'}`);
                    }
                } catch (error) {
                    console.error('Erro ao buscar validação:', error);
                }
            });
        });
        
        async function enviarValidacao(servicoId, comentario) {
            try {
                const response = await fetch(`/api/servico/${servicoId}/validar`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ comentario: comentario || null })
                });
                
                const data = await response.json();
                if (data.success) {
                    alert('Projeto validado com sucesso!');
                    fetchServicos(loggedInUserId || userId);
                } else {
                    alert(data.message || 'Erro ao validar projeto.');
                }
            } catch (error) {
                console.error('Erro ao validar projeto:', error);
                alert('Erro ao validar projeto.');
            }
        }
    }
    async function fetchPostagens(id) { 
        if (!minhasPostagensContainer) return; 
        try { 
            const response = await fetch(`/api/user-posts/${id}`, { 
                headers: { 'Authorization': `Bearer ${token}` } 
            }); 
            if (!response.ok) throw new Error('Falha ao buscar postagens.'); 
            const posts = await response.json(); 
            
            // Processa as postagens para garantir que tenham likesCount e commentsCount
            const postsComContadores = posts.map((post) => {
                // Calcula likesCount
                let likesCount = 0;
                if (post.likesCount !== undefined) {
                    likesCount = post.likesCount;
                } else if (post.likes && Array.isArray(post.likes)) {
                    likesCount = post.likes.length;
                }
                
                // Calcula commentsCount
                let commentsCount = 0;
                if (post.commentsCount !== undefined) {
                    commentsCount = post.commentsCount;
                } else if (post.comments && Array.isArray(post.comments)) {
                    commentsCount = post.comments.length;
                }
                
                // Verifica se o usuário já curtiu
                const isLiked = post.likes && Array.isArray(post.likes) && post.likes.includes(loggedInUserId);
                
                return {
                    ...post,
                    likesCount: likesCount,
                    commentsCount: commentsCount,
                    isLiked: isLiked,
                    likes: post.likes || [],
                    comments: post.comments || []
                };
            });
            
            renderPostagens(postsComContadores); 
        } catch (error) { 
            console.error('Erro ao buscar postagens:', error); 
            minhasPostagensContainer.innerHTML = '<p class="mensagem-vazia">Erro ao carregar postagens.</p>'; 
        } 
    }
    
    function renderPostagens(posts) { 
        if (!minhasPostagensContainer) return; 
        minhasPostagensContainer.innerHTML = ''; 
        if (!posts || posts.length === 0) { 
            minhasPostagensContainer.innerHTML = '<p class="mensagem-vazia">Nenhuma postagem encontrada.</p>'; 
            return; 
        } 
        
        // Cria grid de miniaturas
        posts.forEach(post => { 
            if (!post.userId) return; 
            
            const thumbnail = document.createElement('div');
            thumbnail.className = 'post-thumbnail';
            thumbnail.dataset.postId = post._id;
            
            // Verifica se já curtiu
            const isLiked = post.isLiked || (post.likes && Array.isArray(post.likes) && post.likes.includes(loggedInUserId));
            
            // Imagem de preview (ou ícone se não tiver imagem)
            if (post.mediaUrl && post.mediaType === 'image') {
                thumbnail.innerHTML = `
                    <img src="${post.mediaUrl}" alt="Postagem" class="thumbnail-image">
                    <div class="thumbnail-overlay">
                        <div class="thumbnail-info">
                            <i class="fas fa-thumbs-up ${isLiked ? 'liked' : ''}"></i> <span class="like-count">${post.likesCount || 0}</span>
                            <i class="fas fa-comment"></i> <span class="comment-count">${post.commentsCount || 0}</span>
                        </div>
                    </div>
                `;
            } else if (post.mediaUrl && post.mediaType === 'video') {
                thumbnail.innerHTML = `
                    <div class="thumbnail-video-wrapper">
                        <video src="${post.mediaUrl}" class="thumbnail-video"></video>
                        <i class="fas fa-play-circle thumbnail-play-icon"></i>
                    </div>
                    <div class="thumbnail-overlay">
                        <div class="thumbnail-info">
                            <i class="fas fa-thumbs-up ${isLiked ? 'liked' : ''}"></i> <span class="like-count">${post.likesCount || 0}</span>
                            <i class="fas fa-comment"></i> <span class="comment-count">${post.commentsCount || 0}</span>
                        </div>
                    </div>
                `;
            } else {
                // Sem mídia - mostra ícone de texto
                thumbnail.innerHTML = `
                    <div class="thumbnail-text-icon">
                        <i class="fas fa-file-alt"></i>
                        <p class="thumbnail-text-preview">${post.content ? (post.content.substring(0, 50) + (post.content.length > 50 ? '...' : '')) : ''}</p>
                    </div>
                    <div class="thumbnail-overlay">
                        <div class="thumbnail-info">
                            <i class="fas fa-thumbs-up ${isLiked ? 'liked' : ''}"></i> <span class="like-count">${post.likesCount || 0}</span>
                            <i class="fas fa-comment"></i> <span class="comment-count">${post.commentsCount || 0}</span>
                        </div>
                    </div>
                `;
            }
            
            // Armazena dados da postagem para o modal
            thumbnail.dataset.postData = JSON.stringify({
                _id: post._id,
                content: post.content,
                mediaUrl: post.mediaUrl,
                mediaType: post.mediaType,
                userId: post.userId,
                createdAt: post.createdAt,
                likesCount: post.likesCount || 0,
                commentsCount: post.commentsCount || 0
            });
            
            // Event listener para abrir modal
            thumbnail.addEventListener('click', () => {
                abrirModalPostagem(post);
            });
            
            minhasPostagensContainer.appendChild(thumbnail);
        }); 
    }
    
    // Função para abrir modal com postagem completa
    async function abrirModalPostagem(post) {
        const modalPostagem = document.getElementById('modal-postagem-completa');
        const modalContent = document.getElementById('modal-postagem-content');
        
        if (!modalPostagem || !modalContent) {
            console.error('Modal de postagem não encontrado');
            return;
        }
        
        // Busca o post completo com comentários e likes
        let postCompleto = post;
        try {
            const response = await fetch(`/api/posts/${post._id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                postCompleto = await response.json();
            }
        } catch (error) {
            console.warn('Erro ao buscar post completo, usando dados disponíveis:', error);
        }
        
        const postAuthorPhoto = (postCompleto.userId.foto && !postCompleto.userId.foto.includes('pixabay')) 
            ? postCompleto.userId.foto 
            : (postCompleto.userId.avatarUrl && !postCompleto.userId.avatarUrl.includes('pixabay') 
                ? postCompleto.userId.avatarUrl 
                : 'imagens/default-user.png');
        const postAuthorName = postCompleto.userId.nome || 'Usuário Anônimo';
        const postDate = new Date(postCompleto.createdAt).toLocaleString('pt-BR');
        
        // Verifica se já curtiu
        const isLiked = postCompleto.likes && Array.isArray(postCompleto.likes) && postCompleto.likes.includes(loggedInUserId);
        const likesCount = postCompleto.likes?.length || postCompleto.likesCount || 0;
        const commentsCount = postCompleto.comments?.length || postCompleto.commentsCount || 0;
        
        let mediaHTML = '';
        if (postCompleto.mediaUrl) {
            if (postCompleto.mediaType === 'video') {
                mediaHTML = `<video src="${postCompleto.mediaUrl}" class="post-video" controls></video>`;
            } else if (postCompleto.mediaType === 'image') {
                mediaHTML = `<img src="${postCompleto.mediaUrl}" alt="Imagem da postagem" class="post-image">`;
            }
        }
        
        let deleteButton = '';
        if (isOwnProfile) {
            deleteButton = `<button class="delete-post-btn" data-id="${postCompleto._id}"><i class="fas fa-trash"></i></button>`;
        }
        
        // Renderiza comentários
        const isPostOwner = postCompleto.userId._id === loggedInUserId;
        const commentsHTML = renderComments(postCompleto.comments || [], isPostOwner);
        const comentariosVisiveis = (postCompleto.comments && postCompleto.comments.length > 0) ? 'visible' : '';
        
        modalContent.innerHTML = `
            <article class="post" data-post-id="${postCompleto._id}">
                <div class="post-header">
                    <img src="${postAuthorPhoto}" alt="Avatar" class="post-avatar" data-userid="${postCompleto.userId._id}">
                    <div class="post-meta">
                        <span class="user-name" data-userid="${postCompleto.userId._id}">${postAuthorName}</span>
                        <div>
                            <span class="post-date-display">${postDate}</span>
                        </div>
                    </div>
                    ${deleteButton}
                </div>
                <div class="post-content">
                    <p>${postCompleto.content || ''}</p>
                    ${mediaHTML}
                </div>
                <div class="post-actions">
                    <button class="action-btn btn-like ${isLiked ? 'liked' : ''}" data-post-id="${postCompleto._id}">
                        <i class="fas fa-thumbs-up"></i> 
                        <span class="like-count">${likesCount}</span> Curtir
                    </button>
                    <button class="action-btn btn-comment ${comentariosVisiveis ? 'active' : ''}" data-post-id="${postCompleto._id}">
                        <i class="fas fa-comment"></i> ${commentsCount} Comentários
                    </button>
                </div>
                <div class="post-comments ${comentariosVisiveis}" id="comments-${postCompleto._id}">
                    <div class="comment-list">${commentsHTML}</div>
                    <div class="comment-form">
                        <input type="text" class="comment-input" placeholder="Escreva um comentário...">
                        <button class="btn-send-comment" data-post-id="${postCompleto._id}">Enviar</button>
                    </div>
                </div>
            </article>
        `;
        
        // Configurar botão de fechar
        const btnFechar = modalPostagem.querySelector('.btn-close-modal');
        if (btnFechar) {
            btnFechar.onclick = () => {
                modalPostagem.classList.add('hidden');
                document.body.style.overflow = '';
            };
        }
        
        // Fechar ao clicar no overlay
        modalPostagem.onclick = (e) => {
            if (e.target === modalPostagem) {
                modalPostagem.classList.add('hidden');
                document.body.style.overflow = '';
            }
        };
        
        // Abrir modal
        modalPostagem.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        
        // Configurar listeners de interação
        setupPostModalListeners(postCompleto._id);
    }
    
    // Função para renderizar comentários
    function renderComments(comments, isPostOwner) {
        if (!comments || comments.length === 0) return '';
        
        return comments.map(comment => {
            if (!comment.userId) return '';
            
            const commentPhoto = comment.userId.foto || comment.userId.avatarUrl || 'imagens/default-user.png';
            const isCommentLiked = comment.likes && Array.isArray(comment.likes) && comment.likes.includes(loggedInUserId);
            const replyCount = comment.replies?.length || 0;
            
            // Renderiza respostas
            const repliesHTML = (comment.replies || []).map(reply => renderReply(reply, comment._id, isPostOwner)).join('');
            
            return `
                <div class="comment" data-comment-id="${comment._id}">
                    <img src="${commentPhoto.includes('pixabay') ? 'imagens/default-user.png' : commentPhoto}" alt="Avatar" class="comment-avatar">
                    <div class="comment-body-container">
                        <div class="comment-body">
                            <strong>${comment.userId.nome}</strong>
                            <p>${comment.content}</p>
                            ${isPostOwner ? `<button class="btn-delete-comment" data-comment-id="${comment._id}" title="Apagar comentário"><i class="fas fa-trash"></i></button>` : ''}
                        </div>
                        <div class="comment-actions">
                            <button class="comment-action-btn btn-like-comment ${isCommentLiked ? 'liked' : ''}" data-comment-id="${comment._id}">
                                <i class="fas fa-thumbs-up"></i>
                                <span class="like-count">${comment.likes?.length || 0}</span>
                            </button>
                            <button class="comment-action-btn btn-show-reply-form" data-comment-id="${comment._id}">Responder</button>
                            ${replyCount > 0 ? `<button class="comment-action-btn btn-toggle-replies" data-comment-id="${comment._id}">Ver ${replyCount} Respostas</button>` : ''}
                        </div>
                        <div class="reply-list ${replyCount > 0 ? '' : 'oculto'}">${repliesHTML}</div>
                        <div class="reply-form oculto">
                            <input type="text" class="reply-input" placeholder="Responda a ${comment.userId.nome}...">
                            <button class="btn-send-reply" data-comment-id="${comment._id}">Enviar</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // Função para renderizar resposta
    function renderReply(reply, commentId, isPostOwner) {
        if (!reply.userId) return '';
        const replyPhoto = reply.userId.foto || reply.userId.avatarUrl || 'imagens/default-user.png';
        const isReplyLiked = reply.likes && Array.isArray(reply.likes) && reply.likes.includes(loggedInUserId);
        
        return `
            <div class="reply" data-reply-id="${reply._id}">
                <img src="${replyPhoto.includes('pixabay') ? 'imagens/default-user.png' : replyPhoto}" alt="Avatar" class="reply-avatar">
                <div class="reply-body-container">
                    <div class="reply-body">
                        <strong>${reply.userId.nome}</strong>
                        <p>${reply.content}</p>
                        ${isPostOwner ? `<button class="btn-delete-reply" data-comment-id="${commentId}" data-reply-id="${reply._id}" title="Apagar resposta"><i class="fas fa-trash"></i></button>` : ''}
                    </div>
                    <div class="reply-actions">
                        <button class="reply-action-btn btn-like-reply ${isReplyLiked ? 'liked' : ''}" data-comment-id="${commentId}" data-reply-id="${reply._id}">
                            <i class="fas fa-thumbs-up"></i>
                            <span class="like-count">${reply.likes?.length || 0}</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Configurar listeners de interação do modal
    function setupPostModalListeners(postId) {
        const postElement = document.querySelector(`[data-post-id="${postId}"]`);
        if (!postElement) return;
        
        // Curtir postagem
        const btnLike = postElement.querySelector('.btn-like');
        if (btnLike) {
            btnLike.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    const response = await fetch(`/api/posts/${postId}/like`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await response.json();
                    if (data.success) {
                        btnLike.classList.toggle('liked');
                        btnLike.querySelector('.like-count').textContent = data.likes.length;
                        // Atualiza contador e status na miniatura
                        const thumbnail = document.querySelector(`.post-thumbnail[data-post-id="${postId}"]`);
                        if (thumbnail) {
                            const likeCountEl = thumbnail.querySelector('.like-count');
                            if (likeCountEl) likeCountEl.textContent = data.likes.length;
                            const likeIcon = thumbnail.querySelector('.fa-thumbs-up');
                            if (likeIcon) {
                                if (data.likes.includes(loggedInUserId)) {
                                    likeIcon.classList.add('liked');
                                } else {
                                    likeIcon.classList.remove('liked');
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('Erro ao curtir:', error);
                }
            });
        }
        
        // Toggle comentários
        const btnComment = postElement.querySelector('.btn-comment');
        if (btnComment) {
            btnComment.addEventListener('click', (e) => {
                e.stopPropagation();
                const commentsSection = postElement.querySelector('.post-comments');
                if (commentsSection) {
                    commentsSection.classList.toggle('visible');
                    btnComment.classList.toggle('active');
                    if (commentsSection.classList.contains('visible')) {
                        const input = commentsSection.querySelector('.comment-input');
                        if (input) input.focus();
                    }
                }
            });
        }
        
        // Enviar comentário
        const btnSendComment = postElement.querySelector('.btn-send-comment');
        if (btnSendComment) {
            btnSendComment.addEventListener('click', async (e) => {
                e.stopPropagation();
                const input = postElement.querySelector('.comment-input');
                const content = input?.value.trim();
                if (!content) return;
                
                try {
                    const response = await fetch(`/api/posts/${postId}/comment`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content })
                    });
                    const data = await response.json();
                    if (data.success && data.comment) {
                        const commentList = postElement.querySelector('.comment-list');
                        const isPostOwner = postElement.dataset.postId === loggedInUserId;
                        const newCommentHTML = renderComments([data.comment], isPostOwner);
                        commentList.innerHTML += newCommentHTML;
                        
                        // Reconfigurar listeners do novo comentário
                        const newComment = commentList.lastElementChild;
                        setupCommentListeners(newComment, postId);
                        
                        // Atualizar contador
                        const commentCount = commentList.children.length;
                        btnComment.innerHTML = `<i class="fas fa-comment"></i> ${commentCount} Comentários`;
                        
                        // Atualiza contador na miniatura
                        const thumbnail = document.querySelector(`.post-thumbnail[data-post-id="${postId}"]`);
                        if (thumbnail) {
                            const commentCountEl = thumbnail.querySelector('.comment-count');
                            if (commentCountEl) commentCountEl.textContent = commentCount;
                        }
                        
                        input.value = '';
                        postElement.querySelector('.post-comments').classList.add('visible');
                        btnComment.classList.add('active');
                    }
                } catch (error) {
                    console.error('Erro ao comentar:', error);
                    alert('Não foi possível enviar o comentário.');
                }
            });
        }
        
        // Deletar postagem
        const btnDeletePost = postElement.querySelector('.delete-post-btn');
        if (btnDeletePost) {
            btnDeletePost.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!confirm('Tem certeza que deseja excluir esta postagem?')) return;
                
                try {
                    const response = await fetch(`/api/posts/${postId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await response.json();
                    if (response.ok && data.success) {
                        // Remove a miniatura
                        const thumbnail = document.querySelector(`.post-thumbnail[data-post-id="${postId}"]`);
                        if (thumbnail) thumbnail.remove();
                        // Fecha o modal
                        const modalPostagem = document.getElementById('modal-postagem-completa');
                        if (modalPostagem) {
                            modalPostagem.classList.add('hidden');
                            document.body.style.overflow = '';
                        }
                    } else {
                        throw new Error(data.message || 'Erro ao deletar postagem.');
                    }
                } catch (error) {
                    console.error('Erro ao deletar postagem:', error);
                    alert(error.message || 'Erro ao deletar postagem.');
                }
            });
        }
        
        // Configurar listeners dos comentários existentes
        postElement.querySelectorAll('.comment').forEach(comment => {
            setupCommentListeners(comment, postId);
        });
    }
    
    // Configurar listeners de um comentário específico
    function setupCommentListeners(commentElement, postId) {
        const commentId = commentElement.dataset.commentId;
        if (!commentId) return;
        
        // Curtir comentário
        const btnLikeComment = commentElement.querySelector('.btn-like-comment');
        if (btnLikeComment) {
            btnLikeComment.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    const response = await fetch(`/api/posts/${postId}/comments/${commentId}/like`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await response.json();
                    if (data.success) {
                        btnLikeComment.classList.toggle('liked');
                        btnLikeComment.querySelector('.like-count').textContent = data.likes.length;
                    }
                } catch (error) {
                    console.error('Erro ao curtir comentário:', error);
                }
            });
        }
        
        // Mostrar/ocultar formulário de resposta
        const btnShowReply = commentElement.querySelector('.btn-show-reply-form');
        if (btnShowReply) {
            btnShowReply.addEventListener('click', (e) => {
                e.stopPropagation();
                const replyForm = commentElement.querySelector('.reply-form');
                if (replyForm) {
                    replyForm.classList.toggle('oculto');
                    if (!replyForm.classList.contains('oculto')) {
                        replyForm.querySelector('.reply-input').focus();
                    }
                }
            });
        }
        
        // Toggle respostas
        const btnToggleReplies = commentElement.querySelector('.btn-toggle-replies');
        if (btnToggleReplies) {
            btnToggleReplies.addEventListener('click', (e) => {
                e.stopPropagation();
                const replyList = commentElement.querySelector('.reply-list');
                if (replyList) {
                    replyList.classList.toggle('oculto');
                    const replyCount = replyList.children.length;
                    btnToggleReplies.textContent = replyList.classList.contains('oculto') 
                        ? `Ver ${replyCount} Respostas` 
                        : 'Ocultar Respostas';
                }
            });
        }
        
        // Enviar resposta
        const btnSendReply = commentElement.querySelector('.btn-send-reply');
        if (btnSendReply) {
            btnSendReply.addEventListener('click', async (e) => {
                e.stopPropagation();
                const replyForm = btnSendReply.closest('.reply-form');
                const input = replyForm.querySelector('.reply-input');
                const content = input?.value.trim();
                if (!content) return;
                
                try {
                    const response = await fetch(`/api/posts/${postId}/comments/${commentId}/reply`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content })
                    });
                    const data = await response.json();
                    if (data.success && data.reply) {
                        const replyList = commentElement.querySelector('.reply-list');
                        const isPostOwner = document.querySelector(`[data-post-id="${postId}"]`)?.dataset.userId === loggedInUserId;
                        const newReplyHTML = renderReply(data.reply, commentId, isPostOwner);
                        replyList.innerHTML += newReplyHTML;
                        
                        // Reconfigurar listeners da nova resposta
                        const newReply = replyList.lastElementChild;
                        setupReplyListeners(newReply, postId, commentId);
                        
                        replyList.classList.remove('oculto');
                        input.value = '';
                        replyForm.classList.add('oculto');
                        
                        // Atualizar botão de toggle
                        const replyCount = replyList.children.length;
                        if (btnToggleReplies) {
                            btnToggleReplies.textContent = `Ver ${replyCount} Respostas`;
                            btnToggleReplies.style.display = 'inline-block';
                        }
                    }
                } catch (error) {
                    console.error('Erro ao responder:', error);
                    alert('Não foi possível enviar a resposta.');
                }
            });
        }
        
        // Deletar comentário
        const btnDeleteComment = commentElement.querySelector('.btn-delete-comment');
        if (btnDeleteComment) {
            btnDeleteComment.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!confirm('Tem certeza que deseja apagar este comentário?')) return;
                
                try {
                    const response = await fetch(`/api/posts/${postId}/comments/${commentId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await response.json();
                    if (data.success) {
                        commentElement.remove();
                        // Atualizar contador
                        const commentList = document.querySelector(`[data-post-id="${postId}"] .comment-list`);
                        const commentCount = commentList?.children.length || 0;
                        const btnComment = document.querySelector(`[data-post-id="${postId}"] .btn-comment`);
                        if (btnComment) {
                            btnComment.innerHTML = `<i class="fas fa-comment"></i> ${commentCount} Comentários`;
                        }
                        // Atualiza contador na miniatura
                        const thumbnail = document.querySelector(`.post-thumbnail[data-post-id="${postId}"]`);
                        if (thumbnail) {
                            const commentCountEl = thumbnail.querySelector('.comment-count');
                            if (commentCountEl) commentCountEl.textContent = commentCount;
                        }
                    }
                } catch (error) {
                    console.error('Erro ao deletar comentário:', error);
                    alert('Erro ao deletar comentário.');
                }
            });
        }
        
        // Configurar listeners das respostas existentes
        commentElement.querySelectorAll('.reply').forEach(reply => {
            setupReplyListeners(reply, postId, commentId);
        });
    }
    
    // Configurar listeners de uma resposta específica
    function setupReplyListeners(replyElement, postId, commentId) {
        const replyId = replyElement.dataset.replyId;
        if (!replyId) return;
        
        // Curtir resposta
        const btnLikeReply = replyElement.querySelector('.btn-like-reply');
        if (btnLikeReply) {
            btnLikeReply.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    const response = await fetch(`/api/posts/${postId}/comments/${commentId}/replies/${replyId}/like`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await response.json();
                    if (data.success) {
                        btnLikeReply.classList.toggle('liked');
                        btnLikeReply.querySelector('.like-count').textContent = data.likes.length;
                    }
                } catch (error) {
                    console.error('Erro ao curtir resposta:', error);
                }
            });
        }
        
        // Deletar resposta
        const btnDeleteReply = replyElement.querySelector('.btn-delete-reply');
        if (btnDeleteReply) {
            btnDeleteReply.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!confirm('Tem certeza que deseja apagar esta resposta?')) return;
                
                try {
                    const response = await fetch(`/api/posts/${postId}/comments/${commentId}/replies/${replyId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await response.json();
                    if (data.success) {
                        replyElement.remove();
                    }
                } catch (error) {
                    console.error('Erro ao deletar resposta:', error);
                    alert('Erro ao deletar resposta.');
                }
            });
        }
    }
    function renderMediaAvaliacao(media) { if (!mediaEstrelas) return; mediaEstrelas.innerHTML = ''; const estrelasCheias = Math.floor(media); const temMeiaEstrela = media % 1 !== 0; for (let i = 0; i < estrelasCheias; i++) mediaEstrelas.innerHTML += '<i class="fas fa-star"></i>'; if (temMeiaEstrela) mediaEstrelas.innerHTML += '<i class="fas fa-star-half-alt"></i>'; const estrelasVazias = 5 - estrelasCheias - (temMeiaEstrela ? 1 : 0); for (let i = 0; i < estrelasVazias; i++) mediaEstrelas.innerHTML += '<i class="far fa-star"></i>'; }

    // ----------------------------------------------------------------------
    // LÓGICA DE EDIÇÃO DE PERFIL
    // ----------------------------------------------------------------------

    function toggleEditMode(isEditing) {
        
        // 🛑 ATUALIZAÇÃO: Lista de elementos de visualização
        const viewElements = [
            nomePerfil, idadePerfil, telefonePerfil, atuacaoPerfil, 
            descricaoPerfil, emailPerfil, btnEditarPerfil,
            localizacaoPerfil // Span de Localização (Cidade - Estado)
        ];
        
        // 🛑 ATUALIZAÇÃO: Lista de elementos de edição
        const editElements = [
            inputNome, inputIdade, inputWhatsapp, inputAtuacao, 
            inputDescricao, inputEmail, botoesEdicao
        ];
        
        // Elementos de localização (inputs dentro de um div)
        const localizacaoInputs = localizacaoItem ? localizacaoItem.querySelector('.input-edicao') : null;
        
        viewElements.forEach(el => el && el.classList.toggle('oculto', isEditing));
        editElements.forEach(el => el && el.classList.toggle('oculto', !isEditing));
        
        // Mostra/esconde inputs de localização
        if (localizacaoInputs) {
            localizacaoInputs.classList.toggle('oculto', !isEditing);
        }
        
        // Esconde itens antigos de cidade/estado se existirem
        if (cidadeItem) cidadeItem.style.display = 'none';
        if (estadoItem) estadoItem.style.display = 'none';
        
        if (labelInputFotoPerfil) labelInputFotoPerfil.classList.toggle('oculto', !isEditing); // Mostra "Alterar Foto"

        const userTipo = (atuacaoItem.style.display === 'flex') ? 'trabalhador' : 'cliente';
        if(isEditing && userTipo === 'trabalhador') {
            atuacaoItem.style.display = 'flex'; 
            inputAtuacao.classList.remove('oculto'); 
            atuacaoPerfil.classList.add('oculto'); 
        } else if (isEditing) {
            atuacaoItem.style.display = 'none'; 
        } else {
             if(userTipo === 'trabalhador') {
                 atuacaoItem.style.display = 'flex';
             } else {
                 atuacaoItem.style.display = 'none';
             }
        }
        
        if (inputEmail) {
            inputEmail.disabled = true; 
        }
    }

    function fillEditInputs() {
        if (!inputNome) return; 
        
        inputNome.value = nomePerfil.textContent;
        inputIdade.value = idadePerfil.textContent.replace(' anos', '').replace('Não informado', '');
        inputWhatsapp.value = telefonePerfil.textContent.replace('Não informado', '');
        inputAtuacao.value = atuacaoPerfil.textContent.replace('Não informado', '');
        inputDescricao.value = descricaoPerfil.textContent.replace('Nenhuma descrição disponível.', '');
        inputEmail.value = emailPerfil.textContent.trim();
        
        // 🛑 ATUALIZAÇÃO: Lê os dados do dataset ou do texto de localização
        if (localizacaoPerfil) {
            const localizacaoTexto = localizacaoPerfil.textContent || '';
            const partes = localizacaoTexto.split(' - ');
            inputCidade.value = partes[0] || fotoPerfil.dataset.cidade || '';
            inputEstado.value = partes[1] || fotoPerfil.dataset.estado || '';
        } else {
            inputCidade.value = fotoPerfil.dataset.cidade || '';
            inputEstado.value = fotoPerfil.dataset.estado || '';
        }
    }

    if (btnEditarPerfil) {
        btnEditarPerfil.addEventListener('click', () => {
            fillEditInputs();
            toggleEditMode(true);
        });
    }

    if (btnCancelarEdicao) {
        btnCancelarEdicao.addEventListener('click', () => {
            toggleEditMode(false);
        });
    }

    if (btnSalvarPerfil) {
        btnSalvarPerfil.addEventListener('click', async () => {
            
            // 🛑 ATUALIZAÇÃO: Lógica do Spinner
            btnSalvarPerfil.disabled = true;
            btnSalvarPerfil.classList.add('saving');

            const formData = new FormData();
            formData.append('nome', inputNome.value);
            formData.append('idade', inputIdade.value);
            formData.append('telefone', inputWhatsapp.value);
            formData.append('descricao', inputDescricao.value);
            
            // 🛑 ATUALIZAÇÃO: Envia cidade e estado
            formData.append('cidade', inputCidade.value);
            formData.append('estado', inputEstado.value);
            
            if (atuacaoItem.style.display === 'flex') {
                formData.append('atuacao', inputAtuacao.value);
            }
            
            try {
                const response = await fetch(`/api/editar-perfil/${loggedInUserId}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'Falha ao salvar.');
                }
                
                localStorage.setItem('userName', data.user.nome);
                
                // Atualiza foto no cabeçalho se foi alterada
                if (data.user.avatarUrl || data.user.foto) {
                    localStorage.setItem('userPhotoUrl', data.user.avatarUrl || data.user.foto);
                    loadHeaderInfo();
                }
                
                toggleEditMode(false);
                fetchUserProfile(); // Recarrega o perfil com os novos dados
                
            } catch (error) {
                console.error('Erro ao salvar perfil:', error);
                alert('Erro ao salvar: ' + error.message);
            } finally {
                // 🛑 ATUALIZAÇÃO: Esconde o spinner
                btnSalvarPerfil.disabled = false;
                btnSalvarPerfil.classList.remove('saving');
            }
        });
    }
    
    // ----------------------------------------------------------------------
    // PRÉ-VISUALIZAÇÃO E EDIÇÃO DA FOTO DE PERFIL
    // ----------------------------------------------------------------------
    const AVATAR_FRAME_SIZE = 220; // mesmo tamanho visual do círculo de preview
    let avatarPreviewImage = null;
    let avatarPreviewScale = 1;
    let avatarPreviewOffsetX = 0;
    let avatarPreviewOffsetY = 0;
    let avatarIsDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;

    function atualizarTransformPreviewAvatar() {
        if (!avatarPreviewImg) return;
        avatarPreviewImg.style.transform =
            `translate(calc(-50% + ${avatarPreviewOffsetX}px), calc(-50% + ${avatarPreviewOffsetY}px)) scale(${avatarPreviewScale})`;
    }

    function abrirModalPreviewAvatar(file) {
        if (!file || !modalPreviewAvatar || !avatarPreviewImg) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            avatarPreviewImage = new Image();
            avatarPreviewImage.onload = () => {
                const w = avatarPreviewImage.width;
                const h = avatarPreviewImage.height;
                const frame = AVATAR_FRAME_SIZE;
                // Escala para cobrir todo o círculo
                avatarPreviewScale = Math.max(frame / w, frame / h);
                avatarPreviewOffsetX = 0;
                avatarPreviewOffsetY = 0;
                atualizarTransformPreviewAvatar();
                modalPreviewAvatar.classList.remove('hidden');
            };
            avatarPreviewImage.src = e.target.result;
            avatarPreviewImg.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function fecharModalPreviewAvatar() {
        if (modalPreviewAvatar) {
            modalPreviewAvatar.classList.add('hidden');
        }
        if (inputFotoPerfil) {
            inputFotoPerfil.value = '';
        }
        avatarPreviewImage = null;
        avatarIsDragging = false;
    }

    // Arrastar para mover a imagem dentro do círculo
    if (avatarPreviewArea && avatarPreviewImg) {
        const iniciarDrag = (clientX, clientY) => {
            avatarIsDragging = true;
            dragStartX = clientX;
            dragStartY = clientY;
            avatarPreviewImg.classList.add('dragging');
        };

        const moverDrag = (clientX, clientY) => {
            if (!avatarIsDragging) return;
            const dx = clientX - dragStartX;
            const dy = clientY - dragStartY;
            dragStartX = clientX;
            dragStartY = clientY;
            avatarPreviewOffsetX += dx;
            avatarPreviewOffsetY += dy;
            atualizarTransformPreviewAvatar();
        };

        const finalizarDrag = () => {
            avatarIsDragging = false;
            avatarPreviewImg.classList.remove('dragging');
        };

        avatarPreviewArea.addEventListener('mousedown', (e) => {
            e.preventDefault();
            iniciarDrag(e.clientX, e.clientY);
        });
        window.addEventListener('mousemove', (e) => moverDrag(e.clientX, e.clientY));
        window.addEventListener('mouseup', finalizarDrag);

        avatarPreviewArea.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            iniciarDrag(touch.clientX, touch.clientY);
        }, { passive: true });
        window.addEventListener('touchmove', (e) => {
            if (!avatarIsDragging) return;
            const touch = e.touches[0];
            moverDrag(touch.clientX, touch.clientY);
        }, { passive: true });
        window.addEventListener('touchend', finalizarDrag);
        window.addEventListener('touchcancel', finalizarDrag);
    }

    // Salvar foto recortada (usando canvas)
    async function salvarPreviewAvatar() {
        if (!avatarPreviewImage || !isOwnProfile) return;

        const canvas = document.createElement('canvas');
        canvas.width = AVATAR_FRAME_SIZE;
        canvas.height = AVATAR_FRAME_SIZE;
        const ctx = canvas.getContext('2d');

        // Fundo preto para evitar áreas vazias
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, AVATAR_FRAME_SIZE, AVATAR_FRAME_SIZE);

        const w = avatarPreviewImage.width;
        const h = avatarPreviewImage.height;

        ctx.save();
        ctx.translate(AVATAR_FRAME_SIZE / 2 + avatarPreviewOffsetX, AVATAR_FRAME_SIZE / 2 + avatarPreviewOffsetY);
        ctx.scale(avatarPreviewScale, avatarPreviewScale);
        ctx.drawImage(avatarPreviewImage, -w / 2, -h / 2);
        ctx.restore();

        return new Promise((resolve) => {
            canvas.toBlob(async (blob) => {
                if (!blob) {
                    resolve(false);
                    return;
                }
                const formData = new FormData();
                formData.append('avatar', blob, 'avatar.jpg');

        try {
            const response = await fetch(`/api/editar-perfil/${loggedInUserId}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            
            const novaFoto = data.user.avatarUrl || data.user.foto;
            localStorage.setItem('userPhotoUrl', novaFoto);
            loadHeaderInfo();
            fetchUserProfile(); 
                    resolve(true);
        } catch (error) {
            console.error('Erro ao salvar foto:', error);
            alert('Erro ao salvar foto: ' + error.message);
                    resolve(false);
        } finally {
                    fecharModalPreviewAvatar();
        }
            }, 'image/jpeg', 0.9);
        });
    }
    
    if (inputFotoPerfil) {
        inputFotoPerfil.addEventListener('change', () => {
            const file = inputFotoPerfil.files[0];
            if (file) {
                abrirModalPreviewAvatar(file);
            }
        });
    }

    if (avatarPreviewCancelBtn) {
        avatarPreviewCancelBtn.addEventListener('click', () => {
            fecharModalPreviewAvatar();
        });
    }

    if (avatarPreviewSaveBtn) {
        avatarPreviewSaveBtn.addEventListener('click', () => {
            salvarPreviewAvatar();
        });
    }

    // ----------------------------------------------------------------------
    // LÓGICA DE AVALIAÇÃO, SERVIÇOS, MODAIS, LOGOUT, ETC.
    // ----------------------------------------------------------------------
    if (estrelasAvaliacao.length > 0) {
        estrelasAvaliacao.forEach(star => {
            star.addEventListener('click', () => {
                const value = star.dataset.value;
                if (formAvaliacao) formAvaliacao.dataset.value = value;
                estrelasAvaliacao.forEach(s => {
                    const sValue = s.dataset.value;
                    if (sValue <= value) s.innerHTML = '<i class="fas fa-star"></i>';
                    else s.innerHTML = '<i class="far fa-star"></i>';
                });
                if (notaSelecionada) notaSelecionada.textContent = `Você selecionou ${value} estrela(s).`;
            });
        });
    }

    // Se veio de uma notificação de serviço concluído, mostra a seção de avaliação e abre lembrete
    // (movidos para o topo para evitar hoist issues)
    const sanitizePedidoId = (id) => {
        if (!id) return null;
        const match = String(id).match(/[a-fA-F0-9]{24}/);
        return match ? match[0] : null;
    };

    const fotoServicoAvaliacaoUrlRaw = urlParams.get('foto') || urlParams.get('img') || sessionStorage.getItem('ultimaFotoPedido');
    const fotoUltimoLocal = localStorage.getItem('fotoUltimoServicoConcluido') || sessionStorage.getItem('fotoUltimoServicoConcluido');
    const ultimaFotoPedido = localStorage.getItem('ultimaFotoPedido') || sessionStorage.getItem('ultimaFotoPedido');
    // Busca qualquer fotoPedido:* caso outros fallbacks falhem
    function pegarPrimeiraFotoPedido() {
        let found = null;
        Object.keys(localStorage).some(k => {
            if (k.startsWith('fotoPedido:')) {
                found = localStorage.getItem(k);
                return true;
            }
            return false;
        });
        return found;
    }
    const pedidoIdAvaliacaoRaw = urlParams.get('pedidoId') || localStorage.getItem('pedidoIdUltimoServicoConcluido');
    const pedidoIdAvaliacaoLimpo = sanitizePedidoId(pedidoIdAvaliacaoRaw);
    
    // Tenta recuperar uma foto válida
    const fotoPedidoPorId = pedidoIdAvaliacaoLimpo ? (localStorage.getItem(`fotoPedido:${pedidoIdAvaliacaoLimpo}`) || sessionStorage.getItem(`fotoPedido:${pedidoIdAvaliacaoLimpo}`)) : null;
    const fotoServicoAvaliacaoUrl = (fotoServicoAvaliacaoUrlRaw && fotoServicoAvaliacaoUrlRaw.trim() !== '') ? fotoServicoAvaliacaoUrlRaw : null;
    let fotoServicoAvaliacao = fotoServicoAvaliacaoUrl || fotoUltimoLocal || fotoPedidoPorId || ultimaFotoPedido || pegarPrimeiraFotoPedido();
    const logSemFoto = () => {
        console.warn('Sem foto nos caches; exibindo fallback.', {
            fotoURL: fotoServicoAvaliacaoUrl,
            fotoUltimoLocal,
            fotoPedidoPorId,
            ultimaFotoPedido,
            pedidoIdAvaliacaoRaw,
            pedidoIdAvaliacaoLimpo
        });
    };

    // Captura de foto já renderizada na página (qualquer <img> com "pedidos-urgentes" no src)
    const tentarCapturarFotoDaPagina = () => {
        const img = document.querySelector('img[src*="pedidos-urgentes"]');
        if (img?.src) {
            localStorage.setItem('ultimaFotoPedido', img.src);
            localStorage.setItem('fotoUltimoServicoConcluido', img.src);
            if (pedidoIdAvaliacaoLimpo) {
                localStorage.setItem(`fotoPedido:${pedidoIdAvaliacaoLimpo}`, img.src);
            }
            return img.src;
        }
        return null;
    };
    // Busca o nome do serviço de várias fontes
    async function obterNomeServicoParaAvaliacao() {
        console.log('🔍 Buscando nome do serviço para avaliação...');
        
        // 1. Tenta da URL primeiro
        let nomeServico = urlParams.get('servico') || urlParams.get('titulo') || '';
        if (nomeServico && nomeServico !== 'Serviço concluído') {
            console.log('✅ Nome do serviço encontrado na URL:', nomeServico);
            return nomeServico;
        }
        
        // 2. Tenta do localStorage (mas ignora placeholders)
        const ultimoServicoNome = localStorage.getItem('ultimoServicoNome');
        const ultimaDescricaoPedido = localStorage.getItem('ultimaDescricaoPedido');
        const ultimaCategoriaPedido = localStorage.getItem('ultimaCategoriaPedido');
        
        // Limpa valores inválidos do localStorage
        if (ultimoServicoNome === 'Serviço concluído' || ultimoServicoNome === 'Serviço prestado') {
            localStorage.removeItem('ultimoServicoNome');
        }
        if (ultimaDescricaoPedido === 'Serviço concluído' || ultimaDescricaoPedido === 'Serviço prestado') {
            localStorage.removeItem('ultimaDescricaoPedido');
        }
        
        nomeServico = '';
        if (ultimoServicoNome && ultimoServicoNome !== 'Serviço concluído' && ultimoServicoNome !== 'Serviço prestado' && ultimoServicoNome.trim()) {
            nomeServico = ultimoServicoNome;
        } else if (ultimaDescricaoPedido && ultimaDescricaoPedido !== 'Serviço concluído' && ultimaDescricaoPedido !== 'Serviço prestado' && ultimaDescricaoPedido.trim()) {
            nomeServico = ultimaDescricaoPedido;
        } else if (ultimaCategoriaPedido && ultimaCategoriaPedido !== 'Serviço concluído' && ultimaCategoriaPedido !== 'Serviço prestado' && ultimaCategoriaPedido.trim()) {
            nomeServico = ultimaCategoriaPedido;
        }
        
        if (nomeServico) {
            console.log('✅ Nome do serviço encontrado no localStorage:', nomeServico);
            return nomeServico;
        }
        
        // 3. Busca do pedido se tiver pedidoId ou serviceScopeId
        const pedidoIdRaw = urlParams.get('pedidoId') || localStorage.getItem('pedidoIdUltimoServicoConcluido');
        const pedidoIdFromUrl = pedidoIdRaw ? String(pedidoIdRaw).match(/[a-fA-F0-9]{24}/)?.[0] : null;
        // Usa serviceScopeId como fallback se não tiver pedidoId na URL
        const pedidoId = pedidoIdFromUrl || (serviceScopeId ? String(serviceScopeId).match(/[a-fA-F0-9]{24}/)?.[0] : null);
        console.log('🔍 PedidoId encontrado:', pedidoId);
        console.log('🔍 serviceScopeId:', serviceScopeId);
        
        if (pedidoId) {
            try {
                const nomeCache = localStorage.getItem(`nomeServico:${pedidoId}`);
                if (nomeCache) {
                    console.log('✅ Nome do serviço encontrado no cache do pedido:', nomeCache);
                    return nomeCache;
                }
                
                console.log('🌐 Buscando nome do serviço da API do pedido:', pedidoId);
                const resp = await fetch(`/api/pedidos-urgentes/${pedidoId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (resp.ok) {
                    const data = await resp.json();
                    // A resposta pode vir como { pedido: {...} } ou diretamente como pedido
                    const pedido = data?.pedido || data;
                    console.log('📦 Resposta completa da API:', JSON.stringify(data, null, 2));
                    console.log('📦 Pedido extraído:', JSON.stringify(pedido, null, 2));
                    console.log('📦 Campos disponíveis:', Object.keys(pedido || {}));
                    console.log('📦 pedido.servico:', pedido?.servico);
                    console.log('📦 pedido.titulo:', pedido?.titulo);
                    console.log('📦 pedido.descricao:', pedido?.descricao);
                    
                    nomeServico = pedido?.servico || 
                                 pedido?.titulo || 
                                 pedido?.descricao || 
                                 pedido?.nome ||
                                 pedido?.categoria ||
                                 '';
                    console.log('📦 Nome do serviço extraído:', nomeServico);
                    
                    if (nomeServico && nomeServico.trim()) {
                        localStorage.setItem('ultimoServicoNome', nomeServico);
                        localStorage.setItem(`nomeServico:${pedidoId}`, nomeServico);
                        console.log('✅ Nome do serviço salvo:', nomeServico);
                        return nomeServico;
                    } else {
                        console.warn('⚠️ Nome do serviço está vazio ou inválido');
                    }
                } else {
                    console.warn('⚠️ Erro ao buscar pedido:', resp.status, resp.statusText);
                    const errorText = await resp.text();
                    console.warn('⚠️ Resposta de erro:', errorText);
                }
            } catch (e) {
                console.error('❌ Erro ao buscar nome do serviço do pedido:', e);
            }
        }
        
        // 4. Busca do agendamento se tiver agendamentoId
        const agendamentoId = agendamentoIdAvaliacao || urlParams.get('agendamentoId') || urlParams.get('agendamento');
        console.log('🔍 AgendamentoId encontrado:', agendamentoId);
        
        if (agendamentoId) {
            try {
                console.log('🌐 Buscando nome do serviço da API do agendamento');
                // Busca da lista de agendamentos do cliente e filtra pelo ID
                const resp = await fetch(`/api/agenda/cliente`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (resp.ok) {
                    const data = await resp.json();
                    const agendamento = data?.agendamentos?.find(a => 
                        a._id === agendamentoId || 
                        String(a._id) === String(agendamentoId)
                    );
                    console.log('📅 Agendamento encontrado:', agendamento);
                    nomeServico = agendamento?.servico || '';
                    if (nomeServico) {
                        localStorage.setItem('ultimoServicoNome', nomeServico);
                        console.log('✅ Nome do serviço do agendamento salvo:', nomeServico);
                        return nomeServico;
                    }
                } else {
                    console.warn('⚠️ Erro ao buscar agendamentos:', resp.status, resp.statusText);
                }
            } catch (e) {
                console.error('❌ Erro ao buscar nome do serviço do agendamento:', e);
            }
        }
        
        console.warn('⚠️ Nome do serviço não encontrado em nenhuma fonte');
        return '';
    }
    
    // Variável que será atualizada quando o nome do serviço for obtido
    let servicoNomeAvaliacao = 'Serviço concluído';
    
    // Flag para evitar criar múltiplos lembretes
    let lembreteCriado = false;

    async function abrirLembreteAvaliacao() {
        console.log('📝 abrirLembreteAvaliacao chamado, lembreteCriado:', lembreteCriado);
        
        // Busca o modal flutuante
        const modalLembrete = document.getElementById('modal-lembrete-avaliacao');
        const conteudoLembrete = document.getElementById('conteudo-lembrete-avaliacao');
        
        if (!modalLembrete || !conteudoLembrete) {
            console.error('❌ Modal de lembrete não encontrado no DOM');
            return;
        }
        
        // Verifica se o modal já está aberto
        if (!modalLembrete.classList.contains('hidden')) {
            console.log('⚠️ Modal de lembrete já está aberto, não criando novo');
            return;
        }
        
        // Limpa o conteúdo anterior
        conteudoLembrete.innerHTML = '';
        
        // IMPORTANTE: Remove mensagem "perfil já avaliado" se existir quando abre lembrete
        const secaoAvaliacoesVerificadas = document.getElementById('secao-avaliacoes-verificadas');
        if (secaoAvaliacoesVerificadas) {
            const h3Titulo = secaoAvaliacoesVerificadas.querySelector('h3');
            if (h3Titulo) {
                const mensagemAntiga = h3Titulo.querySelector('.mensagem-avaliado-pequena');
                if (mensagemAntiga) {
                    mensagemAntiga.remove();
                    console.log('✅ Mensagem "perfil já avaliado" removida ao abrir lembrete');
                }
            }
        }
        
        // Busca o nome do serviço antes de criar o lembrete
        console.log('📝 Abrindo lembrete de avaliação, buscando nome do serviço...');
        lembreteCriado = true;
        const nomeServico = await obterNomeServicoParaAvaliacao();
        servicoNomeAvaliacao = nomeServico || 'Serviço concluído';
        console.log('📝 Nome do serviço para exibição:', servicoNomeAvaliacao);
        
        if (!fotoServicoAvaliacao) {
            // Tenta capturar alguma foto já renderizada na página (pedidos/propostas)
            const fotoPage = tentarCapturarFotoDaPagina();
            if (fotoPage) {
                fotoServicoAvaliacao = fotoPage;
            }
        }

        if (!fotoServicoAvaliacao) {
            logSemFoto();
        }

        // Limpa qualquer lembrete anterior
        const lembreteExistente = secaoAvaliacao?.querySelector('.lembrete-avaliacao');
        if (lembreteExistente) {
            lembreteExistente.remove();
        }

        // Cria o card do lembrete dentro da seção de avaliação
        const card = document.createElement('div');
        card.className = 'lembrete-avaliacao';
        card.style.background = 'var(--bg-secondary, #111827)';
        card.style.border = '1px solid var(--border-color, #1f2937)';
        card.style.borderRadius = '12px';
        card.style.padding = '20px';
        card.style.width = '100%';
        card.style.marginBottom = '20px';
        card.style.color = 'var(--text-primary, #e5e7eb)';
        card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '15px';

        const title = document.createElement('h3');
        title.textContent = 'Avalie o serviço concluído';
        title.style.margin = '0';
        title.style.display = 'flex';
        title.style.alignItems = 'center';
        title.style.gap = '8px';
        title.innerHTML = '📷 Avalie o serviço concluído';

        const desc = document.createElement('p');
        desc.style.margin = '0';
        desc.style.color = 'var(--text-secondary, #9ca3af)';
        desc.textContent = servicoNomeAvaliacao;

        const imgWrapper = document.createElement('div');
        imgWrapper.style.width = '100%';
        imgWrapper.style.maxHeight = '260px';
        imgWrapper.style.borderRadius = '10px';
        imgWrapper.style.border = '1px solid var(--border-color, #1f2937)';
        imgWrapper.style.overflow = 'hidden';
        imgWrapper.style.background = 'rgba(255,255,255,0.03)';
        imgWrapper.style.display = 'flex';
        imgWrapper.style.alignItems = 'center';
        imgWrapper.style.justifyContent = 'center';
        imgWrapper.style.marginTop = '6px';

        const img = document.createElement('img');
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.alt = 'Foto do serviço';

        const imgFallback = document.createElement('div');
        imgFallback.style.width = '100%';
        imgFallback.style.height = '180px';
        imgFallback.style.display = 'flex';
        imgFallback.style.alignItems = 'center';
        imgFallback.style.justifyContent = 'center';
        imgFallback.style.color = 'var(--text-secondary, #9ca3af)';
        imgFallback.style.fontSize = '13px';
        imgFallback.textContent = 'Foto do serviço não disponível';

        if (fotoServicoAvaliacao) {
            img.src = fotoServicoAvaliacao;
            imgFallback.style.display = 'none';
            img.onerror = () => {
                img.style.display = 'none';
                imgFallback.style.display = 'flex';
            };
        } else {
            img.style.display = 'none';
            imgFallback.style.display = 'flex';
        }

        // Mini form de avaliação direto no lembrete
        const starsWrap = document.createElement('div');
        starsWrap.style.display = 'flex';
        starsWrap.style.gap = '8px';
        starsWrap.style.fontSize = '26px';
        starsWrap.style.cursor = 'pointer';
        starsWrap.style.userSelect = 'none';
        let selectedStar = 0;

        function renderStars(value) {
            Array.from(starsWrap.children).forEach((el) => {
                const val = Number(el.dataset.value);
                el.textContent = val <= value ? '★' : '☆';
                el.style.color = val <= value ? '#fbbf24' : 'var(--text-secondary, #9ca3af)';
            });
        }

        for (let i = 1; i <= 5; i++) {
            const s = document.createElement('span');
            s.dataset.value = String(i);
            s.textContent = '☆';
            s.addEventListener('click', () => {
                selectedStar = i;
                renderStars(selectedStar);
                if (formAvaliacao) formAvaliacao.dataset.value = String(selectedStar);
                if (notaSelecionada) notaSelecionada.textContent = `Você selecionou ${selectedStar} estrela(s).`;
            });
            starsWrap.appendChild(s);
        }

        const textarea = document.createElement('textarea');
        textarea.style.width = '100%';
        textarea.style.minHeight = '80px';
        textarea.style.resize = 'vertical';
        textarea.style.background = 'var(--bg-secondary, #111827)';
        textarea.style.color = 'var(--text-primary, #e5e7eb)';
        textarea.style.border = '1px solid var(--border-color, #1f2937)';
        textarea.style.borderRadius = '8px';
        textarea.style.padding = '10px';
        textarea.placeholder = 'Descreva como foi o serviço...';

        const hint = document.createElement('div');
        hint.style.fontSize = '13px';
        hint.style.color = 'var(--text-secondary, #9ca3af)';
        hint.textContent = 'Selecione as estrelas e envie sua avaliação aqui mesmo.';

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.justifyContent = 'flex-end';
        actions.style.gap = '10px';

        const btnFechar = document.createElement('button');
        btnFechar.textContent = 'Fechar';
        btnFechar.style.padding = '10px 14px';
        btnFechar.style.background = 'var(--bg-secondary, #111827)';
        btnFechar.style.color = 'var(--text-primary, #e5e7eb)';
        btnFechar.style.border = '1px solid var(--border-color, #1f2937)';
        btnFechar.style.borderRadius = '8px';
        btnFechar.style.cursor = 'pointer';

        const btnIr = document.createElement('button');
        btnIr.textContent = 'Enviar avaliação';
        btnIr.style.padding = '10px 14px';
        btnIr.style.background = '#22c55e';
        btnIr.style.color = '#0b121f';
        btnIr.style.border = 'none';
        btnIr.style.borderRadius = '8px';
        btnIr.style.cursor = 'pointer';
        btnIr.style.fontWeight = '700';

        // Função para fechar o modal flutuante
        const fecharModalLembrete = () => {
            const modalLembrete = document.getElementById('modal-lembrete-avaliacao');
            if (modalLembrete) {
                modalLembrete.classList.add('hidden');
                document.body.style.overflow = '';
            }
        };

        btnFechar.addEventListener('click', fecharModalLembrete);
        btnIr.addEventListener('click', () => {
            if (!selectedStar) {
                alert('Selecione a nota (estrelas) antes de enviar.');
                return;
            }
            if (formAvaliacao) formAvaliacao.dataset.value = String(selectedStar);
            if (notaSelecionada) notaSelecionada.textContent = `Você selecionou ${selectedStar} estrela(s).`;
            if (comentarioAvaliacaoInput) comentarioAvaliacaoInput.value = textarea.value;
            // dispara o mesmo fluxo do botão original
            if (btnEnviarAvaliacao) {
                btnEnviarAvaliacao.click();
            }
            // Após enviar via lembrete, evita reabrir
            // Usa os IDs da URL (não do localStorage) quando vem de notificação
            const pedidoIdParaMarcar = pedidoIdAvaliacao; // SEMPRE da URL quando vem de notificação
            const agendamentoIdParaMarcar = agendamentoIdAvaliacao; // SEMPRE da URL quando vem de notificação
            marcarAvaliacaoFeita(selectedStar, pedidoIdParaMarcar || null, agendamentoIdParaMarcar || null);
            
            // Fecha o modal flutuante
            const modalLembrete = document.getElementById('modal-lembrete-avaliacao');
            if (modalLembrete) {
                modalLembrete.classList.add('hidden');
                document.body.style.overflow = '';
            }
        });

        actions.appendChild(btnFechar);
        actions.appendChild(btnIr);

        card.appendChild(title);
        card.appendChild(desc);
        imgWrapper.appendChild(img);
        imgWrapper.appendChild(imgFallback);

        card.appendChild(imgWrapper);
        card.appendChild(starsWrap);
        card.appendChild(textarea);
        card.appendChild(hint);
        card.appendChild(actions);

        // Insere o card dentro do modal flutuante
        conteudoLembrete.appendChild(card);
        
        // Fecha modal ao clicar no overlay (fora do conteúdo)
        const fecharModalOverlay = (e) => {
            if (e.target === modalLembrete) {
                modalLembrete.classList.add('hidden');
                document.body.style.overflow = '';
            }
        };
        
        // Remove listener anterior se existir e adiciona novo
        modalLembrete.removeEventListener('click', fecharModalOverlay);
        modalLembrete.addEventListener('click', fecharModalOverlay);
        
        // Abre o modal flutuante
        modalLembrete.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        console.log('✅ Modal flutuante de lembrete aberto');
    }

    // Função para mostrar mensagem quando já avaliou (na seção de avaliações verificadas)
    // Só mostra se veio de notificação de serviço concluído E realmente já avaliou
    async function mostrarMensagemAvaliado() {
        // Só mostra se veio de notificação de serviço concluído
        if (!veioDeNotificacao) {
            console.log('📝 Não veio de notificação, não mostra mensagem');
            // Apenas esconde a seção de avaliação
            if (secaoAvaliacao) {
                secaoAvaliacao.style.display = 'none';
            }
            return;
        }
        
        // Verifica se realmente já avaliou este serviço específico antes de mostrar a mensagem
        const jaAvaliou = await avaliacaoJaFeita();
        if (!jaAvaliou) {
            console.log('⚠️ Veio de notificação mas NÃO avaliou ainda - não mostra mensagem "perfil já avaliado"');
            return; // Não mostra a mensagem se não avaliou
        }
        
        console.log('📝 Mostrando mensagem de perfil já avaliado (veio de notificação e realmente avaliou)...');
        
        // IMPORTANTE: Remove qualquer lembrete existente quando já avaliou
        if (secaoAvaliacao) {
            const lembreteExistente = secaoAvaliacao.querySelector('.lembrete-avaliacao');
            if (lembreteExistente) {
                lembreteExistente.remove();
                console.log('✅ Lembrete removido - já avaliou');
            }
            
            // Mantém a seção visível, apenas esconde o formulário se existir
            if (formAvaliacao) {
                formAvaliacao.style.display = 'none';
            }
            console.log('✅ Formulário escondido, mas seção mantida visível');
        }
        
        // Garante que as avaliações verificadas sejam carregadas primeiro
        if (profileId) {
            loadAvaliacoesVerificadas(profileId).then(() => {
                // Mostra a mensagem pequena no título h3
                const secaoAvaliacoesVerificadas = document.getElementById('secao-avaliacoes-verificadas');
                const h3Titulo = secaoAvaliacoesVerificadas?.querySelector('h3');
                
                if (secaoAvaliacoesVerificadas && h3Titulo) {
                    // Mostra a seção de avaliações verificadas
                    secaoAvaliacoesVerificadas.style.display = 'block';
                    console.log('✅ Seção de avaliações verificadas exibida');
                    
                    // Remove mensagem antiga se existir
                    const mensagemAntiga = h3Titulo.querySelector('.mensagem-avaliado-pequena');
                    if (mensagemAntiga) {
                        mensagemAntiga.remove();
                    }
                    
                    // Cria mensagem pequena no h3, ao lado do badge "Cliente Verificado"
                    const mensagemEl = document.createElement('span');
                    mensagemEl.className = 'mensagem-avaliado-pequena';
                    mensagemEl.style.cssText = 'color: #ffc107; font-size: 12px; font-weight: 600; margin-left: 10px; display: inline-flex; align-items: center; gap: 4px;';
                    mensagemEl.innerHTML = '<span style="color: #28a745;">✓</span> Perfil já avaliado';
                    h3Titulo.appendChild(mensagemEl);
                    console.log('✅ Mensagem "Perfil já avaliado" exibida no título');
                }
            });
        } else {
            // Se não tem profileId ainda, tenta novamente após um delay
            setTimeout(async () => {
                if (profileId) {
                    await mostrarMensagemAvaliado();
                }
            }, 500);
        }
    }

    // Flag para garantir que o modal só seja aberto uma vez
    let modalAvaliacaoAberto = false;
    
    // Garante que a seção comece oculta por padrão
    if (secaoAvaliacao) {
        secaoAvaliacao.style.display = 'none';
    }
    
    // Se tem hash de avaliação OU veio de notificação, sempre processa como fluxo de serviço
    if ((hashSecaoAvaliacao || veioDeNotificacao || isFluxoServico) && secaoAvaliacao) {
        console.log('🔍 Processando como fluxo de serviço/notificação:', {
            hashSecaoAvaliacao,
            veioDeNotificacao,
            isFluxoServico,
            origemAvaliacao
        });
        
        // Se veio de notificação OU tem hash de avaliação, SEMPRE esconde a seção (lembrete é flutuante)
        if (veioDeNotificacao || hashSecaoAvaliacao || origemAvaliacao === 'servico_concluido') {
            console.log('✅ Veio de notificação ou tem hash - escondendo seção (lembrete será flutuante)');
            // Esconde a seção quando vem de notificação - o lembrete será um modal flutuante
            secaoAvaliacao.style.display = 'none';
            
            // IMPORTANTE: Quando vem de notificação, SEMPRE esconde o formulário de avaliação geral
            // Apenas o lembrete flutuante deve aparecer
            if (formAvaliacao) {
                formAvaliacao.style.display = 'none';
                console.log('✅ Formulário de avaliação geral escondido (veio de notificação)');
            }
            
            // Verifica se já avaliou este serviço específico (assíncrono)
            (async () => {
                const jaAvaliou = await avaliacaoJaFeita();
                console.log('🔍 Resultado da verificação de avaliação:', {
                    jaAvaliou,
                    pedidoIdAvaliacao,
                    agendamentoIdAvaliacao,
                    pedidoIdUltimoServicoConcluido,
                    agendamentoIdUltimoServico,
                    origemAvaliacao
                });
                
                if (jaAvaliou) {
                    console.log('✅ Já avaliou este serviço específico, mostrando mensagem mas mantendo seção visível');
                    // Já avaliou: mostra mensagem mas mantém seção visível
                    // IMPORTANTE: Remove qualquer lembrete existente quando já avaliou
                    if (secaoAvaliacao) {
                        const lembreteExistente = secaoAvaliacao.querySelector('.lembrete-avaliacao');
                        if (lembreteExistente) {
                            lembreteExistente.remove();
                            console.log('✅ Lembrete removido - já avaliou');
                        }
                    }
                    await mostrarMensagemAvaliado();
                    // Garante que o formulário está escondido
                    if (formAvaliacao) formAvaliacao.style.display = 'none';
                    // Garante que não há lembrete visível
                    modalAvaliacaoAberto = false; // Permite criar novo lembrete se necessário
                } else {
                    console.log('✅ NÃO avaliou este serviço ainda - DEVE mostrar lembrete');
                    // Não avaliou: mostra lembrete (formulário já está escondido acima)
                    // IMPORTANTE: Remove mensagem "perfil já avaliado" se existir
                    const secaoAvaliacoesVerificadas = document.getElementById('secao-avaliacoes-verificadas');
                    if (secaoAvaliacoesVerificadas) {
                        const h3Titulo = secaoAvaliacoesVerificadas.querySelector('h3');
                        if (h3Titulo) {
                            const mensagemAntiga = h3Titulo.querySelector('.mensagem-avaliado-pequena');
                            if (mensagemAntiga) {
                                mensagemAntiga.remove();
                                console.log('✅ Mensagem "perfil já avaliado" removida - não avaliou ainda');
                            }
                        }
                    }
                    if (!modalAvaliacaoAberto) {
                        console.log('🚀 Chamando abrirLembreteAvaliacao()...');
                        modalAvaliacaoAberto = true;
                        // Garante que a seção está oculta (lembrete será flutuante)
                        if (secaoAvaliacao) {
                            secaoAvaliacao.style.display = 'none';
                            console.log('✅ Seção mantida oculta (lembrete será flutuante)');
                        }
                        await abrirLembreteAvaliacao();
                        console.log('✅ abrirLembreteAvaliacao() concluído');
                    } else {
                        console.log('⚠️ modalAvaliacaoAberto já é true, não abrindo lembrete');
                    }
                }
            })();
        } else if (temParametrosExplicitos) {
            // Tem parâmetros explícitos mas não veio de notificação (caso raro)
            (async () => {
                const jaAvaliou = await avaliacaoJaFeita();
                if (!jaAvaliou && !modalAvaliacaoAberto) {
        secaoAvaliacao.style.display = 'block';
        if (formAvaliacao) formAvaliacao.style.display = 'none';
                    modalAvaliacaoAberto = true;
                    abrirLembreteAvaliacao();
                } else if (jaAvaliou) {
                    // Já avaliou: esconde seção de avaliação
                    secaoAvaliacao.style.display = 'none';
                    await mostrarMensagemAvaliado();
                }
            })();
        } else {
            // Verifica se já avaliou (assíncrono)
            (async () => {
                const jaAvaliou = await avaliacaoJaFeita();
                if (jaAvaliou) {
                    // Já avaliou: esconde seção de avaliação
                    secaoAvaliacao.style.display = 'none';
                    await mostrarMensagemAvaliado();
                }
            })();
        }
    } else if (secaoAvaliacao) {
        // Se tem hash de avaliação, não é visita normal - já foi processado acima
        if (hashSecaoAvaliacao || origemAvaliacao === 'servico_concluido') {
            console.log('🔍 Tem hash ou origem, não processando como visita normal');
            return;
        }
        
        // Visita normal: começa oculta e verifica se já avaliou (assíncrono)
        // IMPORTANTE: Só esconde se NÃO veio de notificação (para não esconder quando o lembrete está sendo mostrado)
        if (!veioDeNotificacao && !hashSecaoAvaliacao && origemAvaliacao !== 'servico_concluido') {
            secaoAvaliacao.style.display = 'none'; // Começa oculta apenas em visita normal
            console.log('✅ Visita normal - seção escondida');
        } else {
            console.log('⚠️ Veio de notificação - mantendo seção visível para mostrar lembrete');
        }
        
        (async () => {
            // IMPORTANTE: A seção já está oculta, só mostra se realmente não avaliou
            console.log('🔍 Iniciando verificação assíncrona para visita normal...');
            
            // Primeiro verifica storage (assíncrono)
            const jaAvaliouStorage = await avaliacaoJaFeita();
            
            if (jaAvaliouStorage) {
                console.log('✅ Visita normal - já avaliou (storage), mantendo seção OCULTA');
                secaoAvaliacao.style.display = 'none';
                await mostrarMensagemAvaliado();
                return;
            }
            
            // Se não tem no storage, verifica via API ANTES de mostrar
            console.log('🔍 Verificando via API se já avaliou este perfil...');
            const jaAvaliouAPI = await verificarAvaliacaoJaFeitaAPI();
            
            if (jaAvaliouAPI) {
                console.log('✅ Visita normal - já avaliou (API), mantendo seção OCULTA');
                secaoAvaliacao.style.display = 'none';
                await mostrarMensagemAvaliado();
            } else {
                // Só mostra se REALMENTE não avaliou E não for o próprio perfil E não veio de notificação
                if (!isOwnProfile && !veioDeNotificacao && !hashSecaoAvaliacao && origemAvaliacao !== 'servico_concluido') {
                    console.log('✅ Visita normal - PRIMEIRA VISITA confirmada, mostrando seção de avaliação');
        secaoAvaliacao.style.display = 'block';
                    // Mostra o formulário também na primeira visita
                    if (formAvaliacao) formAvaliacao.style.display = 'block';
                } else if (veioDeNotificacao || hashSecaoAvaliacao || origemAvaliacao === 'servico_concluido') {
                    console.log('⚠️ Veio de notificação, não mostrando formulário de primeira visita');
                } else {
                    console.log('✅ Visita normal - próprio perfil, mantendo seção OCULTA');
                    secaoAvaliacao.style.display = 'none';
                }
            }
        })();
    }

    // REMOVIDO: Código duplicado - já está sendo processado acima no bloco principal
    // Isso estava causando duplicação de processamento e problemas na exibição

    // Bloqueia avaliação geral se já feita nesta sessão (exceto fluxo de serviço concluído)
    (async () => {
        if (!(await avaliacaoLiberadaGeral())) {
            await bloquearAvaliacaoGeral();
    }
    })();

    if (btnEnviarAvaliacao) {
        btnEnviarAvaliacao.addEventListener('click', async (e) => {
            e.preventDefault();
            const estrelas = formAvaliacao.dataset.value;
            const comentario = comentarioAvaliacaoInput.value;

            if (!estrelas || estrelas == 0) {
                alert('Por favor, selecione pelo menos uma estrela.');
                return;
            }

            try {
                let response;
                let data;

                // payload comum (inclui nome do serviço se disponível)
                // Busca o nome do serviço de várias fontes, incluindo a função assíncrona
                console.log('📤 Enviando avaliação, buscando nome do serviço...');
                console.log('📤 servicoNomeAvaliacao atual:', servicoNomeAvaliacao);
                console.log('📤 serviceScopeId:', serviceScopeId);
                console.log('📤 agendamentoIdAvaliacao:', agendamentoIdAvaliacao);
                console.log('📤 pedidoId da URL:', urlParams.get('pedidoId'));
                
                let nomeServicoPayload = '';
                
                // Primeiro tenta buscar assincronamente para garantir que temos o nome correto
                const nomeAsync = await obterNomeServicoParaAvaliacao();
                if (nomeAsync && nomeAsync !== 'Serviço concluído') {
                    nomeServicoPayload = nomeAsync;
                    console.log('✅ Nome do serviço encontrado via busca assíncrona:', nomeServicoPayload);
                } else {
                    // Fallback para outras fontes
                    nomeServicoPayload = servicoNomeAvaliacao && servicoNomeAvaliacao !== 'Serviço concluído' 
                        ? servicoNomeAvaliacao 
                        : urlParams.get('servico') || 
                          urlParams.get('titulo') ||
                    localStorage.getItem('nomeServicoConcluido') ||
                    (serviceScopeId ? localStorage.getItem(`nomeServico:${serviceScopeId}`) : '') ||
                    localStorage.getItem('ultimoServicoNome') ||
                    localStorage.getItem('ultimaDescricaoPedido') ||
                    '';
                    console.log('📤 Nome do serviço do fallback:', nomeServicoPayload);
                }
                
                // Se ainda não encontrou, tenta buscar do pedido diretamente usando serviceScopeId ou pedidoId
                if (!nomeServicoPayload || nomeServicoPayload === 'Serviço concluído' || nomeServicoPayload.trim() === '') {
                    const pedidoIdRaw = urlParams.get('pedidoId') || localStorage.getItem('pedidoIdUltimoServicoConcluido');
                    const pedidoIdFromUrl = pedidoIdRaw ? String(pedidoIdRaw).match(/[a-fA-F0-9]{24}/)?.[0] : null;
                    // Usa serviceScopeId como fallback se não tiver pedidoId na URL
                    const pedidoId = pedidoIdFromUrl || (serviceScopeId ? String(serviceScopeId).match(/[a-fA-F0-9]{24}/)?.[0] : null);
                    
                    console.log('🔍 Tentando buscar do pedido com ID:', pedidoId);
                    
                    if (pedidoId) {
                        try {
                            // Primeiro tenta do cache
                            const nomeCache = localStorage.getItem(`nomeServico:${pedidoId}`);
                            if (nomeCache && nomeCache !== 'Serviço concluído') {
                                nomeServicoPayload = nomeCache;
                                console.log('✅ Nome do serviço encontrado no cache:', nomeServicoPayload);
                            } else {
                                // Busca da API
                                const resp = await fetch(`/api/pedidos-urgentes/${pedidoId}`, {
                                    headers: { 'Authorization': `Bearer ${token}` }
                                });
                                if (resp.ok) {
                                    const data = await resp.json();
                                    // A resposta vem como { success: true, pedido: {...} }
                                    const pedido = data?.pedido || data;
                                    console.log('📦 Resposta da API (busca direta):', JSON.stringify(data, null, 2));
                                    console.log('📦 Pedido extraído (busca direta):', JSON.stringify(pedido, null, 2));
                                    nomeServicoPayload = pedido?.servico || 
                                                         pedido?.titulo || 
                                                         pedido?.descricao || 
                                                         pedido?.nome ||
                                                         pedido?.categoria ||
                                                         '';
                                    console.log('📦 Nome do serviço extraído (busca direta):', nomeServicoPayload);
                                    if (nomeServicoPayload && nomeServicoPayload.trim()) {
                                        console.log('✅ Nome do serviço encontrado do pedido direto:', nomeServicoPayload);
                                        localStorage.setItem('ultimoServicoNome', nomeServicoPayload);
                                        localStorage.setItem(`nomeServico:${pedidoId}`, nomeServicoPayload);
                                    } else {
                                        console.warn('⚠️ Nome do serviço está vazio após extração');
                                    }
                                } else {
                                    console.warn('⚠️ Erro ao buscar pedido:', resp.status, resp.statusText);
                                    const errorText = await resp.text();
                                    console.warn('⚠️ Resposta de erro:', errorText);
                                }
                            }
                        } catch (e) {
                            console.error('❌ Erro ao buscar pedido direto:', e);
                        }
                    } else {
                        console.warn('⚠️ Nenhum pedidoId ou serviceScopeId encontrado para buscar o nome do serviço');
                    }
                }
                
                console.log('📤 Nome do serviço final para envio:', nomeServicoPayload);
                console.log('📤 Payload completo que será enviado:', {
                    profissionalId: profileId,
                    agendamentoId: agendamentoIdAvaliacao,
                    estrelas: parseInt(estrelas, 10),
                    servico: nomeServicoPayload
                });

                // Avaliação verificada (veio de serviço concluído)
                // Cada notificação já tem seu próprio pedidoId/agendamentoId - não precisa buscar nada!
                let agendamentoIdFinal = agendamentoIdAvaliacao;
                let pedidoUrgenteIdFinal = null;
                
                // Prioriza pedidoId da URL (vem diretamente da notificação)
                const pedidoIdDaUrl = urlParams.get('pedidoId');
                if (pedidoIdDaUrl) {
                    const pidClean = String(pedidoIdDaUrl).match(/[a-fA-F0-9]{24}/)?.[0];
                    if (pidClean) {
                        // Para pedidos urgentes, usa diretamente como pedidoUrgenteId
                        // Não precisa buscar agendamentoId - cada notificação já tem seu próprio pedidoId
                        pedidoUrgenteIdFinal = pidClean;
                        console.log('📦 Usando pedidoUrgenteId da URL (notificação):', pedidoUrgenteIdFinal);
                    }
                }
                // Se não tem pedidoId na URL mas tem agendamentoId, usa ele (serviço agendado)
                else if (agendamentoIdFinal) {
                    console.log('📦 Usando agendamentoId da URL:', agendamentoIdFinal);
                }
                
                // Cria avaliação verificada se tem agendamentoId OU pedidoUrgenteId
                if (isFluxoServico && (agendamentoIdFinal || pedidoUrgenteIdFinal)) {
                    const payload = {
                        profissionalId: profileId,
                        estrelas: parseInt(estrelas, 10),
                        comentario: comentario,
                        dataServico: new Date().toISOString(),
                        servico: nomeServicoPayload
                    };
                    
                    // Adiciona agendamentoId ou pedidoUrgenteId conforme disponível
                    if (agendamentoIdFinal) {
                        payload.agendamentoId = agendamentoIdFinal;
                    }
                    if (pedidoUrgenteIdFinal) {
                        payload.pedidoUrgenteId = pedidoUrgenteIdFinal;
                    }
                    console.log('📤 Enviando avaliação verificada com payload:', JSON.stringify(payload, null, 2));
                    
                    response = await fetch('/api/avaliacao-verificada', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });
                    data = await response.json();
                    if (!response.ok) throw new Error(data.message || 'Erro ao enviar avaliação verificada.');
                    localStorage.setItem('ultimaAvaliacaoClienteId', loggedInUserId || userId || '');
                    if (nomeServicoPayload) localStorage.setItem('ultimaAvaliacaoServico', nomeServicoPayload);
                    alert('Avaliação verificada enviada com sucesso! Obrigado por avaliar o serviço.');
                    
                    // Marca como avaliado - passa os IDs do serviço que foi avaliado
                    marcarAvaliacaoFeita(estrelas, pedidoUrgenteIdFinal || null, agendamentoIdFinal || null);
                    
                    // Esconde a seção de avaliação e mostra mensagem nas avaliações verificadas
                    await mostrarMensagemAvaliado();
                    
                    // Recarrega as avaliações verificadas para mostrar a nova avaliação
                    if (profileId) {
                        loadAvaliacoesVerificadas(profileId);
                    }
                } else {
                    // Bloqueio: só 1 avaliação geral por visita/sessão
                    if (!avaliacaoLiberadaGeral()) {
                        alert('Você já avaliou este perfil nesta visita. Para avaliar de novo, use o link enviado após concluir um serviço.');
                        return;
                    }

                    // Avaliação geral do trabalhador
                    response = await fetch('/api/avaliar-trabalhador', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            trabalhadorId: profileId,
                            estrelas: parseInt(estrelas, 10),
                            comentario: comentario,
                            servico: nomeServicoPayload
                        })
                    });
                    data = await response.json();
                    if (!response.ok) throw new Error(data.message || 'Erro ao enviar avaliação.');
                    alert('Avaliação enviada com sucesso!');
                    // Marca bloqueio na sessão/localStorage - usa IDs do localStorage se não estiverem na URL
                    const pedidoIdParaMarcar = pedidoIdAvaliacao || pedidoIdUltimoServicoConcluido;
                    const agendamentoIdParaMarcar = agendamentoIdAvaliacao || agendamentoIdUltimoServico;
                    marcarAvaliacaoFeita(estrelas, pedidoIdParaMarcar || null, agendamentoIdParaMarcar || null);
                    localStorage.setItem('ultimaAvaliacaoClienteId', loggedInUserId || userId || '');
                    if (nomeServicoPayload) localStorage.setItem('ultimaAvaliacaoServico', nomeServicoPayload);
                    
                    // Esconde a seção de avaliação e mostra mensagem nas avaliações verificadas
                    await mostrarMensagemAvaliado();
                    
                    // Recarrega as avaliações verificadas para mostrar a nova avaliação
                    if (profileId) {
                        loadAvaliacoesVerificadas(profileId);
                    }
                    // Guarda a última avaliação geral para exibir no quadro de verificadas quando não houver outras
                    try {
                    const cacheKey = `ultimaAvaliacaoGeral:${profileId}:${loggedInUserId || userId || ''}`;
                    const nomeViewer = (localStorage.getItem('userName') || 'Você').trim();
                    const fotoViewer = localStorage.getItem('userPhotoUrl') || 'imagens/default-user.png';
                    const servicoNomeLink =
                        urlParams.get('servico') ||
                        urlParams.get('titulo') ||
                        localStorage.getItem('ultimoServicoNome') ||
                        localStorage.getItem('ultimaDescricaoPedido') ||
                        localStorage.getItem('ultimaCategoriaPedido') ||
                        localStorage.getItem('ultimaDemanda') ||
                        'Serviço concluído';
                        const cacheObj = {
                            clienteId: { _id: loggedInUserId || userId || '', nome: nomeViewer, avatarUrl: fotoViewer },
                            estrelas: parseInt(estrelas, 10),
                            comentario,
                            dataServico: new Date().toISOString(),
                            agendamentoId: { servico: servicoNomeLink },
                            servico: servicoNomeLink,
                            servicoNome: servicoNomeLink,
                            origemLocal: true
                        };
                        localStorage.setItem(cacheKey, JSON.stringify(cacheObj));
                    } catch (e) {
                        console.warn('Falha ao salvar cache da avaliação local:', e);
                    }
                    await bloquearAvaliacaoGeral();
                }

                // Limpa formulário
                formAvaliacao.reset();
                estrelasAvaliacao.forEach(s => s.innerHTML = '<i class="far fa-star"></i>');
                if (notaSelecionada) notaSelecionada.textContent = '';

                // Recarrega perfil para atualizar métricas
                fetchUserProfile();
            } catch (error) {
                console.error('Erro ao enviar avaliação:', error);
                alert(error.message);
            }
        });
    }
    // 🆕 ATUALIZADO: Usa modal para adicionar projeto
    const modalAdicionarProjeto = document.getElementById('modal-adicionar-projeto');
    const formAdicionarProjeto = document.getElementById('form-adicionar-projeto');
    const projetoTagDesafioInput = document.getElementById('projeto-tag-desafio');
    const projetoUploadBtn = document.getElementById('projeto-upload-btn');
    const projetoImagensInput = document.getElementById('projeto-imagens');
    const projetoPreviewContainer = document.getElementById('projeto-preview-container');
    const projetoContadorMidia = document.getElementById('projeto-contador-midia');
    const PROJETO_MAX_MIDIAS = 5;
    let projetoArquivosSelecionados = [];
    let isAddingMoreMidia = false;

    function resetAdicionarProjetoPreview() {
        if (projetoPreviewContainer) {
            projetoPreviewContainer.innerHTML = '';
        }
        if (projetoUploadBtn) {
            projetoUploadBtn.style.display = 'inline-flex';
        }
        if (projetoImagensInput) {
            projetoImagensInput.value = '';
        }
        if (projetoContadorMidia) {
            projetoContadorMidia.classList.add('oculto');
            projetoContadorMidia.textContent = `0/${PROJETO_MAX_MIDIAS}`;
        }
        projetoArquivosSelecionados = [];
        isAddingMoreMidia = false;
    }

    if (projetoUploadBtn && projetoImagensInput) {
        projetoUploadBtn.addEventListener('click', () => {
            projetoImagensInput.click();
        });
    }

    function renderProjetoPreview(files) {
        if (!projetoPreviewContainer || !projetoImagensInput || !projetoUploadBtn) return;

        projetoPreviewContainer.innerHTML = '';

        if (!files || files.length === 0) {
            projetoUploadBtn.style.display = 'inline-flex';
            if (projetoContadorMidia) {
                projetoContadorMidia.classList.add('oculto');
                projetoContadorMidia.textContent = `0/${PROJETO_MAX_MIDIAS}`;
            }
            return;
        }

        if (projetoContadorMidia) {
            projetoContadorMidia.classList.remove('oculto');
            projetoContadorMidia.textContent = `${files.length}/${PROJETO_MAX_MIDIAS}`;
        }

        // Esconde o botão grande e passa a usar o "quadradinho +" dentro das miniaturas
        projetoUploadBtn.style.display = 'none';

        Array.from(files).forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'projeto-preview-item';

            let mediaElement;
            if (file.type.startsWith('image/')) {
                mediaElement = document.createElement('img');
            } else if (file.type.startsWith('video/')) {
                mediaElement = document.createElement('video');
                mediaElement.muted = true;
                mediaElement.playsInline = true;
            } else {
                mediaElement = document.createElement('div');
                mediaElement.textContent = file.name;
                mediaElement.style.fontSize = '10px';
                mediaElement.style.textAlign = 'center';
            }

            if (mediaElement instanceof HTMLImageElement || mediaElement instanceof HTMLVideoElement) {
                mediaElement.src = URL.createObjectURL(file);
            }

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'projeto-preview-remove';
            removeBtn.innerHTML = '&times;';
            removeBtn.addEventListener('click', () => {
                // Remove o arquivo correspondente da lista em memória
                projetoArquivosSelecionados = projetoArquivosSelecionados.filter((_, i) => i !== index);

                // Atualiza o FileList do input com os arquivos restantes
                const dt = new DataTransfer();
                projetoArquivosSelecionados.forEach(f => dt.items.add(f));
                projetoImagensInput.files = dt.files;

                renderProjetoPreview(projetoImagensInput.files);
            });

            item.appendChild(mediaElement);
            item.appendChild(removeBtn);
            projetoPreviewContainer.appendChild(item);
        });

        // Botão "+" para adicionar mais mídias (apenas se ainda não chegou no limite)
        if (files.length < PROJETO_MAX_MIDIAS) {
            const addItem = document.createElement('button');
            addItem.type = 'button';
            addItem.className = 'projeto-preview-item projeto-preview-add';
            addItem.innerHTML = '<span>+</span>';
            addItem.addEventListener('click', () => {
                isAddingMoreMidia = true;
                projetoImagensInput.click();
            });
            projetoPreviewContainer.appendChild(addItem);
        }
    }

    if (projetoImagensInput && projetoPreviewContainer) {
        projetoImagensInput.addEventListener('change', (e) => {
            const novosArquivos = Array.from(e.target.files || []);

            let arquivosCombinados;
            if (isAddingMoreMidia && projetoArquivosSelecionados.length) {
                arquivosCombinados = projetoArquivosSelecionados.concat(novosArquivos);
            } else {
                arquivosCombinados = novosArquivos;
            }

            if (arquivosCombinados.length > PROJETO_MAX_MIDIAS) {
                const excedente = arquivosCombinados.length - PROJETO_MAX_MIDIAS;
                alert(`Você pode adicionar no máximo ${PROJETO_MAX_MIDIAS} fotos/vídeos por projeto. ${excedente} arquivo(s) extra(s) foram ignorado(s).`);
                arquivosCombinados = arquivosCombinados.slice(0, PROJETO_MAX_MIDIAS);
            }

            projetoArquivosSelecionados = arquivosCombinados;

            isAddingMoreMidia = false;

            // Recria o FileList real do input a partir do array acumulado
            const dt = new DataTransfer();
            projetoArquivosSelecionados.forEach(f => dt.items.add(f));
            projetoImagensInput.files = dt.files;

            renderProjetoPreview(projetoImagensInput.files);
        });
    }

    if (addServicoBtn && modalAdicionarProjeto) {
        addServicoBtn.addEventListener('click', () => {
            modalAdicionarProjeto.classList.remove('hidden');
            resetAdicionarProjetoPreview();
        });
    }
    
    // 🆕 NOVO: Listener para formulário de validação
    const formValidarProjeto = document.getElementById('form-validar-projeto');
    if (formValidarProjeto) {
        formValidarProjeto.addEventListener('submit', async (e) => {
            e.preventDefault();
            const modalValidacao = document.getElementById('modal-validar-projeto');
            const servicoId = modalValidacao?.dataset.servicoId;
            const comentario = document.getElementById('comentario-validacao').value;
            
            if (servicoId) {
                await enviarValidacao(servicoId, comentario);
                modalValidacao?.classList.add('hidden');
                formValidarProjeto.reset();
            }
        });
    }
    
    if (formAdicionarProjeto) {
        formAdicionarProjeto.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData();
            formData.append('title', document.getElementById('projeto-titulo').value);
            formData.append('description', document.getElementById('projeto-descricao').value);
            formData.append('desafio', document.getElementById('projeto-desafio').value || '');
            formData.append('tecnologias', document.getElementById('projeto-tecnologias').value || '');

            const tagDesafioTexto = (projetoTagDesafioInput?.value || '').trim();
            formData.append('isDesafioHelpy', !!tagDesafioTexto);
            formData.append('tagDesafio', tagDesafioTexto);
            
            const files = document.getElementById('projeto-imagens').files;
            for (const file of files) {
                formData.append('images', file);
            }
            
            try {
                const response = await fetch('/api/servico', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Erro ao criar projeto.');
                
                alert('Projeto adicionado ao portfólio com sucesso!');
                formAdicionarProjeto.reset();
                resetAdicionarProjetoPreview();
                modalAdicionarProjeto?.classList.add('hidden');
                fetchUserProfile();
            } catch (error) {
                console.error('Erro ao criar projeto:', error);
                alert(error.message);
            }
        });
    }
    async function handleDeleteServico(event) { event.stopPropagation(); const button = event.currentTarget; const servicoId = button.dataset.id; const servicoElement = button.closest('.servico-item-container'); if (!confirm('Tem certeza que deseja remover este serviço? Isso removerá as imagens associadas.')) return; try { const response = await fetch(`/api/user/${loggedInUserId}/servicos/${servicoId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); const data = await response.json(); if (response.ok && data.success) { alert('Serviço removido com sucesso!'); servicoElement.remove(); } else { throw new Error(data.message || 'Erro ao remover serviço.'); } } catch (error) { console.error('Erro ao remover serviço:', error); alert(error.message); } }
    // 🆕 ATUALIZADO: Mostra detalhes do projeto com comentários de validação
    async function handleShowServicoDetails(event) {
        const servicoId = event.currentTarget.closest('.servico-item').dataset.id;
        if (!servicoId) return;
        
        try {
            const response = await fetch(`/api/servico/${servicoId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Projeto não encontrado');
            
            const servico = await response.json();
            
            // Cria modal de detalhes do projeto
            const modalDetalhes = document.getElementById('modal-detalhes-projeto') || criarModalDetalhesProjeto();
            
            // Preenche informações
            document.getElementById('projeto-detalhes-titulo').textContent = servico.title || 'Projeto';
            document.getElementById('projeto-detalhes-descricao').textContent = servico.description || 'Sem descrição';
            document.getElementById('projeto-detalhes-desafio').textContent = servico.desafio || 'Não informado';
            
            // Tecnologias
            const tecnologiasContainer = document.getElementById('projeto-detalhes-tecnologias');
            if (tecnologiasContainer) {
                if (servico.tecnologias && servico.tecnologias.length > 0) {
                    tecnologiasContainer.innerHTML = servico.tecnologias.map(t => `<span class="tag-tecnologia">${t}</span>`).join('');
                } else {
                    tecnologiasContainer.innerHTML = '<span>Nenhuma tecnologia informada</span>';
                }
            }
            
            // Validações por pares
            const validacoesContainer = document.getElementById('projeto-detalhes-validacoes');
            if (validacoesContainer && servico.validacoesPares && servico.validacoesPares.length > 0) {
                validacoesContainer.innerHTML = servico.validacoesPares.map(v => {
                    const prof = v.profissionalId;
                    return `
                        <div class="validacao-item">
                            <img src="${prof.foto || prof.avatarUrl || 'imagens/default-user.png'}" alt="${prof.nome}" class="validacao-avatar">
                            <div class="validacao-info">
                                <strong>${prof.nome}</strong>
                                <p>${v.comentario || 'Validou este projeto'}</p>
                                <small>${new Date(v.dataValidacao).toLocaleDateString('pt-BR')}</small>
                            </div>
                            <span class="validacao-badge">🛡️</span>
                        </div>
                    `;
                }).join('');
            } else if (validacoesContainer) {
                validacoesContainer.innerHTML = '<p class="mensagem-vazia">Nenhuma validação ainda.</p>';
            }
            
            // Imagens
            const imagensContainer = document.getElementById('projeto-detalhes-imagens');
            if (imagensContainer && servico.images && servico.images.length > 0) {
                imagensContainer.innerHTML = servico.images.map(img => 
                    `<img src="${img}" alt="Projeto" class="projeto-imagem-detalhe">`
                ).join('');
            }
            
            modalDetalhes.classList.remove('hidden');
            
            // 🆕 NOVO: Adiciona listener para fechar modal
            const btnClose = modalDetalhes.querySelector('.btn-close-modal');
            if (btnClose) {
                btnClose.onclick = () => modalDetalhes.classList.add('hidden');
            }
            
            // Fecha ao clicar fora
            modalDetalhes.onclick = (e) => {
                if (e.target === modalDetalhes) {
                    modalDetalhes.classList.add('hidden');
                }
            };
        } catch (error) {
            console.error("Erro ao buscar detalhes do projeto:", error);
            alert('Não foi possível carregar os detalhes deste projeto.');
        }
    }
    
    function criarModalDetalhesProjeto() {
        const modal = document.createElement('div');
        modal.id = 'modal-detalhes-projeto';
        modal.className = 'modal-overlay hidden';
        modal.innerHTML = `
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h3>Detalhes do Projeto</h3>
                    <button class="btn-close-modal" data-modal="modal-detalhes-projeto">&times;</button>
                </div>
                <div class="modal-body">
                    <h4 id="projeto-detalhes-titulo"></h4>
                    <p id="projeto-detalhes-descricao"></p>
                    <div><strong>Desafio:</strong> <span id="projeto-detalhes-desafio"></span></div>
                    <div><strong>Tecnologias:</strong> <div id="projeto-detalhes-tecnologias" class="tecnologias-tags"></div></div>
                    <div id="projeto-detalhes-imagens" class="projeto-imagens-detalhes"></div>
                    <h5>Validações por Pares 🛡️</h5>
                    <div id="projeto-detalhes-validacoes" class="validacoes-lista"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }
    // 🆕 ATUALIZADO: Sistema de abas corrigido
    function setupSectionSwitching() {
        if (!mostrarServicosBtn || !mostrarPostagensBtn || !secaoServicos || !secaoPostagens) return;
        
        // Função para alternar entre seções
        function mostrarSecao(secaoAtiva) {
            // Esconde todas
            secaoServicos.style.display = 'none';
            secaoPostagens.style.display = 'none';
            
            // Mostra a ativa
            secaoAtiva.style.display = 'block';
            
            // Atualiza botões
            mostrarServicosBtn.classList.toggle('ativo', secaoAtiva === secaoServicos);
            mostrarPostagensBtn.classList.toggle('ativo', secaoAtiva === secaoPostagens);
            
            // Carrega dados se necessário
            if (secaoAtiva === secaoServicos && galeriaServicos && galeriaServicos.children.length === 0) {
                fetchServicos(loggedInUserId || userId);
            }
            if (secaoAtiva === secaoPostagens && minhasPostagensContainer && minhasPostagensContainer.children.length === 0) {
                fetchPostagens(loggedInUserId || userId);
            }
        }
        
        mostrarServicosBtn.addEventListener('click', (e) => {
            e.preventDefault();
            mostrarSecao(secaoServicos);
        });

        mostrarPostagensBtn.addEventListener('click', (e) => {
            e.preventDefault();
            mostrarSecao(secaoPostagens);
        });
        
        // Mostra a seção padrão (Projetos para trabalhadores, Postagens para outros)
        if (userType === 'trabalhador' && mostrarServicosBtn.style.display !== 'none') {
            mostrarSecao(secaoServicos);
        } else {
            mostrarSecao(secaoPostagens);
        }
    }
    if (fotoPerfil) { fotoPerfil.style.cursor = 'pointer'; fotoPerfil.addEventListener('click', () => { if (fotoPerfil.src && imageModal && modalImage) { modalImage.src = fotoPerfil.src; imageModal.classList.add('visible'); } }); }
    if (closeImageModalBtn) { closeImageModalBtn.addEventListener('click', () => { imageModal.classList.remove('visible'); }); }
    if (imageModal) { imageModal.addEventListener('click', (e) => { if (e.target.id === 'image-modal' || e.target.classList.contains('image-modal-overlay')) { imageModal.classList.remove('visible'); } }); }
    if (feedButton) { 
        feedButton.addEventListener('click', (e) => { 
            e.preventDefault(); 
            window.location.href = '/'; 
        }); 
    }
    if (profileButton) { 
        profileButton.addEventListener('click', (e) => { 
            e.preventDefault(); 
            // Abre diretamente perfil.html com o ID; perfil.js limpará a URL com o slug
            window.location.href = `/perfil.html?id=${loggedInUserId}`; 
        }); 
    }
    if (logoutButton) { logoutButton.addEventListener('click', (e) => { e.preventDefault(); logoutConfirmModal && logoutConfirmModal.classList.remove('hidden'); }); }
    if (confirmLogoutYesBtn) { 
        confirmLogoutYesBtn.addEventListener('click', () => { 
            // Fecha todos os modais antes de fazer logout
            const modalPropostas = document.getElementById('modal-propostas');
            if (modalPropostas) {
                modalPropostas.classList.add('hidden');
            }
            const jaLogou = localStorage.getItem('helpy-ja-logou');
            localStorage.clear(); 
            if (jaLogou) {
                localStorage.setItem('helpy-ja-logou', jaLogou);
            }
            window.location.href = '/login'; 
        });
    }
    if (confirmLogoutNoBtn) { confirmLogoutNoBtn.addEventListener('click', () => { logoutConfirmModal && logoutConfirmModal.classList.add('hidden'); }); }
    
    // 🆕 NOVO: Fechar modais ao clicar no X ou fora
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = btn.dataset.modal;
            if (modalId) {
                const modal = document.getElementById(modalId);
                if (modal) {
                    modal.classList.add('hidden');
                    if (modal.id === 'modal-adicionar-projeto') {
                        resetAdicionarProjetoPreview();
                        formAdicionarProjeto && formAdicionarProjeto.reset();
                    }
                }
            }
        });
    });
    
    // Fecha modais ao clicar fora
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
                if (modal.id === 'modal-adicionar-projeto') {
                    resetAdicionarProjetoPreview();
                    formAdicionarProjeto && formAdicionarProjeto.reset();
                }
            }
        });
    });
    
    if (btnAdicionarHorario && typeof adicionarCampoHorario === 'function') {
        btnAdicionarHorario.addEventListener('click', () => {
            adicionarCampoHorario();
        });
    }
    
    if (formHorarios && typeof adicionarCampoHorario === 'function') {
        formHorarios.addEventListener('submit', async (e) => {
            e.preventDefault();
            const horarios = [];
            document.querySelectorAll('.horario-item').forEach(item => {
                const diaSemana = item.querySelector('.dia-semana').value;
                const horaInicio = item.querySelector('.hora-inicio').value;
                const horaFim = item.querySelector('.hora-fim').value;
                if (diaSemana && horaInicio && horaFim) {
                    horarios.push({ diaSemana: parseInt(diaSemana), horaInicio, horaFim });
                }
            });
            
            try {
                const response = await fetch('/api/agenda/horarios', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ horarios })
                });
                
                const data = await response.json();
                if (data.success) {
                    alert('Horários salvos com sucesso!');
                    modalConfigurarHorarios?.classList.add('hidden');
                } else {
                    alert(data.message || 'Erro ao salvar horários.');
                }
            } catch (error) {
                console.error('Erro ao salvar horários:', error);
                alert('Erro ao salvar horários.');
            }
        });
    }
    
    async function carregarAgendamentos() {
        const agendamentosLista = document.getElementById('agendamentos-lista');
        if (!agendamentosLista) return;
        
        try {
            const response = await fetch('/api/agenda/profissional', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            
            if (data.success && data.agendamentos.length > 0) {
                agendamentosLista.innerHTML = data.agendamentos.map(ag => {
                    const cliente = ag.clienteId;
                    const dataHora = new Date(ag.dataHora);
                    const statusClass = {
                        'pendente': 'status-pendente',
                        'confirmado': 'status-confirmado',
                        'cancelado': 'status-cancelado',
                        'concluido': 'status-concluido'
                    }[ag.status] || '';
                    
                    return `
                        <div class="agendamento-card ${statusClass}">
                            <div class="agendamento-header">
                                <img src="${cliente.foto || cliente.avatarUrl || 'imagens/default-user.png'}" alt="${cliente.nome}" class="agendamento-avatar">
                                <div>
                                    <strong>${cliente.nome}</strong>
                                    <p>${ag.servico}</p>
                                </div>
                            </div>
                            <div class="agendamento-info">
                                <p><i class="fas fa-calendar"></i> ${dataHora.toLocaleDateString('pt-BR')}</p>
                                <p><i class="fas fa-clock"></i> ${dataHora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                ${ag.endereco ? `<p><i class="fas fa-map-marker-alt"></i> ${ag.endereco.cidade}, ${ag.endereco.estado}</p>` : ''}
                                <p class="status-agendamento">Status: ${ag.status}</p>
                            </div>
                            ${ag.status === 'pendente' ? `
                                <div class="agendamento-acoes">
                                    <button class="btn-confirmar" onclick="atualizarStatusAgendamento('${ag._id}', 'confirmado')">Confirmar</button>
                                    <button class="btn-cancelar" onclick="atualizarStatusAgendamento('${ag._id}', 'cancelado')">Cancelar</button>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('');
            } else {
                agendamentosLista.innerHTML = '<p class="mensagem-vazia">Nenhum agendamento ainda.</p>';
            }
        } catch (error) {
            console.error('Erro ao carregar agendamentos:', error);
            agendamentosLista.innerHTML = '<p class="mensagem-vazia">Erro ao carregar agendamentos.</p>';
        }
    }
    
    async function carregarHorariosExistentes() {
        if (!horariosContainer) return;
        
        try {
            const response = await fetch(`/api/agenda/${loggedInUserId}/horarios`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            
            horariosContainer.innerHTML = '';
            
            if (data.success && data.horarios.length > 0) {
                data.horarios.forEach(h => adicionarCampoHorario(h.diaSemana, h.horaInicio, h.horaFim));
            } else {
                adicionarCampoHorario();
            }
        } catch (error) {
            console.error('Erro ao carregar horários:', error);
            adicionarCampoHorario();
        }
    }
    
    function adicionarCampoHorario(diaSemana = '', horaInicio = '', horaFim = '') {
        if (!horariosContainer) return;
        
        const horarioItem = document.createElement('div');
        horarioItem.className = 'horario-item';
        horarioItem.innerHTML = `
            <select class="dia-semana">
                <option value="0" ${diaSemana === 0 ? 'selected' : ''}>Domingo</option>
                <option value="1" ${diaSemana === 1 ? 'selected' : ''}>Segunda</option>
                <option value="2" ${diaSemana === 2 ? 'selected' : ''}>Terça</option>
                <option value="3" ${diaSemana === 3 ? 'selected' : ''}>Quarta</option>
                <option value="4" ${diaSemana === 4 ? 'selected' : ''}>Quinta</option>
                <option value="5" ${diaSemana === 5 ? 'selected' : ''}>Sexta</option>
                <option value="6" ${diaSemana === 6 ? 'selected' : ''}>Sábado</option>
            </select>
            <input type="time" class="hora-inicio" value="${horaInicio}">
            <input type="time" class="hora-fim" value="${horaFim}">
            <button type="button" class="btn-remover-horario">&times;</button>
        `;
        
        horarioItem.querySelector('.btn-remover-horario').addEventListener('click', () => {
            horarioItem.remove();
        });
        
        horariosContainer.appendChild(horarioItem);
    }
    
    window.atualizarStatusAgendamento = async function(agendamentoId, status) {
        try {
            const response = await fetch(`/api/agenda/${agendamentoId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status })
            });
            
            const data = await response.json();
            if (data.success) {
                await carregarAgendamentos();
            } else {
                alert(data.message || 'Erro ao atualizar agendamento.');
            }
        } catch (error) {
            console.error('Erro ao atualizar agendamento:', error);
            alert('Erro ao atualizar agendamento.');
        }
    };
    
    // 🆕 NOVO: Funções para visitante ver agenda
    function criarModalAgendaVisitante(profissionalId) {
        const modal = document.createElement('div');
        modal.id = 'modal-agenda-visitante';
        modal.className = 'modal-overlay hidden';
        modal.dataset.profissionalId = profissionalId;
        modal.innerHTML = `
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h3><i class="fas fa-calendar-alt"></i> Agenda do Profissional</h3>
                    <button class="btn-close-modal" data-modal="modal-agenda-visitante">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="agendamentos-lista-visitante"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }
    
    async function carregarAgendamentosVisitante(profissionalId) {
        const agendamentosLista = document.getElementById('agendamentos-lista-visitante');
        if (!agendamentosLista) return;
        
        try {
            const response = await fetch(`/api/agenda/${profissionalId}/horarios`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            
            if (data.success && data.horarios.length > 0) {
                const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
                agendamentosLista.innerHTML = `
                    <h4>Horários Disponíveis</h4>
                    ${data.horarios.map(h => `
                        <div class="horario-disponivel-card">
                            <strong>${diasSemana[h.diaSemana]}</strong>
                            <p>${h.horaInicio} - ${h.horaFim}</p>
                        </div>
                    `).join('')}
                `;
            } else {
                agendamentosLista.innerHTML = '<p class="mensagem-vazia">Nenhum horário disponível configurado.</p>';
            }
        } catch (error) {
            console.error('Erro ao carregar horários:', error);
            agendamentosLista.innerHTML = '<p class="mensagem-vazia">Erro ao carregar horários.</p>';
        }
    }
});

