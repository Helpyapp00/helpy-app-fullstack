// ============================================
// HEADER E NOTIFICAÇÕES COMPARTILHADO
// ============================================
// Este arquivo contém toda a lógica de cabeçalho e notificações
// que é compartilhada entre feed, perfil e outras páginas

(function() {
    'use strict';
    
    // Variáveis globais compartilhadas
    let modoSelecao = false;
    let notificacoesSelecionadas = new Set();
    let token = null;
    let carregarNotificacoes = null;
    let toggleModoSelecao = null;
    
    // Função para mostrar modal de aviso/confirmação customizado
    window.mostrarModalAviso = function(mensagem, titulo = 'Aviso', tipo = 'aviso', mostrarCancelar = false) {
        return new Promise((resolve) => {
            const modal = document.getElementById('modal-aviso-notificacoes');
            const icon = document.getElementById('modal-aviso-icon');
            const tituloEl = document.getElementById('modal-aviso-titulo');
            const mensagemEl = document.getElementById('modal-aviso-mensagem');
            const btnOk = document.getElementById('modal-aviso-btn-ok');
            const btnCancelar = document.getElementById('modal-aviso-btn-cancelar');
            
            if (!modal || !icon || !tituloEl || !mensagemEl || !btnOk) {
                // Fallback para alert padrão se o modal não existir
                if (mostrarCancelar) {
                    resolve(confirm(mensagem));
                } else {
                    alert(mensagem);
                    resolve(true);
                }
                return;
            }
            
            // Define ícone baseado no tipo
            if (tipo === 'erro') {
                icon.textContent = '❌';
                icon.style.color = '#dc3545';
            } else if (tipo === 'sucesso') {
                icon.textContent = '✅';
                icon.style.color = '#28a745';
            } else if (tipo === 'confirmacao') {
                icon.textContent = '❓';
                icon.style.color = '#ffc107';
            } else {
                icon.textContent = '⚠️';
                icon.style.color = '#ffc107';
            }
            
            tituloEl.textContent = titulo;
            mensagemEl.textContent = mensagem;
            
            // Mostra/esconde botão cancelar
            if (mostrarCancelar) {
                btnCancelar.style.display = 'block';
            } else {
                btnCancelar.style.display = 'none';
            }
            
            // Remove listeners antigos
            const novoBtnOk = btnOk.cloneNode(true);
            btnOk.parentNode.replaceChild(novoBtnOk, btnOk);
            
            const novoBtnCancelar = btnCancelar.cloneNode(true);
            btnCancelar.parentNode.replaceChild(novoBtnCancelar, btnCancelar);
            
            // Adiciona listeners
            novoBtnOk.addEventListener('click', () => {
                modal.classList.add('hidden');
                resolve(true);
            });
            
            novoBtnCancelar.addEventListener('click', () => {
                modal.classList.add('hidden');
                resolve(false);
            });
            
            // Fecha ao clicar fora
            const fecharAoClicarFora = (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                    modal.removeEventListener('click', fecharAoClicarFora);
                    resolve(false);
                }
            };
            modal.addEventListener('click', fecharAoClicarFora);
            
            // Mostra o modal
            modal.classList.remove('hidden');
        });
    };
    
    // Função auxiliar para carregar serviços ativos (disponível globalmente)
    async function carregarServicosAtivosAuxiliar(pedidoIdDestacado = null) {
        const modalServicosAtivos = document.getElementById('modal-servicos-ativos');
        const listaServicosAtivos = document.getElementById('lista-servicos-ativos');
        
        if (!modalServicosAtivos || !listaServicosAtivos) {
            console.warn('Modal de serviços ativos não encontrado, redirecionando para o feed...');
            window.location.href = '/#servicos-ativos';
            return;
        }

        try {
            const response = await fetch('/api/pedidos-urgentes/ativos', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (!data.success) {
                listaServicosAtivos.innerHTML = '<p style="color: var(--error-color);">Erro ao carregar serviços ativos.</p>';
                return;
            }

            const pedidos = data.pedidos || [];
            if (pedidos.length === 0) {
                listaServicosAtivos.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-secondary);">Você ainda não tem serviços ativos de pedidos urgentes.</p>';
                modalServicosAtivos.classList.remove('hidden');
                return;
            }

            // Guarda fotos e nomes em cache local para uso na avaliação
            pedidos.forEach(p => {
                if (p._id) {
                    const pidClean = String(p._id).match(/[a-fA-F0-9]{24}/)?.[0];
                    const fotoSrc = p.foto;
                    if (pidClean) {
                        if (fotoSrc) {
                            localStorage.setItem(`fotoPedido:${pidClean}`, fotoSrc);
                            localStorage.setItem('fotoUltimoServicoConcluido', fotoSrc);
                            localStorage.setItem('ultimaFotoPedido', fotoSrc);
                        }
                        localStorage.setItem('pedidoIdUltimoServicoConcluido', pidClean);
                        if (p.servico) {
                            localStorage.setItem(`nomeServico:${pidClean}`, p.servico);
                            localStorage.setItem('ultimoServicoNome', p.servico);
                            localStorage.setItem('nomeServicoConcluido', p.servico);
                        }
                    }
                }
            });

            listaServicosAtivos.innerHTML = pedidos.map(pedido => {
                const cliente = pedido.clienteId;
                const endereco = pedido.localizacao || {};
                const enderecoLinha = endereco.endereco || '';
                const cidadeEstado = `${endereco.cidade || ''}${endereco.cidade && endereco.estado ? ' - ' : ''}${endereco.estado || ''}`;
                const enderecoMapa = encodeURIComponent(`${enderecoLinha} ${cidadeEstado}`);
                const isDestacado = pedidoIdDestacado && String(pedido._id) === String(pedidoIdDestacado);
                const estiloDestacado = isDestacado ? 'border: 3px solid #28a745; box-shadow: 0 0 10px rgba(40, 167, 69, 0.5);' : '';
                
                return `
                    <div class="pedido-card-servico" data-pedido-id="${pedido._id}" style="${estiloDestacado}">
                        ${pedido.foto || (pedido.fotos && pedido.fotos.length > 0) ? `
                            <div class="pedido-foto-servico" style="display: flex; flex-wrap: wrap; gap: 5px; margin: 10px 0; overflow: visible; overflow-x: visible; overflow-y: visible;">
                                ${pedido.fotos && pedido.fotos.length > 0 ? 
                                    pedido.fotos.map((foto, idx) => `
                                        <img src="${foto}" alt="Foto do serviço ${idx + 1}" class="foto-pedido-clickable" data-foto-url="${foto}" style="width: calc(50% - 2.5px); max-width: 150px; height: 100px; object-fit: cover; border-radius: 8px; cursor: pointer; flex-shrink: 0;">
                                    `).join('') :
                                    `<img src="${pedido.foto}" alt="Foto do serviço" class="foto-pedido-clickable" data-foto-url="${pedido.foto}" style="width: 100%; max-height: 200px; object-fit: cover; border-radius: 8px; cursor: pointer;">`
                                }
                            </div>
                        ` : ''}
                        <div class="pedido-info-servico">
                            <h3>${pedido.servico || 'Serviço'}</h3>
                            ${pedido.descricao ? `<p>${pedido.descricao}</p>` : ''}
                            <div class="pedido-meta-servico">
                                <span><i class="fas fa-user"></i> ${cliente?.nome || 'Cliente'}</span>
                                ${enderecoLinha || cidadeEstado ? `<span><i class="fas fa-map-marker-alt"></i> ${enderecoLinha}${enderecoLinha && cidadeEstado ? ', ' : ''}${cidadeEstado}</span>` : ''}
                            </div>
                            ${enderecoMapa ? `<a href="https://www.google.com/maps/search/?api=1&query=${enderecoMapa}" target="_blank" class="btn-como-chegar"><i class="fas fa-directions"></i> Como chegar</a>` : ''}
                        </div>
                        <div class="pedido-acoes-servico">
                            <button class="btn-concluir-servico" data-pedido-id="${pedido._id}" style="background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-bottom: 10px;">
                                <i class="fas fa-check"></i> Concluir Serviço
                            </button>
                            <button class="btn-cancelar-servico" data-pedido-id="${pedido._id}" style="background: #dc3545; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
                                <i class="fas fa-times"></i> Cancelar
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            // Adicionar listeners para concluir/cancelar serviço
            document.querySelectorAll('.btn-concluir-servico').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const pedidoIdBtn = btn.dataset.pedidoId;
                    if (confirm('Tem certeza que deseja concluir este serviço?')) {
                        try {
                            const response = await fetch(`/api/pedidos-urgentes/${pedidoIdBtn}/concluir`, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${token}`
                                }
                            });
                            const data = await response.json();
                            if (data.success) {
                                alert('Serviço concluído com sucesso!');
                                // Recarrega usando a função global se disponível, senão usa a auxiliar
                                if (typeof window.carregarServicosAtivos === 'function') {
                                    await window.carregarServicosAtivos();
                                } else {
                                    await carregarServicosAtivosAuxiliar();
                                }
                            } else {
                                alert(data.message || 'Erro ao concluir serviço.');
                            }
                        } catch (error) {
                            console.error('Erro ao concluir serviço:', error);
                            alert('Erro ao concluir serviço.');
                        }
                    }
                });
            });

            document.querySelectorAll('.btn-cancelar-servico').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const pedidoIdBtn = btn.dataset.pedidoId;
                    if (confirm('Tem certeza que deseja cancelar este serviço?')) {
                        try {
                            const response = await fetch(`/api/pedidos-urgentes/${pedidoIdBtn}/cancelar`, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${token}`
                                }
                            });
                            const data = await response.json();
                            if (data.success) {
                                alert('Serviço cancelado com sucesso.');
                                // Recarrega usando a função global se disponível, senão usa a auxiliar
                                if (typeof window.carregarServicosAtivos === 'function') {
                                    await window.carregarServicosAtivos();
                                } else {
                                    await carregarServicosAtivosAuxiliar();
                                }
                            } else {
                                alert(data.message || 'Erro ao cancelar serviço.');
                            }
                        } catch (error) {
                            console.error('Erro ao cancelar serviço:', error);
                            alert('Erro ao cancelar serviço.');
                        }
                    }
                });
            });

            // Adicionar listeners para fotos clicáveis (abrir modal)
            document.querySelectorAll('.foto-pedido-clickable').forEach(img => {
                img.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const fotoUrl = img.dataset.fotoUrl || img.src;
                    if (typeof window.abrirModalImagem === 'function') {
                        window.abrirModalImagem(fotoUrl);
                    } else {
                        // Fallback: usar função local se disponível
                        const modalImagem = document.getElementById('image-modal-pedido');
                        const imagemModal = document.getElementById('modal-image-pedido');
                        if (modalImagem && imagemModal) {
                            imagemModal.src = fotoUrl;
                            modalImagem.classList.remove('hidden');
                            document.body.style.overflow = 'hidden';
                        }
                    }
                });
            });

            modalServicosAtivos.classList.remove('hidden');
        } catch (error) {
            console.error('Erro ao carregar serviços ativos:', error);
            alert('Erro ao carregar serviços ativos. Redirecionando para o feed...');
            window.location.href = '/#servicos-ativos';
        }
    }

    // Função auxiliar para carregar propostas (disponível globalmente)
    async function carregarPropostasAuxiliar(pedidoId) {
        const modalPropostas = document.getElementById('modal-propostas');
        const listaPropostas = document.getElementById('lista-propostas');
        
        if (!modalPropostas || !listaPropostas) {
            console.warn('Modal de propostas não encontrado, redirecionando para o feed...');
            window.location.href = `/?pedidoId=${pedidoId}#propostas`;
            return;
        }

        try {
            const response = await fetch(`/api/pedidos-urgentes/${pedidoId}/propostas`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                modalPropostas.classList.remove('hidden');
                
                const pedido = data.pedido;
                const propostas = data.propostas || [];

                if (propostas.length === 0) {
                    listaPropostas.innerHTML = '<p>Ainda não há propostas. Profissionais serão notificados!</p>';
                    return;
                }

                let headerHtml = '';
                if (pedido) {
                    headerHtml = `
                        <div class="pedido-propostas-header">
                            <div class="pedido-propostas-info">
                                <strong>${pedido.servico || ''}</strong>
                                ${pedido.descricao ? `<p class="pedido-descricao">${pedido.descricao}</p>` : ''}
                            </div>
                            ${pedido.foto ? `
                                <div class="pedido-propostas-foto">
                                    <img src="${pedido.foto}" alt="Foto do serviço" class="pedido-foto-miniatura">
                                </div>
                            ` : ''}
                        </div>
                    `;
                }

                const propostasHtml = propostas.map(proposta => {
                    const prof = proposta.profissionalId;
                    const nivel = prof.gamificacao?.nivel || 1;
                    const mediaAvaliacao = prof.mediaAvaliacao || 0;
                    const profId = prof._id || prof.id || prof.userId;
                    const perfilUrl = profId ? `/perfil.html?id=${profId}` : '#';
                    
                    return `
                        <div class="proposta-card">
                            <div class="proposta-header">
                                <a class="proposta-avatar-link" href="${perfilUrl}">
                                <img src="${prof.avatarUrl || prof.foto || '/imagens/default-user.png'}" 
                                     alt="${prof.nome}" class="proposta-avatar">
                                </a>
                                <div class="proposta-info-profissional">
                                    <strong><a class="link-perfil-proposta" href="${perfilUrl}">${prof.nome}</a></strong>
                                    <div class="proposta-meta">
                                        <span>Nível ${nivel}</span>
                                        ${mediaAvaliacao > 0 ? `<span>⭐ ${mediaAvaliacao.toFixed(1)}</span>` : ''}
                                        <span>${prof.cidade || ''} - ${prof.estado || ''}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="proposta-detalhes">
                                <div class="proposta-valor">
                                    <strong>R$ ${parseFloat(proposta.valor).toFixed(2)}</strong>
                                </div>
                                <div class="proposta-tempo">
                                    <i class="fas fa-clock"></i> ${proposta.tempoChegada}
                                </div>
                                ${proposta.observacoes ? `<p class="proposta-observacoes">${proposta.observacoes}</p>` : ''}
                            </div>
                            <div style="display: flex; gap: 10px; margin-top: 10px;">
                            <button class="btn-aceitar-proposta" data-proposta-id="${proposta._id}" data-pedido-id="${pedidoId}">
                                Aceitar Proposta
                            </button>
                                <button class="btn-recusar-proposta" data-proposta-id="${proposta._id}" data-pedido-id="${pedidoId}" style="background: #dc3545; color: #fff; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">
                                    Recusar
                            </button>
                            </div>
                        </div>
                    `;
                }).join('');

                listaPropostas.innerHTML = headerHtml + propostasHtml;

                // Adicionar listeners para aceitar propostas
                document.querySelectorAll('.btn-aceitar-proposta').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const propostaId = btn.dataset.propostaId;
                        const pedidoIdBtn = btn.dataset.pedidoId;
                        
                        // Verifica se há função de confirmação disponível
                        if (typeof window.abrirConfirmacaoAcao === 'function') {
                            window.abrirConfirmacaoAcao({
                                titulo: 'Aceitar proposta',
                                texto: 'Ao aceitar esta proposta, o serviço será iniciado com este profissional.',
                                exigeMotivo: false,
                                onConfirm: async () => {
                                    await aceitarProposta(propostaId, pedidoIdBtn);
                                }
                            });
                        } else {
                            if (confirm('Tem certeza que deseja aceitar esta proposta?')) {
                                await aceitarProposta(propostaId, pedidoIdBtn);
                            }
                        }
                    });
                });

                // Adicionar listeners para recusar propostas
                document.querySelectorAll('.btn-recusar-proposta').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const propostaId = btn.dataset.propostaId;
                        const pedidoIdBtn = btn.dataset.pedidoId;
                        
                        if (!confirm('Tem certeza que deseja recusar esta proposta?')) return;
                        
                        await recusarProposta(propostaId, pedidoIdBtn);
                    });
                });
            }
        } catch (error) {
            console.error('Erro ao carregar propostas:', error);
            alert('Erro ao carregar propostas. Redirecionando para o feed...');
            window.location.href = `/?pedidoId=${pedidoId}#propostas`;
        }
    }

    // Função auxiliar para aceitar proposta
    async function aceitarProposta(propostaId, pedidoId) {
        try {
            const response = await fetch(`/api/pedidos-urgentes/${pedidoId}/aceitar-proposta`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ propostaId })
            });

            const data = await response.json();
            
            if (data.success) {
                // Feedback visual de sucesso
                const toast = document.createElement('div');
                toast.className = 'toast-sucesso';
                toast.style.cssText = 'position: fixed; top: 80px; right: 20px; background: #28a745; color: white; padding: 15px 20px; border-radius: 8px; z-index: 10000; box-shadow: 0 4px 6px rgba(0,0,0,0.1);';
                toast.innerHTML = '<span>✔</span> Proposta aceita! Agora é só aguardar o profissional.';
                document.body.appendChild(toast);
                setTimeout(() => {
                    toast.style.opacity = '0';
                    toast.style.transition = 'opacity 0.3s';
                    setTimeout(() => toast.remove(), 300);
                }, 2500);

                const modalPropostas = document.getElementById('modal-propostas');
                if (modalPropostas) modalPropostas.classList.add('hidden');
                
                // Recarrega as propostas se a função estiver disponível
                if (typeof window.carregarPropostas === 'function') {
                    await window.carregarPropostas(pedidoId);
                } else {
                    await carregarPropostasAuxiliar(pedidoId);
                }
            } else {
                alert(data.message || 'Erro ao aceitar proposta.');
            }
        } catch (error) {
            console.error('Erro ao aceitar proposta:', error);
            alert('Erro ao aceitar proposta.');
        }
    }

    // Função auxiliar para recusar proposta
    async function recusarProposta(propostaId, pedidoId) {
        try {
            const response = await fetch(`/api/pedidos-urgentes/${pedidoId}/recusar-proposta`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ propostaId })
            });

            const data = await response.json();
            
            if (data.success) {
                alert('Proposta recusada com sucesso.');
                // Recarrega as propostas se a função estiver disponível
                if (typeof window.carregarPropostas === 'function') {
                    await window.carregarPropostas(pedidoId);
                } else {
                    await carregarPropostasAuxiliar(pedidoId);
                }
            } else {
                alert(data.message || 'Erro ao recusar proposta.');
            }
        } catch (error) {
            console.error('Erro ao recusar proposta:', error);
            alert('Erro ao recusar proposta.');
        }
    }

    // Define handleClickLixeira ANTES do DOM estar pronto para que o onclick inline funcione
    console.log('🔧 Definindo window.handleClickLixeira ANTES do DOM...');
    window.handleClickLixeira = async function handleClickLixeira(e) {
        console.log('🔴🔴🔴 handleClickLixeira CHAMADA!', e);
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        console.log('🔴🔴🔴 BOTÃO LIXEIRA CLICADO! Modo seleção atual:', modoSelecao);
        console.log('🔴 Estado:', { modoSelecao, selecionadas: notificacoesSelecionadas.size });
        console.log('🔴 toggleModoSelecao disponível?', typeof toggleModoSelecao);
        console.log('🔴 carregarNotificacoes disponível?', typeof carregarNotificacoes);
        
        // Se não está em modo de seleção, entra no modo
        if (!modoSelecao) {
            console.log('✅ Entrando no modo de seleção...');
            if (toggleModoSelecao) {
                toggleModoSelecao();
            } else {
                console.error('❌ toggleModoSelecao não está disponível ainda');
            }
            return;
        }
        
        // Se está em modo de seleção e tem notificações selecionadas, deleta
        if (notificacoesSelecionadas.size === 0) {
            // Mostra mensagem perto do botão "Selecionar tudo"
            const mensagemEl = document.getElementById('mensagem-selecionar-primeiro');
            if (mensagemEl) {
                mensagemEl.style.display = 'block';
                // Esconde a mensagem após 3 segundos
                setTimeout(() => {
                    mensagemEl.style.display = 'none';
                }, 3000);
            }
            return;
        }
        
        const confirmar = await window.mostrarModalAviso(
            `Tem certeza que deseja deletar ${notificacoesSelecionadas.size} notificação(ões)? Esta ação não pode ser desfeita.`,
            'Confirmar exclusão',
            'confirmacao',
            true
        );
        
        if (!confirmar) {
            return;
        }
        
        try {
            const currentToken = token || localStorage.getItem('jwtToken');
            console.log('🗑️ Deletando notificações:', Array.from(notificacoesSelecionadas));
            const response = await fetch('/api/notificacoes', {
                method: 'DELETE',
                headers: { 
                    'Authorization': `Bearer ${currentToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ids: Array.from(notificacoesSelecionadas) })
            });
            const data = await response.json();
            console.log('📦 Resposta da API:', data);
            if (response.ok && data.success) {
                notificacoesSelecionadas.clear();
                if (toggleModoSelecao) {
                    toggleModoSelecao(); // Sai do modo de seleção
                }
                if (carregarNotificacoes) {
                    await carregarNotificacoes();
                }
            } else {
                throw new Error(data.message || 'Erro ao deletar notificações');
            }
        } catch (err) {
            console.error('Erro ao deletar notificações:', err);
            await window.mostrarModalAviso('Erro ao deletar notificações. Tente novamente.', 'Erro', 'erro', false);
        }
    };
    console.log('✅ window.handleClickLixeira definida:', typeof window.handleClickLixeira);
    
    // Aguarda o DOM estar pronto
    console.log('📋 header-notificacoes.js carregado, readyState:', document.readyState);
    if (document.readyState === 'loading') {
        console.log('⏳ Aguardando DOMContentLoaded...');
        document.addEventListener('DOMContentLoaded', initHeaderNotificacoes);
    } else {
        console.log('✅ DOM já pronto, inicializando imediatamente...');
        initHeaderNotificacoes();
    }
    
    function initHeaderNotificacoes() {
        console.log('🚀 Inicializando header-notificacoes.js...');
        token = localStorage.getItem('jwtToken');
        const loggedInUserId = localStorage.getItem('userId');
        
        if (!token || !loggedInUserId) {
            console.warn('⚠️ Usuário não logado, não inicializando notificações');
            return; // Não inicializa se não estiver logado
        }
        
        console.log('✅ Usuário logado, buscando elementos do DOM...');
        // Elementos do DOM
        const btnNotificacoes = document.getElementById('btn-notificacoes');
        const badgeNotificacoes = document.getElementById('badge-notificacoes');
        let modalNotificacoes = document.getElementById('modal-notificacoes');
        
        // Proteção: garante que o modal sempre exista no DOM
        if (!modalNotificacoes) {
            console.warn('⚠️ Modal de notificações não encontrado no DOM inicialmente. Verificando novamente...');
            // Aguarda um pouco e tenta novamente
            setTimeout(() => {
                modalNotificacoes = document.getElementById('modal-notificacoes');
                if (!modalNotificacoes) {
                    console.error('❌ Modal de notificações ainda não encontrado após aguardar. Verifique se o elemento existe no HTML.');
                }
            }, 100);
        }
        
        // Proteção adicional: MutationObserver para detectar se o modal é removido do DOM
        if (modalNotificacoes && !window.modalNotificacoesObserver) {
            window.modalNotificacoesObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.removedNodes.forEach((node) => {
                        if (node.nodeType === 1 && (node.id === 'modal-notificacoes' || node.querySelector && node.querySelector('#modal-notificacoes'))) {
                            console.error('❌ Modal de notificações foi removido do DOM!');
                            console.error('❌ Tentando recriar o modal...');
                            // Tenta encontrar o modal novamente
                            const modalRecriado = document.getElementById('modal-notificacoes');
                            if (!modalRecriado) {
                                console.error('❌ Não foi possível encontrar o modal após remoção. Recarregue a página.');
                            }
                        }
                    });
                });
            });
            
            // Observa mudanças no body para detectar remoção do modal
            window.modalNotificacoesObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
            console.log('✅ MutationObserver configurado para proteger o modal de notificações');
        }
        
        const listaNotificacoes = document.getElementById('lista-notificacoes');
        const btnMarcarTodasLidas = document.getElementById('btn-marcar-todas-lidas');
        const btnLimparNotificacoes = document.getElementById('btn-limpar-notificacoes');
        const btnSelecionarTudo = document.getElementById('btn-selecionar-tudo');
        const selecionarTudoContainer = document.getElementById('selecionar-tudo-container');
        
        console.log('🔍 Elementos encontrados:', {
            btnNotificacoes: !!btnNotificacoes,
            badgeNotificacoes: !!badgeNotificacoes,
            modalNotificacoes: !!modalNotificacoes,
            listaNotificacoes: !!listaNotificacoes,
            btnMarcarTodasLidas: !!btnMarcarTodasLidas,
            btnLimparNotificacoes: !!btnLimparNotificacoes,
            btnSelecionarTudo: !!btnSelecionarTudo,
            selecionarTudoContainer: !!selecionarTudoContainer
        });
        
        // Função para atualizar o botão "Selecionar tudo"
        function atualizarBotaoSelecionarTudo() {
            if (!btnSelecionarTudo) return;
            const todasCards = document.querySelectorAll('.notificacao-card');
            const todasSelecionadas = todasCards.length > 0 && notificacoesSelecionadas.size === todasCards.length;
            btnSelecionarTudo.textContent = todasSelecionadas 
                ? 'Desselecionar tudo'
                : 'Selecionar tudo';
        }
        
        // Função para entrar/sair do modo de seleção (atribuída à variável global)
        toggleModoSelecao = function() {
            modoSelecao = !modoSelecao;
            notificacoesSelecionadas.clear();
            console.log('🔄 Modo de seleção alterado para:', modoSelecao);
            
            // Busca o botão novamente (pode ter sido clonado)
            const btnLixeiraAtual = document.getElementById('btn-limpar-notificacoes');
            const btnSelecionarTudoAtual = document.getElementById('btn-selecionar-tudo');
            
            if (modoSelecao) {
                if (btnLixeiraAtual) {
                    btnLixeiraAtual.classList.add('modo-selecao');
                    console.log('✅ Classe modo-selecao adicionada ao botão');
                }
                if (selecionarTudoContainer) {
                    selecionarTudoContainer.style.display = 'block';
                    console.log('✅ Container selecionar tudo exibido');
                }
                // Inicializa o botão "Selecionar tudo" sem check
                if (btnSelecionarTudoAtual) {
                    btnSelecionarTudoAtual.textContent = 'Selecionar tudo';
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
            if (carregarNotificacoes) {
                carregarNotificacoes();
            }
        };
        
        // Função para carregar notificações (atribuída à variável global e window)
        carregarNotificacoes = async function() {
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
                // Busca o modal dinamicamente para garantir que a referência está atualizada
                const modalNotificacoesAtual = document.getElementById('modal-notificacoes');
                // Preserva a mensagem de erro se estiver sendo exibida
                const mensagemProposta = document.getElementById('mensagem-proposta-respondida');
                const mensagemTexto = document.getElementById('mensagem-proposta-texto');
                let mensagemPreservada = null;
                const temMensagemFlag = window.temMensagemErroNotificacao;
                
                // Verifica se há mensagem de erro sendo exibida
                const temMensagemVisivel = mensagemProposta && mensagemTexto && mensagemProposta.style.display !== 'none';
                if (temMensagemVisivel || temMensagemFlag) {
                    if (mensagemProposta && mensagemTexto) {
                        mensagemPreservada = {
                            texto: mensagemTexto.textContent || 'Esta proposta/candidatura já foi recusada.',
                            display: mensagemProposta.style.display || 'block'
                        };
                    }
                    
                    // NUNCA recarrega a lista se há mensagem de erro sendo exibida (evita piscar)
                    if ((temMensagemFlag || temMensagemVisivel) && listaNotificacoes && modalNotificacoesAtual && !modalNotificacoesAtual.classList.contains('hidden')) {
                        // Apenas atualiza o badge, não recarrega a lista para evitar piscar
                        if (badgeNotificacoes) {
                            if (data.totalNaoLidas > 0) {
                                badgeNotificacoes.textContent = data.totalNaoLidas > 99 ? '99+' : data.totalNaoLidas;
                                badgeNotificacoes.style.display = 'flex';
                            } else {
                                badgeNotificacoes.style.display = 'none';
                            }
                        }
                        return; // Sai da função sem recarregar a lista
                    }
                }
                
                if (listaNotificacoes && modalNotificacoesAtual && !modalNotificacoesAtual.classList.contains('hidden')) {
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
                            avaliacao_recebida: '⭐',
                            candidatura_time: '👥',
                            contraproposta_time: '💰',
                            proposta_time_aceita: '🎉',
                            confirmar_perfil_time: '👤',
                            candidatura_recusada_time: '❌',
                            post_curtido: '❤️',
                            post_comentado: '💬',
                            comentario_respondido: '↩️'
                        };
                        listaNotificacoes.innerHTML = notificacoes.map(notif => {
                            const dataFmt = new Date(notif.createdAt).toLocaleString('pt-BR');
                            const isSelecionada = notificacoesSelecionadas.has(notif._id);
                            const modoSelecaoClass = modoSelecao ? 'modo-selecao' : '';
                            const selecionadaClass = isSelecionada ? 'selecionada' : '';
                            const paddingLeft = modoSelecao ? '35px' : '15px';
                            // Verifica se é notificação de recusa para aplicar estilo vermelho
                            const isRecusada = notif.tipo === 'candidatura_recusada_time';
                            const estiloRecusada = isRecusada ? 'style="color: #dc3545; border-left: 3px solid #dc3545; padding-left: 12px;"' : '';
                            
                            return `
                                <div class="notificacao-card ${notif.lida ? '' : 'nao-lida'} ${modoSelecaoClass} ${selecionadaClass} ${isRecusada ? 'notificacao-recusada' : ''}" data-notif-id="${notif._id}" ${estiloRecusada}>
                                    <div style="display: flex; gap: 15px; align-items: flex-start; padding-left: ${paddingLeft};">
                                        <div style="font-size: 24px;">${iconMap[notif.tipo] || '🔔'}</div>
                                        <div style="flex: 1;">
                                            <strong ${isRecusada ? 'style="color: #dc3545;"' : ''}>${notif.titulo || 'Notificação'}</strong>
                                            <p style="margin: 5px 0; color: ${isRecusada ? '#dc3545' : 'var(--text-secondary)'};">${notif.mensagem || ''}</p>
                                            <small style="color: var(--text-secondary);">${dataFmt}</small>
                                        </div>
                                        ${!notif.lida ? '<span style="background: #007bff; width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-top: 5px;"></span>' : ''}
                                    </div>
                                </div>
                            `;
                        }).join('');
                        
                        // Restaura a mensagem preservada se houver
                        if (mensagemPreservada && mensagemProposta && mensagemTexto) {
                            mensagemTexto.textContent = mensagemPreservada.texto;
                            mensagemProposta.style.display = mensagemPreservada.display;
                        }

                        // Clique em cada notificação (usando capture phase para garantir que execute antes)
                        document.querySelectorAll('.notificacao-card').forEach(card => {
                            // Remove listeners antigos se houver
                            const novoCard = card.cloneNode(true);
                            card.parentNode.replaceChild(novoCard, card);
                            
                            novoCard.addEventListener('click', async (e) => {
                                e.stopPropagation(); // Impede que o clique seja capturado pelo listener de fechar modal
                                e.stopImmediatePropagation(); // Impede que outros listeners sejam executados
                                const notifId = novoCard.dataset.notifId;
                                console.log('🟢 Clique na notificação:', notifId);
                                if (!notifId) return;
                                
                                // Se estiver em modo de seleção, apenas seleciona/desseleciona
                                if (modoSelecao) {
                                    e.stopPropagation();
                                    if (notificacoesSelecionadas.has(notifId)) {
                                        notificacoesSelecionadas.delete(notifId);
                                        novoCard.classList.remove('selecionada');
                                    } else {
                                        notificacoesSelecionadas.add(notifId);
                                        novoCard.classList.add('selecionada');
                                    }
                                    atualizarBotaoSelecionarTudo();
                                    return;
                                }
                                
                                // Busca o modal atualizado
                                const modalNotificacoesAtual = document.getElementById('modal-notificacoes');
                                
                                // Função auxiliar para fechar o modal de notificações
                                const fecharModalNotificacoes = () => {
                                    // Busca o modal novamente para garantir que tem a referência atualizada
                                    const modal = document.getElementById('modal-notificacoes');
                                    if (modal) {
                                        // Remove todos os estilos inline primeiro
                                        modal.style.cssText = '';
                                        modal.style.removeProperty('display');
                                        modal.style.removeProperty('visibility');
                                        modal.style.removeProperty('opacity');
                                        modal.style.removeProperty('position');
                                        modal.style.removeProperty('z-index');
                                        modal.style.removeProperty('top');
                                        modal.style.removeProperty('left');
                                        modal.style.removeProperty('width');
                                        modal.style.removeProperty('height');
                                        
                                        // Adiciona a classe hidden
                                        modal.classList.add('hidden');
                                        
                                        // Reseta a flag
                                        modalAbertoAgora = false;
                                        
                                        console.log('✅ Modal de notificações fechado');
                                    }
                                };
                                
                                // Verifica ANTES de marcar como lida se haverá mensagem de erro
                                // Define flag preventivo para notificações que podem gerar erro
                                const notif = (data.notificacoes || []).find(n => n._id === notifId);
                                const podeGerarErro = notif && (
                                    notif.tipo === 'candidatura_time' || 
                                    notif.tipo === 'contraproposta_time' || 
                                    notif.tipo === 'confirmar_perfil_time'
                                );
                                
                                // Define flag preventivo ANTES de processar para evitar recarregamento
                                // Isso garante que não haverá recarregamento mesmo se a função demorar
                                // Mas NÃO impede o processamento da notificação - apenas evita recarregamento da lista
                                if (podeGerarErro) {
                                    window.temMensagemErroNotificacao = true;
                                    console.log('🚫 Flag de mensagem de erro definido preventivamente para evitar piscar (notificação será processada normalmente)');
                                }
                                
                                // Comportamento normal quando não está em modo de seleção
                                try {
                                    const lidaResponse = await fetch(`/api/notificacoes/${notifId}/lida`, {
                                        method: 'PUT',
                                        headers: { 'Authorization': `Bearer ${token}` }
                                    });
                                    
                                    if (lidaResponse.ok) {
                                        // Atualiza o badge imediatamente
                                        if (badgeNotificacoes && typeof carregarNotificacoes === 'function') {
                                            // Verifica se há uma mensagem de erro sendo exibida (usando flag global também)
                                            const mensagemProposta = document.getElementById('mensagem-proposta-respondida');
                                            const temMensagem = (mensagemProposta && mensagemProposta.style.display !== 'none') || window.temMensagemErroNotificacao;
                                            
                                            // NUNCA recarrega se houver mensagem de erro sendo exibida ou flag ativo
                                            if (!temMensagem) {
                                                // Recarrega as notificações para atualizar o badge
                                                await carregarNotificacoes();
                                            } else {
                                                // Apenas atualiza o badge sem recarregar a lista (evita piscar)
                                                try {
                                                    const resp = await fetch('/api/notificacoes?limit=1', {
                                                        headers: { 'Authorization': `Bearer ${token}` }
                                                    });
                                                    if (resp.ok) {
                                                        const data = await resp.json();
                                                        if (data.success && badgeNotificacoes) {
                                                            if (data.totalNaoLidas > 0) {
                                                                badgeNotificacoes.textContent = data.totalNaoLidas > 99 ? '99+' : data.totalNaoLidas;
                                                                badgeNotificacoes.style.display = 'flex';
                                                            } else {
                                                                badgeNotificacoes.style.display = 'none';
                                                            }
                                                        }
                                                    }
                                                } catch (err) {
                                                    console.warn('Erro ao atualizar badge:', err);
                                                }
                                            }
                                        }
                                    }
                                } catch (err) {
                                    console.error('Erro ao marcar notificação como lida', err);
                                }
                                
                                // Se a notificação não for do tipo que pode gerar erro, não precisa processar mais
                                // As notificações que podem gerar erro são processadas abaixo
                                if (!podeGerarErro) {
                                    return;
                                }
                                
                                // Redireciona se for serviço concluído
                                // Reutiliza a variável notif já declarada acima
                                console.log('📋 Notificação encontrada:', notif?.tipo, notif?.dadosAdicionais);
                                
                                // Flag para indicar se algo foi aberto (redirecionamento, modal, etc.)
                                let algoFoiAberto = false;
                                
                                if (notif?.tipo === 'servico_concluido' && notif.dadosAdicionais?.profissionalId) {
                                    algoFoiAberto = true;
                                    fecharModalNotificacoes();
                                    const params = new URLSearchParams({
                                        id: notif.dadosAdicionais.profissionalId,
                                        origem: 'servico_concluido'
                                    });
                                    
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
                                            // Salva o pedidoId no localStorage para uso posterior
                                            localStorage.setItem('pedidoIdUltimoServicoConcluido', pidClean);
                                            console.log('✅ PedidoId salvo no localStorage:', pidClean);
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
                                                if (nomeServicoDaMensagem) {
                                                    params.set('servico', nomeServicoDaMensagem);
                                                    localStorage.setItem('ultimoServicoNome', nomeServicoDaMensagem);
                                                }
                                            }
                                        }
                                    } else if (notif.dadosAdicionais.agendamentoId) {
                                        const agendamentoId = notif.dadosAdicionais.agendamentoId;
                                        const aidClean = String(agendamentoId).match(/[a-fA-F0-9]{24}/)?.[0] || '';
                                        if (aidClean) {
                                            params.set('agendamentoId', aidClean);
                                            // Salva o agendamentoId no localStorage para uso posterior
                                            localStorage.setItem('agendamentoIdUltimoServico', aidClean);
                                            console.log('✅ AgendamentoId adicionado aos parâmetros e salvo no localStorage:', aidClean);
                                        }
                                        try {
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
                                            if (nomeServicoDaMensagem) {
                                                params.set('servico', nomeServicoDaMensagem);
                                                localStorage.setItem('ultimoServicoNome', nomeServicoDaMensagem);
                                            }
                                        }
                                    } else if (nomeServicoDaMensagem) {
                                        params.set('servico', nomeServicoDaMensagem);
                                        localStorage.setItem('ultimoServicoNome', nomeServicoDaMensagem);
                                        console.log('✅ Nome do serviço usado da mensagem:', nomeServicoDaMensagem);
                                    }
                                    const fotoServico = notif.dadosAdicionais.foto || localStorage.getItem('fotoUltimoServicoConcluido') || localStorage.getItem('ultimaFotoPedido');
                                    if (fotoServico) params.set('foto', fotoServico);
                                    window.location.href = `/perfil?${params.toString()}#secao-avaliacao`;
                                    return;
                                }
                                // Se for notificação de proposta de pedido urgente, abre o modal de propostas
                                if (notif?.tipo === 'proposta_pedido_urgente' && notif.dadosAdicionais?.pedidoId) {
                                    algoFoiAberto = true;
                                    fecharModalNotificacoes();
                                    const pedidoId = notif.dadosAdicionais.pedidoId;
                                    
                                    // Tenta usar a função global do feed primeiro, depois a auxiliar
                                    if (typeof window.carregarPropostas === 'function') {
                                        await window.carregarPropostas(pedidoId);
                                    } else {
                                        // Usa a função auxiliar que funciona em qualquer página
                                        await carregarPropostasAuxiliar(pedidoId);
                                    }
                                    return;
                                }
                                
                                // Se for notificação de proposta aceita, abre o modal de serviços ativos
                                if (notif?.tipo === 'proposta_aceita') {
                                    algoFoiAberto = true;
                                    fecharModalNotificacoes();
                                    console.log('🎉 Notificação de proposta aceita detectada!', notif.dadosAdicionais);
                                    // Pode ter pedidoId ou agendamentoId
                                    const pedidoId = notif.dadosAdicionais?.pedidoId || notif.dadosAdicionais?.agendamentoId;
                                    
                                    if (pedidoId) {
                                        console.log('📦 Abrindo serviços ativos com pedidoId:', pedidoId);
                                        // Tenta usar a função global do feed primeiro, depois a auxiliar
                                        if (typeof window.carregarServicosAtivos === 'function') {
                                            console.log('✅ Usando função global carregarServicosAtivos');
                                            await window.carregarServicosAtivos(pedidoId);
                                        } else {
                                            console.log('✅ Usando função auxiliar carregarServicosAtivosAuxiliar');
                                            // Usa a função auxiliar que funciona em qualquer página
                                            await carregarServicosAtivosAuxiliar(pedidoId);
                                        }
                                    } else {
                                        console.warn('⚠️ Notificação de proposta aceita sem pedidoId ou agendamentoId');
                                        // Se não tem pedidoId, apenas recarrega a página
                                        window.location.reload();
                                    }
                                    return;
                                }
                                
                                // Trata notificação de proposta aceita em time
                                if (notif?.tipo === 'proposta_time_aceita' && notif.dadosAdicionais?.timeId) {
                                    algoFoiAberto = true;
                                    fecharModalNotificacoes();
                                    console.log('🎉 Notificação de proposta aceita detectada!', notif.dadosAdicionais);
                                    
                                    // Abre o modal de proposta aceita
                                    if (typeof window.abrirModalPropostaAceita === 'function') {
                                        await window.abrirModalPropostaAceita(notif.dadosAdicionais);
                                    } else {
                                        console.error('❌ Função abrirModalPropostaAceita não encontrada');
                                    }
                                    return;
                                }
                                
                                // Trata notificação de confirmação de perfil em time
                                if (notif?.tipo === 'confirmar_perfil_time' && notif.dadosAdicionais?.timeId) {
                                    console.log('👤 Notificação de confirmação de perfil detectada!', notif.dadosAdicionais);
                                    
                                    const timeId = notif.dadosAdicionais.timeId;
                                    const candidatoId = notif.dadosAdicionais.candidatoId;
                                    const profissionalId = notif.dadosAdicionais.profissionalId;
                                    
                                    // Define flag ANTES de chamar a função para evitar recarregamento
                                    window.temMensagemErroNotificacao = true;
                                    
                                    // Se estiver no feed (index.html), chama a função diretamente
                                    if (typeof window.abrirCandidatosPorNotificacao === 'function') {
                                        console.log('✅ Chamando abrirCandidatosPorNotificacao para confirmar perfil');
                                        const sucesso = await window.abrirCandidatosPorNotificacao(timeId, profissionalId, 'confirmar_perfil_time', candidatoId);
                                        // Só fecha o modal se tudo deu certo
                                        if (sucesso) {
                                            // Remove o flag IMEDIATAMENTE se deu certo (notificação válida)
                                            window.temMensagemErroNotificacao = false;
                                            console.log('✅ Flag removido - notificação válida processada com sucesso');
                                            algoFoiAberto = true;
                                            fecharModalNotificacoes();
                                        }
                                        // Se não deu certo, o flag permanece e a mensagem já foi exibida
                                    } else {
                                        console.log('🔄 Função não disponível, redirecionando para feed...');
                                        // Remove o flag antes de redirecionar
                                        window.temMensagemErroNotificacao = false;
                                        algoFoiAberto = true;
                                        fecharModalNotificacoes();
                                        const params = new URLSearchParams({ abrirCandidatos: timeId });
                                        if (profissionalId) {
                                            params.append('profissionalId', profissionalId);
                                        }
                                        if (candidatoId) {
                                            params.append('candidatoId', candidatoId);
                                        }
                                        params.append('tipoNotificacao', 'confirmar_perfil_time');
                                        window.location.href = `/index.html?${params.toString()}`;
                                    }
                                    return;
                                }
                                
                                // Trata notificações de posts (curtidas, comentários, respostas)
                                if (notif?.tipo === 'post_curtido' && notif.dadosAdicionais?.postId) {
                                    algoFoiAberto = true;
                                    fecharModalNotificacoes();
                                    // Recarrega a página para mostrar o post atualizado
                                    window.location.reload();
                                    return;
                                }
                                
                                if (notif?.tipo === 'post_comentado' && notif.dadosAdicionais?.postId) {
                                    algoFoiAberto = true;
                                    fecharModalNotificacoes();
                                    // Recarrega a página para mostrar o comentário
                                    window.location.reload();
                                    return;
                                }
                                
                                if (notif?.tipo === 'comentario_respondido' && notif.dadosAdicionais?.postId) {
                                    algoFoiAberto = true;
                                    fecharModalNotificacoes();
                                    // Recarrega a página para mostrar a resposta
                                    window.location.reload();
                                    return;
                                }
                                
                                // Trata notificação de candidatura em time
                                if ((notif?.tipo === 'candidatura_time' || notif?.tipo === 'contraproposta_time') && notif.dadosAdicionais?.timeId) {
                                    console.log('🔔 Notificação de candidatura/contraproposta detectada!', notif.dadosAdicionais);
                                    
                                    const timeId = notif.dadosAdicionais.timeId;
                                    const profissionalId = notif.dadosAdicionais.profissionalId;
                                    const candidatoId = notif.dadosAdicionais.candidatoId; // ID específico do candidato
                                    const tipoNotificacao = notif.tipo;
                                    
                                    // Define flag ANTES de chamar a função para evitar recarregamento
                                    // A função pode retornar false se houver erro, então preparamos para isso
                                    window.temMensagemErroNotificacao = true;
                                    
                                    // Se estiver no feed (index.html), chama a função diretamente
                                    if (typeof window.abrirCandidatosPorNotificacao === 'function') {
                                        console.log('✅ Chamando abrirCandidatosPorNotificacao com timeId:', timeId, 'profissionalId:', profissionalId, 'candidatoId:', candidatoId, 'tipoNotificacao:', tipoNotificacao);
                                        const sucesso = await window.abrirCandidatosPorNotificacao(timeId, profissionalId, tipoNotificacao, candidatoId);
                                        // Só fecha o modal se tudo deu certo
                                        if (sucesso) {
                                            // Remove o flag IMEDIATAMENTE se deu certo (notificação válida)
                                            window.temMensagemErroNotificacao = false;
                                            console.log('✅ Flag removido - notificação válida processada com sucesso');
                                            algoFoiAberto = true;
                                            fecharModalNotificacoes();
                                        }
                                        // Se não deu certo, o flag permanece e a mensagem já foi exibida
                                    } else {
                                        console.log('🔄 Função não disponível, redirecionando para feed...');
                                        // Remove o flag antes de redirecionar
                                        window.temMensagemErroNotificacao = false;
                                        algoFoiAberto = true;
                                        fecharModalNotificacoes();
                                        // Se não estiver no feed, redireciona para o feed com parâmetro
                                        const params = new URLSearchParams({ abrirCandidatos: timeId });
                                        if (profissionalId) {
                                            params.append('profissionalId', profissionalId);
                                        }
                                        if (candidatoId) {
                                            params.append('candidatoId', candidatoId);
                                        }
                                        if (tipoNotificacao) {
                                            params.append('tipoNotificacao', tipoNotificacao);
                                        }
                                        window.location.href = `/index.html?${params.toString()}`;
                                    }
                                    return;
                                }
                            });
                        });
                    }
                }
            } catch (error) {
                console.error('Erro ao carregar notificações:', error);
                if (badgeNotificacoes) badgeNotificacoes.style.display = 'none';
                // Busca o modal dinamicamente para garantir que a referência está atualizada
                const modalNotificacoesAtual = document.getElementById('modal-notificacoes');
                if (listaNotificacoes && modalNotificacoesAtual && !modalNotificacoesAtual.classList.contains('hidden')) {
                    listaNotificacoes.innerHTML = '<p style="color: var(--error-color);">Erro ao carregar notificações.</p>';
                }
            }
        }
        
        // Função para configurar o botão lixeira
        function configurarBotaoLixeira() {
            const btnLixeira = document.getElementById('btn-limpar-notificacoes');
            if (!btnLixeira) {
                console.warn('⚠️ Botão lixeira não encontrado no DOM');
                return false;
            }
            
            console.log('🔍 Botão lixeira encontrado:', btnLixeira);
            
            // Remove listeners antigos clonando o elemento
            const novoBtn = btnLixeira.cloneNode(true);
            btnLixeira.parentNode.replaceChild(novoBtn, btnLixeira);
            
            // Função wrapper para garantir que funcione
            const clickHandler = function(e) {
                console.log('🟢🟢🟢 CLIQUE CAPTURADO NO BOTÃO LIXEIRA (addEventListener)!', e);
                e.stopPropagation();
                e.preventDefault();
                if (window.handleClickLixeira) {
                    window.handleClickLixeira(e);
                } else {
                    console.error('❌ window.handleClickLixeira não encontrado no clickHandler!');
                }
                return false;
            };
            
            // Adiciona múltiplos listeners
            novoBtn.addEventListener('click', clickHandler, true);
            novoBtn.addEventListener('click', clickHandler, false);
            novoBtn.onclick = clickHandler;
            
            // Garante que o onclick inline funcione (sobrescreve o atributo)
            const onclickInline = 'console.log("🟢 onclick inline executado"); event.stopPropagation(); event.preventDefault(); if (window.handleClickLixeira) { console.log("🟢 Chamando handleClickLixeira do onclick inline..."); window.handleClickLixeira(event); } else { console.error("❌ handleClickLixeira não encontrado no onclick inline!"); } return false;';
            novoBtn.setAttribute('onclick', onclickInline);
            
            // Testa se o onclick está funcionando
            console.log('🔍 Botão clonado, onclick atributo:', novoBtn.getAttribute('onclick'));
            console.log('🔍 Botão clonado, onclick propriedade:', novoBtn.onclick);
            console.log('🔍 window.handleClickLixeira existe?', typeof window.handleClickLixeira);
            
            // Ícone dentro do botão
            const icon = novoBtn.querySelector('.fa-trash');
            if (icon) {
                icon.style.pointerEvents = 'none';
            }
            
            console.log('✅ Listener do botão lixeira configurado');
            return true;
        }
        
        // Flag para evitar fechar modal imediatamente após abrir (compartilhada)
        let modalAbertoAgora = false;
        
        // Configuração do botão de notificações
        if (btnNotificacoes) {
            console.log('🔔 Configurando botão de notificações...', btnNotificacoes);
            // Remove listeners antigos clonando o elemento para evitar conflitos
            const novoBtnNotificacoes = btnNotificacoes.cloneNode(true);
            btnNotificacoes.parentNode.replaceChild(novoBtnNotificacoes, btnNotificacoes);
            
            novoBtnNotificacoes.addEventListener('click', async (e) => {
                console.log('🔔🔔🔔 CLIQUE NO BOTÃO DE NOTIFICAÇÕES!', e);
                e.stopPropagation();
                e.preventDefault();
                e.stopImmediatePropagation(); // Impede que outros listeners executem
                
                // Busca o modal novamente no DOM para garantir que a referência está atualizada
                // Tenta múltiplas vezes com pequenos delays para garantir que encontre o modal
                let modalNotificacoesAtual = null;
                for (let tentativa = 0; tentativa < 5; tentativa++) {
                    modalNotificacoesAtual = document.getElementById('modal-notificacoes');
                    if (modalNotificacoesAtual) {
                        break;
                    }
                    // Aguarda um pouco antes de tentar novamente
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                
                if (!modalNotificacoesAtual) {
                    console.error('❌ modalNotificacoes não encontrado no DOM após múltiplas tentativas!');
                    console.error('❌ Verificando se o elemento existe no HTML...');
                    // Tenta encontrar qualquer elemento com id modal-notificacoes
                    const todosModais = document.querySelectorAll('[id*="modal-notificacoes"]');
                    console.error('❌ Elementos encontrados com id contendo "modal-notificacoes":', todosModais.length);
                    
                    // Se ainda não encontrou, tenta buscar pelo seletor de classe
                    const modalPorClasse = document.querySelector('.modal-overlay[id="modal-notificacoes"]');
                    if (modalPorClasse) {
                        console.log('✅ Modal encontrado por classe!');
                        modalNotificacoesAtual = modalPorClasse;
                    } else {
                        console.error('❌ Modal não encontrado de forma alguma. Verifique se o elemento existe no HTML.');
                        return;
                    }
                }
                console.log('✅ modalNotificacoes encontrado:', modalNotificacoesAtual);
                
                // Verifica o estado atual do modal de forma mais robusta
                const temClasseHidden = modalNotificacoesAtual.classList.contains('hidden');
                const displayAtual = window.getComputedStyle(modalNotificacoesAtual).display;
                const visibilityAtual = window.getComputedStyle(modalNotificacoesAtual).visibility;
                const opacityAtual = window.getComputedStyle(modalNotificacoesAtual).opacity;
                const estaVisivel = !temClasseHidden && displayAtual !== 'none' && displayAtual !== '' && visibilityAtual !== 'hidden' && opacityAtual !== '0';
                
                console.log('🔍 Estado do modal:', {
                    temClasseHidden,
                    displayAtual,
                    visibilityAtual,
                    opacityAtual,
                    estaVisivel,
                    offsetParent: modalNotificacoesAtual.offsetParent !== null,
                    styleDisplay: modalNotificacoesAtual.style.display,
                    styleVisibility: modalNotificacoesAtual.style.visibility
                });
                
                // Se o modal está visível (não tem hidden E display não é none), então fecha
                if (estaVisivel) {
                    console.log('🔒 Fechando modal (estava aberto)...');
                    
                    // IMPORTANTE: NUNCA remove o modal do DOM, apenas adiciona a classe hidden
                    // Verifica se o modal ainda está no DOM antes de fechar
                    if (!document.body.contains(modalNotificacoesAtual)) {
                        console.error('❌ Modal não está no DOM! Não é possível fechar.');
                        return;
                    }
                    
                    // Remove TODOS os estilos inline PRIMEIRO para que a classe hidden funcione
                    modalNotificacoesAtual.style.cssText = '';
                    // Remove também via removeProperty para garantir
                    modalNotificacoesAtual.style.removeProperty('display');
                    modalNotificacoesAtual.style.removeProperty('visibility');
                    modalNotificacoesAtual.style.removeProperty('opacity');
                    modalNotificacoesAtual.style.removeProperty('position');
                    modalNotificacoesAtual.style.removeProperty('z-index');
                    modalNotificacoesAtual.style.removeProperty('top');
                    modalNotificacoesAtual.style.removeProperty('left');
                    modalNotificacoesAtual.style.removeProperty('width');
                    modalNotificacoesAtual.style.removeProperty('height');
                    
                    // Agora adiciona a classe hidden
                    modalNotificacoesAtual.classList.add('hidden');
                    
                    // Limpa a mensagem de erro/aviso quando fecha o modal
                    const mensagemProposta = document.getElementById('mensagem-proposta-respondida');
                    if (mensagemProposta) {
                        mensagemProposta.style.display = 'none';
                        const mensagemTexto = document.getElementById('mensagem-proposta-texto');
                        if (mensagemTexto) {
                            mensagemTexto.textContent = '';
                        }
                        // Remove o flag quando limpa a mensagem
                        window.temMensagemErroNotificacao = false;
                    }
                    
                    // Reseta a flag imediatamente ao fechar
                    modalAbertoAgora = false;
                    // Sempre reseta o modo de seleção ao fechar o modal
                    if (modoSelecao) {
                        console.log('🔄 Resetando modo de seleção ao fechar modal');
                        modoSelecao = false;
                        notificacoesSelecionadas.clear();
                        const btnLixeiraAtual = document.getElementById('btn-limpar-notificacoes');
                        if (btnLixeiraAtual) {
                            btnLixeiraAtual.classList.remove('modo-selecao');
                        }
                        if (selecionarTudoContainer) {
                            selecionarTudoContainer.style.display = 'none';
                        }
                    }
                    
                    // Verifica se o modal foi fechado corretamente (múltiplas verificações)
                    setTimeout(() => {
                        const modalVerificacao = document.getElementById('modal-notificacoes');
                        if (modalVerificacao) {
                            const aindaTemHidden = modalVerificacao.classList.contains('hidden');
                            const displayVerificacao = window.getComputedStyle(modalVerificacao).display;
                            console.log('🔍 Verificação pós-fechar:', {
                                aindaTemHidden,
                                displayVerificacao,
                                aindaNoDOM: true
                            });
                        } else {
                            console.error('❌ Modal não encontrado no DOM após fechar!');
                            console.error('❌ Isso não deveria acontecer. Algo está removendo o modal.');
                        }
                    }, 50);
                    
                    setTimeout(() => {
                        const modalVerificacao2 = document.getElementById('modal-notificacoes');
                        if (!modalVerificacao2) {
                            console.error('❌ Modal ainda não encontrado após 100ms!');
                        }
                    }, 100);
                    
                    return;
                }
                
                // Se chegou aqui, o modal está fechado - vamos abrir
                console.log('🔓 Abrindo modal (estava fechado)...');
                console.log('🔍 Estado antes de abrir:', {
                    temClasseHidden: modalNotificacoesAtual.classList.contains('hidden'),
                    display: window.getComputedStyle(modalNotificacoesAtual).display,
                    modalAbertoAgora: modalAbertoAgora
                });
                
                // Limpa a mensagem de erro/aviso quando abre o modal
                const mensagemProposta = document.getElementById('mensagem-proposta-respondida');
                if (mensagemProposta) {
                    mensagemProposta.style.display = 'none';
                    const mensagemTexto = document.getElementById('mensagem-proposta-texto');
                    if (mensagemTexto) {
                        mensagemTexto.textContent = '';
                    }
                    // Remove o flag quando limpa a mensagem
                    window.temMensagemErroNotificacao = false;
                }
                
                // Garante que o modo de seleção está desativado ao abrir o modal
                if (modoSelecao) {
                    console.log('🔄 Resetando modo de seleção ao abrir modal');
                    modoSelecao = false;
                    notificacoesSelecionadas.clear();
                    const btnLixeiraAtual = document.getElementById('btn-limpar-notificacoes');
                    if (btnLixeiraAtual) {
                        btnLixeiraAtual.classList.remove('modo-selecao');
                    }
                    if (selecionarTudoContainer) {
                        selecionarTudoContainer.style.display = 'none';
                    }
                }
                
                // Reseta a flag ANTES de abrir para garantir que não interfira
                modalAbertoAgora = false;
                
                if (listaNotificacoes) listaNotificacoes.innerHTML = '<p style="text-align: center; padding: 20px;">Carregando notificações...</p>';
                
                // Remove a classe hidden PRIMEIRO
                modalNotificacoesAtual.classList.remove('hidden');
                
                // Força os estilos necessários de forma simples e direta
                modalNotificacoesAtual.style.setProperty('display', 'flex', 'important');
                modalNotificacoesAtual.style.setProperty('visibility', 'visible', 'important');
                modalNotificacoesAtual.style.setProperty('opacity', '1', 'important');
                modalNotificacoesAtual.style.setProperty('position', 'fixed', 'important');
                modalNotificacoesAtual.style.setProperty('z-index', '1000', 'important');
                modalNotificacoesAtual.style.setProperty('top', '0', 'important');
                modalNotificacoesAtual.style.setProperty('left', '0', 'important');
                modalNotificacoesAtual.style.setProperty('width', '100%', 'important');
                modalNotificacoesAtual.style.setProperty('height', '100%', 'important');
                
                // Marca que o modal acabou de ser aberto DEPOIS de aplicar os estilos
                modalAbertoAgora = true;
                
                console.log('✅ Modal aberto, carregando notificações...');
                
                // Aguarda um frame para garantir que os estilos foram aplicados
                await new Promise(resolve => requestAnimationFrame(resolve));
                
                // Verifica se o modal realmente abriu
                const modalAposAbrir = document.getElementById('modal-notificacoes');
                if (modalAposAbrir) {
                    const aindaTemHidden = modalAposAbrir.classList.contains('hidden');
                    const displayAposAbrir = window.getComputedStyle(modalAposAbrir).display;
                    const visibilityAposAbrir = window.getComputedStyle(modalAposAbrir).visibility;
                    
                    console.log('🔍 Estado após abrir:', {
                        temClasseHidden: aindaTemHidden,
                        display: displayAposAbrir,
                        visibility: visibilityAposAbrir,
                        modalAbertoAgora: modalAbertoAgora,
                        offsetParent: modalAposAbrir.offsetParent !== null
                    });
                    
                    // Se ainda tem hidden ou display é none, força novamente
                    if (aindaTemHidden || displayAposAbrir === 'none') {
                        console.warn('⚠️ Modal não abriu corretamente, forçando novamente...');
                        modalAposAbrir.classList.remove('hidden');
                        modalAposAbrir.style.setProperty('display', 'flex', 'important');
                        modalAposAbrir.style.setProperty('visibility', 'visible', 'important');
                        modalAposAbrir.style.setProperty('opacity', '1', 'important');
                    }
                } else {
                    console.error('❌ Modal não encontrado após tentar abrir!');
                }
                
                // Carrega as notificações
                await carregarNotificacoes();
                
                // Verifica se o modal ainda está visível após carregar
                await new Promise(resolve => requestAnimationFrame(resolve));
                
                // Busca o modal novamente para garantir que ainda está no DOM
                const modalVerificacao = document.getElementById('modal-notificacoes');
                if (modalVerificacao) {
                    const aindaTemHidden = modalVerificacao.classList.contains('hidden');
                    const displayVerificacao = window.getComputedStyle(modalVerificacao).display;
                    
                    if (aindaTemHidden || displayVerificacao === 'none') {
                        console.warn('⚠️ Modal foi fechado durante o carregamento, reabrindo...');
                        modalVerificacao.classList.remove('hidden');
                        modalVerificacao.style.setProperty('display', 'flex', 'important');
                        modalVerificacao.style.setProperty('visibility', 'visible', 'important');
                        modalVerificacao.style.setProperty('opacity', '1', 'important');
                    }
                }
                
                setTimeout(() => {
                    configurarBotaoLixeira();
                    // Remove a flag após um tempo maior para garantir que o modal não fecha imediatamente
                    setTimeout(() => {
                        modalAbertoAgora = false;
                        console.log('✅ Flag modalAbertoAgora removida, modal pode ser fechado agora');
                    }, 500);
                }, 300);
                
                // Marca todas como lidas ao abrir
                try {
                    await fetch('/api/notificacoes/marcar-todas-lidas', {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    await carregarNotificacoes();
                } catch (err) {
                    console.error('Erro ao marcar todas como lidas:', err);
                }
            });
            console.log('✅ Event listener do botão de notificações adicionado');
            
            // Fecha modal ao clicar fora (usa novoBtnNotificacoes)
            // Usa um listener único por página para evitar múltiplos listeners
            if (!window.notificacoesClickForaListener) {
                window.notificacoesClickForaListener = true;
                document.addEventListener('click', (ev) => {
                    // Se o modal acabou de ser aberto, ignora este clique
                    if (modalAbertoAgora) {
                        console.log('⏸️ Ignorando clique - modal acabou de ser aberto');
                        return;
                    }
                    
                    // Busca o modal dinamicamente para garantir que a referência está atualizada
                    const modalNotificacoesAtual = document.getElementById('modal-notificacoes');
                    if (!modalNotificacoesAtual) {
                        console.log('⚠️ Modal não encontrado no listener de clique fora');
                        return;
                    }
                    
                    // Verifica se o modal está realmente aberto
                    // Considera tanto a classe hidden quanto os estilos inline
                    const temClasseHidden = modalNotificacoesAtual.classList.contains('hidden');
                    const displayAtual = window.getComputedStyle(modalNotificacoesAtual).display;
                    const styleDisplay = modalNotificacoesAtual.style.display;
                    const styleVisibility = modalNotificacoesAtual.style.visibility;
                    
                    // Modal está aberto se: não tem hidden E (display é flex OU tem estilos inline forçando visibilidade)
                    const estaAberto = !temClasseHidden && (displayAtual === 'flex' || styleDisplay === 'flex' || (styleDisplay && styleDisplay.includes('flex')));
                    
                    if (!estaAberto) {
                        // Modal já está fechado, não precisa fazer nada
                        return;
                    }
                    
                    const cliqueDentro = modalNotificacoesAtual.contains(ev.target);
                    const cliqueNoBotao = novoBtnNotificacoes.contains(ev.target);
                    console.log('🔍 Verificando clique fora:', { 
                        cliqueDentro, 
                        cliqueNoBotao, 
                        target: ev.target,
                        estaAberto,
                        temClasseHidden,
                        displayAtual
                    });
                    
                    if (!cliqueDentro && !cliqueNoBotao) {
                        console.log('🔒 Fechando modal por clique fora');
                        
                        // IMPORTANTE: NUNCA remove o modal do DOM, apenas adiciona a classe hidden
                        // Verifica se o modal ainda está no DOM antes de fechar
                        if (!document.body.contains(modalNotificacoesAtual)) {
                            console.error('❌ Modal não está no DOM! Não é possível fechar.');
                            return;
                        }
                        
                        // Remove TODOS os estilos inline PRIMEIRO para que a classe hidden funcione
                        modalNotificacoesAtual.style.cssText = '';
                        // Remove também via removeProperty para garantir
                        modalNotificacoesAtual.style.removeProperty('display');
                        modalNotificacoesAtual.style.removeProperty('visibility');
                        modalNotificacoesAtual.style.removeProperty('opacity');
                        modalNotificacoesAtual.style.removeProperty('position');
                        modalNotificacoesAtual.style.removeProperty('z-index');
                        modalNotificacoesAtual.style.removeProperty('top');
                        modalNotificacoesAtual.style.removeProperty('left');
                        modalNotificacoesAtual.style.removeProperty('width');
                        modalNotificacoesAtual.style.removeProperty('height');
                        
                        // Agora adiciona a classe hidden
                        modalNotificacoesAtual.classList.add('hidden');
                        
                        // Reseta a flag imediatamente ao fechar
                        modalAbertoAgora = false;
                        // Sempre reseta o modo de seleção ao fechar o modal
                        if (modoSelecao) {
                            console.log('🔄 Resetando modo de seleção ao fechar modal');
                            modoSelecao = false;
                            notificacoesSelecionadas.clear();
                            const btnLixeiraAtual = document.getElementById('btn-limpar-notificacoes');
                            if (btnLixeiraAtual) {
                                btnLixeiraAtual.classList.remove('modo-selecao');
                            }
                            if (selecionarTudoContainer) {
                                selecionarTudoContainer.style.display = 'none';
                            }
                        }
                        
                        // Verifica se o modal ainda está no DOM após fechar (múltiplas verificações)
                        setTimeout(() => {
                            const modalVerificacao = document.getElementById('modal-notificacoes');
                            if (!modalVerificacao) {
                                console.error('❌ Modal foi removido do DOM após fechar!');
                                console.error('❌ Isso não deveria acontecer. Algo está removendo o modal.');
                            } else {
                                console.log('✅ Modal ainda está no DOM após fechar');
                                // Verifica se ainda tem a classe hidden
                                if (!modalVerificacao.classList.contains('hidden')) {
                                    console.warn('⚠️ Modal não tem classe hidden após fechar, adicionando...');
                                    modalVerificacao.classList.add('hidden');
                                }
                            }
                        }, 50);
                        
                        setTimeout(() => {
                            const modalVerificacao2 = document.getElementById('modal-notificacoes');
                            if (!modalVerificacao2) {
                                console.error('❌ Modal ainda não encontrado após 100ms!');
                            }
                        }, 100);
                    }
                });
            }
        } else {
            console.warn('⚠️ Botão de notificações não encontrado no DOM!');
        }
        
        // Botão marcar todas como lidas
        if (btnMarcarTodasLidas) {
            btnMarcarTodasLidas.addEventListener('click', async () => {
                try {
                    await fetch('/api/notificacoes/marcar-todas-lidas', {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    await carregarNotificacoes();
                } catch (err) {
                    console.error('Erro ao marcar todas notificações como lidas:', err);
                }
            });
        }
        
        // Botão selecionar tudo
        if (btnSelecionarTudo) {
            btnSelecionarTudo.addEventListener('click', () => {
                const todasCards = document.querySelectorAll('.notificacao-card');
                const todasSelecionadas = notificacoesSelecionadas.size === todasCards.length;
                
                if (todasSelecionadas) {
                    notificacoesSelecionadas.clear();
                    todasCards.forEach(card => card.classList.remove('selecionada'));
                } else {
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
        
        // Delegação de eventos no modal (captura TODOS os cliques no modal)
        if (modalNotificacoes) {
            modalNotificacoes.addEventListener('click', (e) => {
                // Ignora cliques em notificações (elas têm seus próprios listeners)
                const notificacaoCard = e.target.closest('.notificacao-card');
                if (notificacaoCard) {
                    // Deixa o clique passar para o listener da notificação
                    return;
                }
                
                // Se clicou diretamente no overlay (não no conteúdo), fecha o modal
                const modalContent = modalNotificacoes.querySelector('.modal-content');
                if (e.target === modalNotificacoes || (modalContent && !modalContent.contains(e.target))) {
                    // Não fecha se clicou em um botão
                    if (!e.target.closest('button') || e.target.classList.contains('btn-close-modal')) {
                        console.log('🔒 Fechando modal por clique no overlay (delegação)');
                        // Remove estilos inline primeiro
                        modalNotificacoes.style.cssText = '';
                        modalNotificacoes.style.removeProperty('display');
                        modalNotificacoes.style.removeProperty('visibility');
                        modalNotificacoes.style.removeProperty('opacity');
                        // Adiciona classe hidden
                        modalNotificacoes.classList.add('hidden');
                        modalAbertoAgora = false;
                        e.stopPropagation();
                        return;
                    }
                }
                
                console.log('🔵 Clique detectado no modal, target:', e.target, 'currentTarget:', e.currentTarget);
                const btnLixeira = e.target.closest('#btn-limpar-notificacoes');
                const iconLixeira = e.target.closest('.fa-trash');
                const isLixeira = btnLixeira || (iconLixeira && iconLixeira.closest('#btn-limpar-notificacoes'));
                
                if (isLixeira) {
                    console.log('🔴 Clique detectado via delegação no modal!', e.target);
                    e.stopPropagation();
                    e.preventDefault();
                    if (window.handleClickLixeira) {
                        window.handleClickLixeira(e);
                    } else {
                        console.error('❌ window.handleClickLixeira não encontrado na delegação!');
                    }
                    return false;
                }
            }, true); // Capture phase - captura antes de outros eventos
            
            // Também adiciona no bubble phase
            modalNotificacoes.addEventListener('click', (e) => {
                const btnLixeira = e.target.closest('#btn-limpar-notificacoes');
                if (btnLixeira) {
                    console.log('🔴 Clique detectado via delegação (bubble)!', e.target);
                    e.stopPropagation();
                    e.preventDefault();
                    if (window.handleClickLixeira) {
                        window.handleClickLixeira(e);
                    }
                    return false;
                }
            }, false);
        }
        
        // Torna a função global para acesso externo
        window.carregarNotificacoes = carregarNotificacoes;
        
        // Carrega notificações periodicamente (mas não se houver mensagem de erro)
        setInterval(() => {
            if (!window.temMensagemErroNotificacao) {
                carregarNotificacoes();
            }
        }, 30000);
        carregarNotificacoes();
        
        // Proteção: verifica periodicamente se o modal ainda está no DOM
        setInterval(() => {
            const modalVerificacao = document.getElementById('modal-notificacoes');
            if (!modalVerificacao) {
                console.error('❌ Modal de notificações não encontrado no DOM durante verificação periódica!');
                console.error('❌ Isso não deveria acontecer. O modal pode ter sido removido por algum código.');
                // Tenta encontrar o modal no HTML original
                const modalNoHTML = document.querySelector('[id="modal-notificacoes"]');
                if (!modalNoHTML) {
                    console.error('❌ Modal não encontrado em lugar nenhum. Verifique se o elemento existe no HTML.');
                }
            }
        }, 5000); // Verifica a cada 5 segundos
    }
})();

