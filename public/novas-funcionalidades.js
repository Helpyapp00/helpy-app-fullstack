// 🚨 NOVO: Funcionalidades para Pedidos Urgentes, Times Locais e Projetos de Time
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('jwtToken');
    const userId = localStorage.getItem('userId');
    const userType = localStorage.getItem('userType');

    // ============================================
    // PEDIDOS URGENTES ("Preciso Agora!")
    // ============================================
    
    const modalPedidoUrgente = document.getElementById('modal-pedido-urgente');
    const formPedidoUrgente = document.getElementById('form-pedido-urgente');
    const btnProcurarClientes = document.getElementById('btn-procurar-clientes');
    const modalPrecisoAgora = document.getElementById('modal-preciso-agora');

    // Botão "Procurar Clientes" dentro do modal de profissionais próximos
    // Disponível para todos os usuários (profissionais também podem precisar de outros profissionais)
    if (btnProcurarClientes) {
        btnProcurarClientes.addEventListener('click', () => {
            // Fecha o modal de profissionais próximos
            if (modalPrecisoAgora) {
                modalPrecisoAgora.classList.add('hidden');
            }
            // Abre o modal de pedido urgente
            if (modalPedidoUrgente) {
                modalPedidoUrgente.classList.remove('hidden');
            }
        });
    }

    if (formPedidoUrgente) {
        formPedidoUrgente.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const servico = document.getElementById('pedido-servico').value;
            const categoria = document.getElementById('pedido-categoria').value;
            const descricao = document.getElementById('pedido-descricao').value;
            const endereco = document.getElementById('pedido-endereco').value;
            const cidade = document.getElementById('pedido-cidade').value;
            const estado = document.getElementById('pedido-estado').value;

            try {
                const response = await fetch('/api/pedidos-urgentes', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        servico,
                        categoria,
                        descricao,
                        localizacao: {
                            endereco,
                            cidade,
                            estado
                        }
                    })
                });

                const data = await response.json();
                
                if (data.success) {
                    alert(`Pedido criado! ${data.profissionaisNotificados} profissionais foram notificados.`);
                    formPedidoUrgente.reset();
                    modalPedidoUrgente?.classList.add('hidden');
                    
                    // Abre modal de propostas após 3 segundos
                    setTimeout(() => {
                        carregarPropostas(data.pedido._id);
                    }, 3000);
                } else {
                    alert(data.message || 'Erro ao criar pedido.');
                }
            } catch (error) {
                console.error('Erro ao criar pedido urgente:', error);
                alert('Erro ao criar pedido urgente.');
            }
        });
    }

    // Carregar propostas de um pedido
    async function carregarPropostas(pedidoId) {
        const modalPropostas = document.getElementById('modal-propostas');
        const listaPropostas = document.getElementById('lista-propostas');
        
        if (!modalPropostas || !listaPropostas) return;

        try {
            const response = await fetch(`/api/pedidos-urgentes/${pedidoId}/propostas`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                modalPropostas.classList.remove('hidden');
                
                if (data.propostas.length === 0) {
                    listaPropostas.innerHTML = '<p>Ainda não há propostas. Profissionais serão notificados!</p>';
                    return;
                }

                listaPropostas.innerHTML = data.propostas.map(proposta => {
                    const prof = proposta.profissionalId;
                    const nivel = prof.gamificacao?.nivel || 1;
                    const mediaAvaliacao = prof.mediaAvaliacao || 0;
                    
                    return `
                        <div class="proposta-card">
                            <div class="proposta-header">
                                <img src="${prof.avatarUrl || prof.foto || 'imagens/default-user.png'}" 
                                     alt="${prof.nome}" class="proposta-avatar">
                                <div class="proposta-info-profissional">
                                    <strong>${prof.nome}</strong>
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
                            <button class="btn-aceitar-proposta" data-proposta-id="${proposta._id}" data-pedido-id="${pedidoId}">
                                Aceitar Proposta
                            </button>
                        </div>
                    `;
                }).join('');

                // Adicionar listeners para aceitar propostas
                document.querySelectorAll('.btn-aceitar-proposta').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const propostaId = btn.dataset.propostaId;
                        const pedidoId = btn.dataset.pedidoId;
                        
                        if (!confirm('Tem certeza que deseja aceitar esta proposta?')) return;

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
                                alert('Proposta aceita! O profissional foi notificado.');
                                modalPropostas.classList.add('hidden');
                            } else {
                                alert(data.message || 'Erro ao aceitar proposta.');
                            }
                        } catch (error) {
                            console.error('Erro ao aceitar proposta:', error);
                            alert('Erro ao aceitar proposta.');
                        }
                    });
                });
            }
        } catch (error) {
            console.error('Erro ao carregar propostas:', error);
            listaPropostas.innerHTML = '<p>Erro ao carregar propostas.</p>';
        }
    }

    // ============================================
    // TIMES LOCAIS
    // ============================================
    
    const btnCriarTimeLocal = document.getElementById('btn-criar-time');
    const modalCriarTimeLocal = document.getElementById('modal-criar-time-local');
    const formCriarTimeLocal = document.getElementById('form-criar-time-local');

    if (btnCriarTimeLocal && userType === 'trabalhador') {
        btnCriarTimeLocal.addEventListener('click', () => {
            modalCriarTimeLocal?.classList.remove('hidden');
        });
    } else if (btnCriarTimeLocal) {
        btnCriarTimeLocal.style.display = 'none';
    }

    if (formCriarTimeLocal) {
        formCriarTimeLocal.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const nome = document.getElementById('time-nome').value;
            const descricao = document.getElementById('time-descricao').value;
            const categoria = document.getElementById('time-categoria').value;

            try {
                const response = await fetch('/api/times-locais', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ nome, descricao, categoria })
                });

                const data = await response.json();
                
                if (data.success) {
                    alert('Time local criado com sucesso!');
                    formCriarTimeLocal.reset();
                    modalCriarTimeLocal?.classList.add('hidden');
                    carregarTimesLocais();
                } else {
                    alert(data.message || 'Erro ao criar time local.');
                }
            } catch (error) {
                console.error('Erro ao criar time local:', error);
                alert('Erro ao criar time local.');
            }
        });
    }

    // Carregar times locais
    async function carregarTimesLocais() {
        const timesContainer = document.getElementById('times-container');
        if (!timesContainer) return;

        try {
            const response = await fetch('/api/times-locais');
            const data = await response.json();
            
            if (data.success && data.times.length > 0) {
                timesContainer.innerHTML = data.times.slice(0, 5).map(time => `
                    <div class="time-card-lateral">
                        <strong>${time.nome}</strong>
                        <small>Nível ${time.nivelMedio} • ${time.categoria}</small>
                    </div>
                `).join('');
            } else {
                timesContainer.innerHTML = '<p style="font-size: 12px; color: var(--text-secondary);">Nenhum time disponível</p>';
            }
        } catch (error) {
            console.error('Erro ao carregar times locais:', error);
        }
    }

    if (userType === 'trabalhador') {
        carregarTimesLocais();
    }

    // ============================================
    // PROJETOS DE TIME / MUTIRÃO
    // ============================================
    
    const btnCriarProjetoTime = document.getElementById('btn-criar-projeto-time');
    const modalProjetoTime = document.getElementById('modal-projeto-time');
    const formProjetoTime = document.getElementById('form-projeto-time');
    const profissionaisListaProjeto = document.getElementById('profissionais-lista-projeto');
    const btnAdicionarProfissionalProjeto = document.getElementById('btn-adicionar-profissional-projeto');

    if (btnAdicionarProfissionalProjeto) {
        btnAdicionarProfissionalProjeto.addEventListener('click', () => {
            const novoItem = document.createElement('div');
            novoItem.className = 'profissional-item-projeto';
            novoItem.innerHTML = `
                <input type="text" placeholder="Tipo (ex: pintor)" class="tipo-profissional-projeto" required>
                <input type="number" placeholder="Qtd" class="qtd-profissional-projeto" min="1" value="1" required>
                <input type="number" placeholder="R$ por pessoa" class="valor-profissional-projeto" min="0" step="0.01" required>
                <button type="button" class="btn-remover-profissional-projeto">&times;</button>
            `;
            profissionaisListaProjeto.appendChild(novoItem);
        });
    }

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remover-profissional-projeto')) {
            if (profissionaisListaProjeto.children.length > 1) {
                e.target.closest('.profissional-item-projeto').remove();
            } else {
                alert('Você precisa de pelo menos um profissional.');
            }
        }
    });

    // ============================================
    // PEDIDOS URGENTES PARA PROFISSIONAIS
    // ============================================
    
    const btnVerPedidosUrgentes = document.getElementById('btn-ver-pedidos-urgentes');
    const modalPedidosUrgentesProfissional = document.getElementById('modal-pedidos-urgentes-profissional');
    const listaPedidosUrgentes = document.getElementById('lista-pedidos-urgentes');
    const modalEnviarProposta = document.getElementById('modal-enviar-proposta');
    const formEnviarProposta = document.getElementById('form-enviar-proposta');

    async function carregarPedidosUrgentes(categoria = null) {
        if (!listaPedidosUrgentes) return;

        try {
            let url = '/api/pedidos-urgentes';
            if (categoria) {
                url += `?categoria=${encodeURIComponent(categoria)}`;
            }

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                if (data.pedidos.length === 0) {
                    listaPedidosUrgentes.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-secondary);">Nenhum pedido urgente disponível no momento.</p>';
                    return;
                }

                listaPedidosUrgentes.innerHTML = data.pedidos.map(pedido => {
                    const cliente = pedido.clienteId;
                    const tempoRestante = Math.max(0, Math.ceil((new Date(pedido.dataExpiracao) - new Date()) / 60000));
                    
                    return `
                        <div class="pedido-urgente-card">
                            <div class="pedido-header">
                                <div>
                                    <strong>${pedido.servico}</strong>
                                    <span class="badge-categoria">${pedido.categoria}</span>
                                </div>
                                <span class="tempo-restante">⏱️ ${tempoRestante} min</span>
                            </div>
                            ${pedido.descricao ? `<p class="pedido-descricao">${pedido.descricao}</p>` : ''}
                            <div class="pedido-localizacao">
                                <i class="fas fa-map-marker-alt"></i> 
                                ${pedido.localizacao.endereco}, ${pedido.localizacao.cidade} - ${pedido.localizacao.estado}
                            </div>
                            <div class="pedido-cliente">
                                <img src="${cliente?.avatarUrl || cliente?.foto || 'imagens/default-user.png'}" 
                                     alt="${cliente?.nome || 'Cliente'}" class="avatar-pequeno">
                                <span>${cliente?.nome || 'Cliente'}</span>
                            </div>
                            <button class="btn-enviar-proposta" data-pedido-id="${pedido._id}">
                                <i class="fas fa-paper-plane"></i> Enviar Proposta
                            </button>
                        </div>
                    `;
                }).join('');

                // Adicionar listeners para enviar propostas
                document.querySelectorAll('.btn-enviar-proposta').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const pedidoId = btn.dataset.pedidoId;
                        document.getElementById('proposta-pedido-id').value = pedidoId;
                        modalEnviarProposta?.classList.remove('hidden');
                        modalPedidosUrgentesProfissional?.classList.add('hidden');
                    });
                });
            }
        } catch (error) {
            console.error('Erro ao carregar pedidos urgentes:', error);
            listaPedidosUrgentes.innerHTML = '<p style="color: var(--error-color);">Erro ao carregar pedidos urgentes. Tente novamente.</p>';
        }
    }

    // Event listener para o botão de filtrar
    const btnFiltrarPedidos = document.getElementById('btn-filtrar-pedidos');
    const filtroCategoriaPedidos = document.getElementById('filtro-categoria-pedidos');
    
    if (btnFiltrarPedidos && filtroCategoriaPedidos) {
        btnFiltrarPedidos.addEventListener('click', async () => {
            const categoria = filtroCategoriaPedidos.value || null;
            await carregarPedidosUrgentes(categoria);
        });
    }

    // Adicionar botão na lateral se for profissional (após a função estar definida)
    if (userType === 'trabalhador' && !btnVerPedidosUrgentes) {
        const acoesRapidas = document.querySelector('.filtro-acoes-rapidas');
        if (acoesRapidas) {
            const btnNovo = document.createElement('button');
            btnNovo.id = 'btn-ver-pedidos-urgentes';
            btnNovo.className = 'btn-preciso-agora-lateral';
            btnNovo.innerHTML = '<i class="fas fa-bolt"></i> Ver Pedidos Urgentes';
            btnNovo.style.marginTop = '10px';
            acoesRapidas.appendChild(btnNovo);
            
            btnNovo.addEventListener('click', async () => {
                await carregarPedidosUrgentes();
                modalPedidosUrgentesProfissional?.classList.remove('hidden');
            });
        }
    }

    // Torna a função acessível globalmente
    window.carregarPedidosUrgentes = carregarPedidosUrgentes;

    if (formEnviarProposta) {
        formEnviarProposta.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const pedidoId = document.getElementById('proposta-pedido-id').value;
            const valor = parseFloat(document.getElementById('proposta-valor').value);
            const tempoChegada = document.getElementById('proposta-tempo-chegada').value;
            const observacoes = document.getElementById('proposta-observacoes').value;

            try {
                const response = await fetch(`/api/pedidos-urgentes/${pedidoId}/proposta`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        valor,
                        tempoChegada,
                        observacoes
                    })
                });

                const data = await response.json();
                
                if (data.success) {
                    alert('Proposta enviada com sucesso! O cliente será notificado.');
                    formEnviarProposta.reset();
                    modalEnviarProposta?.classList.add('hidden');
                } else {
                    alert(data.message || 'Erro ao enviar proposta.');
                }
            } catch (error) {
                console.error('Erro ao enviar proposta:', error);
                alert('Erro ao enviar proposta.');
            }
        });
    }

    // Adicionar botão para criar projeto de time (clientes)
    if (userType === 'cliente' && modalProjetoTime) {
        const acoesRapidas = document.querySelector('.filtro-acoes-rapidas');
        if (acoesRapidas && !document.getElementById('btn-criar-projeto-time')) {
            const btnNovo = document.createElement('button');
            btnNovo.id = 'btn-criar-projeto-time';
            btnNovo.className = 'btn-preciso-agora-lateral';
            btnNovo.innerHTML = '<i class="fas fa-project-diagram"></i> Criar Projeto de Time';
            acoesRapidas.appendChild(btnNovo);
            
            btnNovo.addEventListener('click', () => {
                modalProjetoTime.classList.remove('hidden');
            });
        }
    }

    if (formProjetoTime) {
        formProjetoTime.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const titulo = document.getElementById('projeto-titulo').value;
            const descricao = document.getElementById('projeto-descricao').value;
            const categoria = document.getElementById('projeto-categoria').value;
            const dataServico = document.getElementById('projeto-data').value;
            const horaInicio = document.getElementById('projeto-hora-inicio').value;
            const horaFim = document.getElementById('projeto-hora-fim').value;
            const endereco = document.getElementById('projeto-endereco').value;
            const cidade = document.getElementById('projeto-cidade').value;
            const estado = document.getElementById('projeto-estado').value;
            const valorTotal = parseFloat(document.getElementById('projeto-valor-total').value);

            const profissionaisNecessarios = Array.from(profissionaisListaProjeto.children).map(item => ({
                tipo: item.querySelector('.tipo-profissional-projeto').value,
                quantidade: parseInt(item.querySelector('.qtd-profissional-projeto').value),
                valorPorPessoa: parseFloat(item.querySelector('.valor-profissional-projeto').value)
            }));

            try {
                const response = await fetch('/api/projetos-time', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        titulo,
                        descricao,
                        categoria,
                        localizacao: {
                            endereco,
                            cidade,
                            estado
                        },
                        dataServico,
                        horaInicio,
                        horaFim,
                        profissionaisNecessarios,
                        valorTotal
                    })
                });

                const data = await response.json();
                
                if (data.success) {
                    alert('Projeto de time criado com sucesso!');
                    formProjetoTime.reset();
                    modalProjetoTime?.classList.add('hidden');
                } else {
                    alert(data.message || 'Erro ao criar projeto.');
                }
            } catch (error) {
                console.error('Erro ao criar projeto de time:', error);
                alert('Erro ao criar projeto de time.');
            }
        });
    }

    // ============================================
    // VAGAS-RELÂMPAGO (para empresas)
    // ============================================
    
    const modalVagaRelampago = document.getElementById('modal-vaga-relampago');
    const formVagaRelampago = document.getElementById('form-vaga-relampago');
    const modalVagasRelampagoProfissional = document.getElementById('modal-vagas-relampago-profissional');
    const listaVagasRelampago = document.getElementById('lista-vagas-relampago');
    const modalCandidatosVaga = document.getElementById('modal-candidatos-vaga');

    // Adicionar botão para criar vaga-relâmpago (empresas)
    if (userType === 'empresa') {
        const acoesRapidas = document.querySelector('.filtro-acoes-rapidas');
        if (acoesRapidas && !document.getElementById('btn-criar-vaga-relampago')) {
            const btnNovo = document.createElement('button');
            btnNovo.id = 'btn-criar-vaga-relampago';
            btnNovo.className = 'btn-preciso-agora-lateral';
            btnNovo.innerHTML = '<i class="fas fa-bolt"></i> Criar Vaga-Relâmpago';
            acoesRapidas.appendChild(btnNovo);
            
            btnNovo.addEventListener('click', () => {
                modalVagaRelampago?.classList.remove('hidden');
            });
        }

        // Adicionar botão para ver minhas vagas
        if (acoesRapidas && !document.getElementById('btn-minhas-vagas')) {
            const btnMinhasVagas = document.createElement('button');
            btnMinhasVagas.id = 'btn-minhas-vagas';
            btnMinhasVagas.className = 'btn-preciso-agora-lateral';
            btnMinhasVagas.innerHTML = '<i class="fas fa-list"></i> Minhas Vagas';
            acoesRapidas.appendChild(btnMinhasVagas);
            
            btnMinhasVagas.addEventListener('click', async () => {
                await carregarMinhasVagas();
            });
        }
    }

    // Adicionar botão para ver vagas-relâmpago (profissionais)
    if (userType === 'trabalhador') {
        const acoesRapidas = document.querySelector('.filtro-acoes-rapidas');
        if (acoesRapidas && !document.getElementById('btn-ver-vagas-relampago')) {
            const btnNovo = document.createElement('button');
            btnNovo.id = 'btn-ver-vagas-relampago';
            btnNovo.className = 'btn-preciso-agora-lateral';
            btnNovo.innerHTML = '<i class="fas fa-briefcase"></i> Vagas-Relâmpago';
            acoesRapidas.appendChild(btnNovo);
            
            btnNovo.addEventListener('click', async () => {
                await carregarVagasRelampago();
                modalVagasRelampagoProfissional?.classList.remove('hidden');
            });
        }
    }

    if (formVagaRelampago) {
        formVagaRelampago.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const titulo = document.getElementById('vaga-titulo').value;
            const descricao = document.getElementById('vaga-descricao').value;
            const cargo = document.getElementById('vaga-cargo').value;
            const quantidade = parseInt(document.getElementById('vaga-quantidade').value);
            const dataServico = document.getElementById('vaga-data').value;
            const horaInicio = document.getElementById('vaga-hora-inicio').value;
            const horaFim = document.getElementById('vaga-hora-fim').value;
            const valorPorPessoa = parseFloat(document.getElementById('vaga-valor').value);
            const formaPagamento = document.getElementById('vaga-forma-pagamento').value;
            const endereco = document.getElementById('vaga-endereco').value;
            const cidade = document.getElementById('vaga-cidade').value;
            const estado = document.getElementById('vaga-estado').value;

            try {
                const response = await fetch('/api/vagas-relampago', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        titulo,
                        descricao,
                        cargo,
                        quantidade,
                        dataServico,
                        horaInicio,
                        horaFim,
                        valorPorPessoa,
                        formaPagamento,
                        localizacao: {
                            endereco,
                            cidade,
                            estado
                        }
                    })
                });

                const data = await response.json();
                
                if (data.success) {
                    alert(`Vaga-relâmpago criada! ${data.profissionaisNotificados} profissionais foram notificados.`);
                    formVagaRelampago.reset();
                    modalVagaRelampago?.classList.add('hidden');
                } else {
                    alert(data.message || 'Erro ao criar vaga-relâmpago.');
                }
            } catch (error) {
                console.error('Erro ao criar vaga-relâmpago:', error);
                alert('Erro ao criar vaga-relâmpago.');
            }
        });
    }

    async function carregarVagasRelampago() {
        if (!listaVagasRelampago) return;

        try {
            const response = await fetch('/api/vagas-relampago', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                if (data.vagas.length === 0) {
                    listaVagasRelampago.innerHTML = '<p>Nenhuma vaga-relâmpago disponível no momento.</p>';
                    return;
                }

                listaVagasRelampago.innerHTML = data.vagas.map(vaga => {
                    const empresa = vaga.empresaId;
                    const dataServico = new Date(vaga.dataServico);
                    const hoje = new Date();
                    const isHoje = dataServico.toDateString() === hoje.toDateString();
                    const tempoRestante = Math.max(0, Math.ceil((new Date(vaga.dataExpiracao) - new Date()) / 60000));
                    const vagasRestantes = vaga.quantidade - (vaga.profissionaisAceitos?.length || 0);
                    
                    return `
                        <div class="vaga-relampago-card">
                            <div class="vaga-header">
                                <div>
                                    <strong>${vaga.titulo}</strong>
                                    <span class="badge-cargo">${vaga.cargo}</span>
                                </div>
                                <span class="tempo-restante">⏱️ ${tempoRestante} min</span>
                            </div>
                            <p class="vaga-descricao">${vaga.descricao}</p>
                            <div class="vaga-info">
                                <div class="vaga-info-item">
                                    <i class="fas fa-calendar"></i> 
                                    ${isHoje ? 'Hoje' : dataServico.toLocaleDateString('pt-BR')} 
                                    ${vaga.horaInicio} - ${vaga.horaFim}
                                </div>
                                <div class="vaga-info-item">
                                    <i class="fas fa-users"></i> 
                                    ${vagasRestantes} de ${vaga.quantidade} vagas disponíveis
                                </div>
                                <div class="vaga-info-item">
                                    <i class="fas fa-dollar-sign"></i> 
                                    R$ ${vaga.valorPorPessoa.toFixed(2)} por pessoa
                                </div>
                                <div class="vaga-info-item">
                                    <i class="fas fa-map-marker-alt"></i> 
                                    ${vaga.localizacao.endereco}, ${vaga.localizacao.cidade} - ${vaga.localizacao.estado}
                                </div>
                            </div>
                            <div class="vaga-empresa">
                                <img src="${empresa?.avatarUrl || empresa?.foto || 'imagens/default-user.png'}" 
                                     alt="${empresa?.nome || 'Empresa'}" class="avatar-pequeno">
                                <span><strong>${empresa?.nome || 'Empresa'}</strong></span>
                            </div>
                            <button class="btn-candidatar-vaga" data-vaga-id="${vaga._id}">
                                <i class="fas fa-hand-paper"></i> Candidatar-se
                            </button>
                        </div>
                    `;
                }).join('');

                // Adicionar listeners para candidatar-se
                document.querySelectorAll('.btn-candidatar-vaga').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const vagaId = btn.dataset.vagaId;
                        
                        if (!confirm('Tem certeza que deseja se candidatar a esta vaga?')) return;

                        try {
                            const response = await fetch(`/api/vagas-relampago/${vagaId}/candidatar`, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${token}`
                                }
                            });

                            const data = await response.json();
                            
                            if (data.success) {
                                alert('Candidatura enviada com sucesso! A empresa será notificada.');
                                btn.disabled = true;
                                btn.textContent = 'Candidatura Enviada';
                            } else {
                                alert(data.message || 'Erro ao enviar candidatura.');
                            }
                        } catch (error) {
                            console.error('Erro ao candidatar-se:', error);
                            alert('Erro ao enviar candidatura.');
                        }
                    });
                });
            }
        } catch (error) {
            console.error('Erro ao carregar vagas-relâmpago:', error);
            listaVagasRelampago.innerHTML = '<p>Erro ao carregar vagas-relâmpago.</p>';
        }
    }

    async function carregarMinhasVagas() {
        try {
            const response = await fetch('/api/vagas-relampago/empresa/minhas', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success && data.vagas.length > 0) {
                // Criar modal dinâmico para mostrar vagas
                const modal = document.createElement('div');
                modal.className = 'modal-overlay';
                modal.id = 'modal-minhas-vagas';
                modal.innerHTML = `
                    <div class="modal-content modal-grande">
                        <h2><i class="fas fa-list"></i> Minhas Vagas-Relâmpago</h2>
                        <div class="lista-propostas" style="max-height: 500px; overflow-y: auto;">
                            ${data.vagas.map(vaga => {
                                const candidatosPendentes = vaga.candidatos?.filter(c => c.status === 'pendente').length || 0;
                                const profissionaisAceitos = vaga.profissionaisAceitos?.length || 0;
                                const vagasRestantes = vaga.quantidade - profissionaisAceitos;
                                
                                return `
                                    <div class="vaga-relampago-card">
                                        <div class="vaga-header">
                                            <strong>${vaga.titulo}</strong>
                                            <span class="badge-status-${vaga.status}">${vaga.status === 'aberta' ? 'Aberta' : vaga.status === 'em_andamento' ? 'Em Andamento' : vaga.status === 'concluida' ? 'Concluída' : 'Cancelada'}</span>
                                        </div>
                                        <p class="vaga-descricao">${vaga.descricao}</p>
                                        <div class="vaga-info">
                                            <div class="vaga-info-item">
                                                <i class="fas fa-users"></i> 
                                                ${profissionaisAceitos}/${vaga.quantidade} profissionais aceitos
                                            </div>
                                            <div class="vaga-info-item">
                                                <i class="fas fa-user-clock"></i> 
                                                ${candidatosPendentes} candidatos pendentes
                                            </div>
                                            <div class="vaga-info-item">
                                                <i class="fas fa-dollar-sign"></i> 
                                                R$ ${vaga.valorPorPessoa.toFixed(2)} por pessoa
                                            </div>
                                        </div>
                                        ${vaga.status === 'aberta' && candidatosPendentes > 0 ? `
                                            <button class="btn-ver-candidatos" data-vaga-id="${vaga._id}" data-vaga-titulo="${vaga.titulo}">
                                                <i class="fas fa-users"></i> Ver Candidatos (${candidatosPendentes})
                                            </button>
                                        ` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        <button class="btn-secondary btn-close-modal" data-modal="modal-minhas-vagas" style="margin-top: 20px;">
                            Fechar
                        </button>
                    </div>
                `;
                
                document.body.appendChild(modal);
                modal.classList.remove('hidden');

                // Adicionar listeners para ver candidatos
                document.querySelectorAll('.btn-ver-candidatos').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const vagaId = btn.dataset.vagaId;
                        const vagaTitulo = btn.dataset.vagaTitulo;
                        await carregarCandidatosVaga(vagaId, vagaTitulo);
                        modal.classList.add('hidden');
                    });
                });
            } else {
                alert('Você ainda não criou nenhuma vaga-relâmpago.');
            }
        } catch (error) {
            console.error('Erro ao carregar minhas vagas:', error);
            alert('Erro ao carregar suas vagas.');
        }
    }

    async function carregarCandidatosVaga(vagaId, vagaTitulo) {
        const listaCandidatos = document.getElementById('lista-candidatos-vaga');
        const listaAceitos = document.getElementById('lista-aceitos-vaga');
        const tituloCandidatos = document.getElementById('vaga-titulo-candidatos');
        const infoCandidatos = document.getElementById('vaga-info-candidatos');
        
        if (!listaCandidatos || !modalCandidatosVaga) return;

        try {
            const response = await fetch(`/api/vagas-relampago/${vagaId}/candidatos`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                tituloCandidatos.textContent = vagaTitulo;
                infoCandidatos.textContent = `${data.quantidadeAceita}/${data.quantidadeNecessaria} profissionais aceitos`;

                const candidatosPendentes = data.candidatos.filter(c => c.status === 'pendente');
                
                if (candidatosPendentes.length === 0) {
                    listaCandidatos.innerHTML = '<p>Nenhum candidato pendente.</p>';
                } else {
                    listaCandidatos.innerHTML = candidatosPendentes.map(candidato => {
                        const prof = candidato.profissionalId;
                        const nivel = prof.gamificacao?.nivel || 1;
                        const mediaAvaliacao = prof.mediaAvaliacao || 0;
                        const totalAvaliacoes = prof.totalAvaliacoes || 0;
                        
                        return `
                            <div class="candidato-card">
                                <div class="candidato-header">
                                    <img src="${prof.avatarUrl || prof.foto || 'imagens/default-user.png'}" 
                                         alt="${prof.nome}" class="proposta-avatar">
                                    <div class="candidato-info">
                                        <strong>${prof.nome}</strong>
                                        <div class="candidato-meta">
                                            <span>Nível ${nivel}</span>
                                            ${mediaAvaliacao > 0 ? `<span>⭐ ${mediaAvaliacao.toFixed(1)} (${totalAvaliacoes})</span>` : '<span>Sem avaliações</span>'}
                                            <span>${prof.cidade || ''} - ${prof.estado || ''}</span>
                                        </div>
                                        ${prof.atuacao ? `<small>${prof.atuacao}</small>` : ''}
                                    </div>
                                </div>
                                <div class="candidato-acoes">
                                    <button class="btn-aceitar-candidato" data-vaga-id="${vagaId}" data-candidato-id="${candidato._id}">
                                        <i class="fas fa-check"></i> Aceitar
                                    </button>
                                    <button class="btn-rejeitar-candidato" data-vaga-id="${vagaId}" data-candidato-id="${candidato._id}">
                                        <i class="fas fa-times"></i> Rejeitar
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('');

                    // Adicionar listeners para aceitar/rejeitar
                    document.querySelectorAll('.btn-aceitar-candidato').forEach(btn => {
                        btn.addEventListener('click', async () => {
                            const vagaId = btn.dataset.vagaId;
                            const candidatoId = btn.dataset.candidatoId;
                            await avaliarCandidato(vagaId, candidatoId, 'aceitar');
                        });
                    });

                    document.querySelectorAll('.btn-rejeitar-candidato').forEach(btn => {
                        btn.addEventListener('click', async () => {
                            const vagaId = btn.dataset.vagaId;
                            const candidatoId = btn.dataset.candidatoId;
                            await avaliarCandidato(vagaId, candidatoId, 'rejeitar');
                        });
                    });
                }

                // Mostrar profissionais aceitos
                if (data.profissionaisAceitos && data.profissionaisAceitos.length > 0) {
                    listaAceitos.innerHTML = data.profissionaisAceitos.map(prof => `
                        <div class="candidato-card" style="border-left-color: #28a745;">
                            <div class="candidato-header">
                                <img src="${prof.avatarUrl || prof.foto || 'imagens/default-user.png'}" 
                                     alt="${prof.nome}" class="proposta-avatar">
                                <div class="candidato-info">
                                    <strong>${prof.nome}</strong>
                                    <span class="badge-aceito"><i class="fas fa-check-circle"></i> Aceito</span>
                                </div>
                            </div>
                        </div>
                    `).join('');
                } else {
                    listaAceitos.innerHTML = '<p style="color: var(--text-secondary);">Nenhum profissional aceito ainda.</p>';
                }

                modalCandidatosVaga.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Erro ao carregar candidatos:', error);
            alert('Erro ao carregar candidatos.');
        }
    }

    async function avaliarCandidato(vagaId, candidatoId, acao) {
        try {
            const response = await fetch(`/api/vagas-relampago/${vagaId}/candidatos/${candidatoId}/avaliar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ acao })
            });

            const data = await response.json();
            
            if (data.success) {
                alert(data.message);
                // Recarregar candidatos
                const vagaTitulo = document.getElementById('vaga-titulo-candidatos').textContent;
                await carregarCandidatosVaga(vagaId, vagaTitulo);
            } else {
                alert(data.message || 'Erro ao avaliar candidato.');
            }
        } catch (error) {
            console.error('Erro ao avaliar candidato:', error);
            alert('Erro ao avaliar candidato.');
        }
    }

    // ============================================
    // SISTEMA DE PAGAMENTO SEGURO (ESCROW)
    // ============================================
    
    const modalPagamentoSeguro = document.getElementById('modal-pagamento-seguro');
    const formPagamentoSeguro = document.getElementById('form-pagamento-seguro');
    const modalLiberarPagamento = document.getElementById('modal-liberar-pagamento');
    const modalMeusPagamentos = document.getElementById('modal-meus-pagamentos');
    const modalPagamentosGarantidos = document.getElementById('modal-pagamentos-garantidos');

    // Função para abrir modal de pagamento seguro
    window.abrirPagamentoSeguro = function(tipoServico, servicoId, valor, titulo, descricao) {
        if (!modalPagamentoSeguro || !formPagamentoSeguro) return;

        document.getElementById('pagamento-tipo-servico').value = tipoServico;
        document.getElementById('pagamento-servico-id').value = servicoId;
        document.getElementById('pagamento-valor').value = valor;
        document.getElementById('pagamento-valor-input').value = valor.toFixed(2);
        document.getElementById('servico-titulo-pagamento').textContent = titulo || 'Serviço';
        document.getElementById('servico-descricao-pagamento').textContent = descricao || '';

        // Calcula valores
        atualizarValoresPagamento(valor);

        modalPagamentoSeguro.classList.remove('hidden');
    };

    // Função para atualizar valores do pagamento
    function atualizarValoresPagamento(valor) {
        const taxa = valor * 0.05; // 5%
        const total = valor + taxa;
        const valorLiquido = valor - taxa;

        document.getElementById('pagamento-taxa').textContent = `R$ ${taxa.toFixed(2)}`;
        document.getElementById('pagamento-total').textContent = `R$ ${total.toFixed(2)}`;
        document.getElementById('pagamento-valor-liquido').textContent = `R$ ${valorLiquido.toFixed(2)}`;
    }

    // Listener para mudanças no valor (caso seja editável no futuro)
    const valorInput = document.getElementById('pagamento-valor-input');
    if (valorInput) {
        valorInput.addEventListener('input', function() {
            const valor = parseFloat(this.value) || 0;
            atualizarValoresPagamento(valor);
        });
    }

    // Submissão do formulário de pagamento
    if (formPagamentoSeguro) {
        formPagamentoSeguro.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const tipoServico = document.getElementById('pagamento-tipo-servico').value;
            const servicoId = document.getElementById('pagamento-servico-id').value;
            const valor = parseFloat(document.getElementById('pagamento-valor').value);
            const metodoPagamento = document.getElementById('pagamento-metodo').value;

            const body = {
                tipoServico,
                valor,
                metodoPagamento
            };

            // Adiciona ID específico baseado no tipo
            if (tipoServico === 'agendamento') {
                body.agendamentoId = servicoId;
            } else if (tipoServico === 'pedido_urgente') {
                body.pedidoUrgenteId = servicoId;
            }

            try {
                const response = await fetch('/api/pagamento-seguro', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(body)
                });

                const data = await response.json();
                
                if (data.success) {
                    alert('Pagamento seguro criado! O profissional foi notificado que o pagamento está garantido.');
                    modalPagamentoSeguro.classList.add('hidden');
                    formPagamentoSeguro.reset();
                    
                    // Recarrega dados se necessário
                    if (window.carregarPedidosUrgentes) {
                        await window.carregarPedidosUrgentes();
                    }
                } else {
                    alert(data.message || 'Erro ao processar pagamento.');
                }
            } catch (error) {
                console.error('Erro ao processar pagamento:', error);
                alert('Erro ao processar pagamento.');
            }
        });
    }

    // Função para liberar pagamento
    window.liberarPagamento = async function(pagamentoId) {
        if (!confirm('Tem certeza que deseja liberar o pagamento? O serviço foi concluído com sucesso?')) {
            return;
        }

        try {
            const response = await fetch(`/api/pagamento-seguro/${pagamentoId}/liberar`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                alert(data.message || 'Pagamento liberado com sucesso!');
                modalLiberarPagamento.classList.add('hidden');
                
                // Recarrega pagamentos
                if (userType === 'cliente') {
                    await carregarPagamentosCliente();
                } else if (userType === 'trabalhador') {
                    await carregarPagamentosProfissional();
                }
            } else {
                alert(data.message || 'Erro ao liberar pagamento.');
            }
        } catch (error) {
            console.error('Erro ao liberar pagamento:', error);
            alert('Erro ao liberar pagamento.');
        }
    };

    // Função para abrir modal de liberar pagamento
    window.abrirModalLiberarPagamento = function(pagamento) {
        if (!modalLiberarPagamento) return;

        document.getElementById('liberar-valor-servico').textContent = `R$ ${pagamento.valor.toFixed(2)}`;
        document.getElementById('liberar-taxa').textContent = `R$ ${pagamento.taxaPlataforma.toFixed(2)}`;
        const valorLiquido = pagamento.valorLiquido || (pagamento.valor - pagamento.taxaPlataforma);
        document.getElementById('liberar-valor-liquido').textContent = `R$ ${valorLiquido.toFixed(2)}`;

        const btnConfirmar = document.getElementById('btn-confirmar-liberar');
        if (btnConfirmar) {
            btnConfirmar.onclick = () => window.liberarPagamento(pagamento._id);
        }

        modalLiberarPagamento.classList.remove('hidden');
    };

    // Carregar pagamentos do cliente
    async function carregarPagamentosCliente() {
        const listaPagamentos = document.getElementById('lista-pagamentos-cliente');
        if (!listaPagamentos) return;

        try {
            const response = await fetch('/api/pagamento-seguro/cliente', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                if (data.pagamentos.length === 0) {
                    listaPagamentos.innerHTML = '<p>Você ainda não tem pagamentos seguros.</p>';
                    return;
                }

                listaPagamentos.innerHTML = data.pagamentos.map(pagamento => {
                    const profissional = pagamento.profissionalId;
                    const valorLiquido = pagamento.valorLiquido || (pagamento.valor - pagamento.taxaPlataforma);
                    const statusBadge = {
                        'pendente': '<span style="background: #ffc107; color: #333; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Pendente</span>',
                        'pago': '<span style="background: #007bff; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Pagamento Garantido</span>',
                        'liberado': '<span style="background: #28a745; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Liberado</span>',
                        'reembolsado': '<span style="background: #6c757d; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Reembolsado</span>',
                        'cancelado': '<span style="background: #dc3545; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Cancelado</span>'
                    }[pagamento.status] || '';

                    return `
                        <div class="pagamento-card" data-pagamento-id="${pagamento._id}">
                            <div class="pagamento-header">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <img src="${profissional?.avatarUrl || profissional?.foto || 'imagens/default-user.png'}" 
                                         alt="${profissional?.nome || 'Profissional'}" class="avatar-pequeno">
                                    <div>
                                        <strong>${profissional?.nome || 'Profissional'}</strong>
                                        ${profissional?.atuacao ? `<small style="color: var(--text-secondary);">${profissional.atuacao}</small>` : ''}
                                    </div>
                                </div>
                                ${statusBadge}
                            </div>
                            <div class="pagamento-info">
                                <div style="display: flex; justify-content: space-between; margin: 15px 0;">
                                    <span>Valor do Serviço:</span>
                                    <strong>R$ ${pagamento.valor.toFixed(2)}</strong>
                                </div>
                                <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                                    <span>Profissional receberá:</span>
                                    <strong style="color: #28a745;">R$ ${valorLiquido.toFixed(2)}</strong>
                                </div>
                                ${pagamento.temGarantiaHelpy ? '<p style="color: #007bff; font-size: 14px;"><i class="fas fa-shield-alt"></i> Garantia Helpy ativa - XP em dobro!</p>' : ''}
                            </div>
                            ${pagamento.status === 'pago' ? `
                                <div style="display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap;">
                                    <button class="btn-liberar-pagamento" data-pagamento='${JSON.stringify(pagamento)}' style="background: #28a745; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; flex: 1;">
                                        <i class="fas fa-check"></i> Liberar Pagamento
                                    </button>
                                    <button class="btn-reembolsar-pagamento" data-pagamento-id="${pagamento._id}" style="background: #dc3545; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; flex: 1;">
                                        <i class="fas fa-undo"></i> Solicitar Reembolso
                                    </button>
                                    <button class="btn-abrir-disputa" onclick="window.abrirCriarDisputa('${pagamento._id}')" style="background: #ffc107; color: #333; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; flex: 1; margin-top: 5px;">
                                        <i class="fas fa-gavel"></i> Abrir Disputa
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('');

                // Adicionar listeners para botões de ação
                document.querySelectorAll('.btn-liberar-pagamento').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const pagamentoData = JSON.parse(this.getAttribute('data-pagamento'));
                        window.abrirModalLiberarPagamento(pagamentoData);
                    });
                });

                document.querySelectorAll('.btn-reembolsar-pagamento').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const pagamentoId = this.getAttribute('data-pagamento-id');
                        window.solicitarReembolso(pagamentoId);
                    });
                });
            }
        } catch (error) {
            console.error('Erro ao carregar pagamentos:', error);
            listaPagamentos.innerHTML = '<p>Erro ao carregar pagamentos.</p>';
        }
    }

    // Carregar pagamentos do profissional
    async function carregarPagamentosProfissional() {
        const listaPagamentos = document.getElementById('lista-pagamentos-profissional');
        const totalRecebido = document.getElementById('total-recebido');
        const totalAReceber = document.getElementById('total-a-receber');
        const totalServicos = document.getElementById('total-servicos');
        
        if (!listaPagamentos) return;

        try {
            const response = await fetch('/api/pagamento-seguro/profissional', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                // Atualiza resumo
                if (totalRecebido) totalRecebido.textContent = `R$ ${data.resumo.totalRecebido}`;
                if (totalAReceber) totalAReceber.textContent = `R$ ${data.resumo.totalAReceber}`;
                if (totalServicos) totalServicos.textContent = data.resumo.totalPagamentos;

                if (data.pagamentos.length === 0) {
                    listaPagamentos.innerHTML = '<p>Você ainda não tem pagamentos garantidos.</p>';
                    return;
                }

                listaPagamentos.innerHTML = data.pagamentos.map(pagamento => {
                    const cliente = pagamento.clienteId;
                    const valorLiquido = pagamento.valorLiquido || (pagamento.valor - pagamento.taxaPlataforma);
                    const statusBadge = {
                        'pendente': '<span style="background: #ffc107; color: #333; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Aguardando Pagamento</span>',
                        'pago': '<span style="background: #007bff; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">💰 Pagamento Garantido</span>',
                        'liberado': '<span style="background: #28a745; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">✅ Liberado</span>',
                        'reembolsado': '<span style="background: #6c757d; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Reembolsado</span>',
                        'cancelado': '<span style="background: #dc3545; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Cancelado</span>'
                    }[pagamento.status] || '';

                    return `
                        <div class="pagamento-card" style="border-left: 4px solid ${pagamento.status === 'pago' ? '#007bff' : pagamento.status === 'liberado' ? '#28a745' : '#ffc107'};">
                            <div class="pagamento-header">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <img src="${cliente?.avatarUrl || cliente?.foto || 'imagens/default-user.png'}" 
                                         alt="${cliente?.nome || 'Cliente'}" class="avatar-pequeno">
                                    <div>
                                        <strong>${cliente?.nome || 'Cliente'}</strong>
                                        <small style="color: var(--text-secondary);">${pagamento.tipoServico === 'agendamento' ? 'Agendamento' : 'Pedido Urgente'}</small>
                                    </div>
                                </div>
                                ${statusBadge}
                            </div>
                            <div class="pagamento-info">
                                <div style="display: flex; justify-content: space-between; margin: 15px 0;">
                                    <span>Valor do Serviço:</span>
                                    <strong>R$ ${pagamento.valor.toFixed(2)}</strong>
                                </div>
                                <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                                    <span>Você receberá:</span>
                                    <strong style="color: #28a745; font-size: 18px;">R$ ${valorLiquido.toFixed(2)}</strong>
                                </div>
                                ${pagamento.temGarantiaHelpy ? '<p style="color: #007bff; font-size: 14px;"><i class="fas fa-shield-alt"></i> Garantia Helpy - Você receberá XP em dobro!</p>' : ''}
                                ${pagamento.status === 'pago' ? '<p style="color: #28a745; font-weight: bold; margin-top: 10px;"><i class="fas fa-check-circle"></i> Pagamento garantido! Pode realizar o serviço com segurança.</p>' : ''}
                            </div>
                        </div>
                    `;
                }).join('');
            }
        } catch (error) {
            console.error('Erro ao carregar pagamentos:', error);
            listaPagamentos.innerHTML = '<p>Erro ao carregar pagamentos.</p>';
        }
    }

    // Função para solicitar reembolso
    window.solicitarReembolso = async function(pagamentoId) {
        const motivo = prompt('Informe o motivo do reembolso:');
        if (!motivo) return;

        if (!confirm('Tem certeza que deseja solicitar reembolso? O valor será devolvido em até 5 dias úteis.')) {
            return;
        }

        try {
            const response = await fetch(`/api/pagamento-seguro/${pagamentoId}/reembolsar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ motivo })
            });

            const data = await response.json();
            
            if (data.success) {
                alert(data.message || 'Reembolso processado com sucesso!');
                await carregarPagamentosCliente();
            } else {
                alert(data.message || 'Erro ao processar reembolso.');
            }
        } catch (error) {
            console.error('Erro ao solicitar reembolso:', error);
            alert('Erro ao solicitar reembolso.');
        }
    };

    // Adicionar botões na lateral para clientes e profissionais
    if (userType === 'cliente') {
        const acoesRapidas = document.querySelector('.filtro-acoes-rapidas');
        if (acoesRapidas && !document.getElementById('btn-meus-pagamentos')) {
            const btnNovo = document.createElement('button');
            btnNovo.id = 'btn-meus-pagamentos';
            btnNovo.className = 'btn-preciso-agora-lateral';
            btnNovo.innerHTML = '<i class="fas fa-wallet"></i> Meus Pagamentos';
            acoesRapidas.appendChild(btnNovo);
            
            btnNovo.addEventListener('click', async () => {
                await carregarPagamentosCliente();
                modalMeusPagamentos?.classList.remove('hidden');
            });
        }
    }

    if (userType === 'trabalhador') {
        const acoesRapidas = document.querySelector('.filtro-acoes-rapidas');
        if (acoesRapidas && !document.getElementById('btn-pagamentos-garantidos')) {
            const btnNovo = document.createElement('button');
            btnNovo.id = 'btn-pagamentos-garantidos';
            btnNovo.className = 'btn-preciso-agora-lateral';
            btnNovo.innerHTML = '<i class="fas fa-shield-alt"></i> Pagamentos Garantidos';
            acoesRapidas.appendChild(btnNovo);
            
            btnNovo.addEventListener('click', async () => {
                await carregarPagamentosProfissional();
                modalPagamentosGarantidos?.classList.remove('hidden');
            });
        }
    }

    // ============================================
    // SISTEMA DE NOTIFICAÇÕES
    // ============================================
    
    const btnNotificacoes = document.getElementById('btn-notificacoes');
    const badgeNotificacoes = document.getElementById('badge-notificacoes');
    const modalNotificacoes = document.getElementById('modal-notificacoes');
    const listaNotificacoes = document.getElementById('lista-notificacoes');
    const btnMarcarTodasLidas = document.getElementById('btn-marcar-todas-lidas');

    // Carregar notificações periodicamente
    async function carregarNotificacoes() {
        try {
            const response = await fetch('/api/notificacoes?limit=50', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                // Atualiza badge
                if (data.totalNaoLidas > 0) {
                    badgeNotificacoes.textContent = data.totalNaoLidas > 99 ? '99+' : data.totalNaoLidas;
                    badgeNotificacoes.style.display = 'flex';
                } else {
                    badgeNotificacoes.style.display = 'none';
                }

                // Se modal está aberto, atualiza lista
                if (!modalNotificacoes?.classList.contains('hidden') && listaNotificacoes) {
                    if (data.notificacoes.length === 0) {
                        listaNotificacoes.innerHTML = '<p>Nenhuma notificação.</p>';
                    } else {
                        listaNotificacoes.innerHTML = data.notificacoes.map(notif => {
                            const dataFormatada = new Date(notif.createdAt).toLocaleString('pt-BR');
                            const iconMap = {
                                'pagamento_garantido': '💰',
                                'pagamento_liberado': '✅',
                                'pagamento_reembolsado': '💸',
                                'disputa_aberta': '⚖️',
                                'disputa_resolvida': '⚖️',
                                'proposta_aceita': '🎉',
                                'servico_concluido': '✨',
                                'avaliacao_recebida': '⭐'
                            };
                            
                            return `
                                <div class="notificacao-card ${notif.lida ? '' : 'nao-lida'}" data-notif-id="${notif._id}">
                                    <div style="display: flex; gap: 15px; align-items: flex-start;">
                                        <div style="font-size: 24px;">${iconMap[notif.tipo] || '🔔'}</div>
                                        <div style="flex: 1;">
                                            <strong>${notif.titulo}</strong>
                                            <p style="margin: 5px 0; color: var(--text-secondary);">${notif.mensagem}</p>
                                            <small style="color: var(--text-secondary);">${dataFormatada}</small>
                                        </div>
                                        ${!notif.lida ? '<span style="background: #007bff; width: 8px; height: 8px; border-radius: 50%; display: inline-block;"></span>' : ''}
                                    </div>
                                </div>
                            `;
                        }).join('');

                        // Adiciona listeners para marcar como lida ao clicar
                        document.querySelectorAll('.notificacao-card').forEach(card => {
                            card.addEventListener('click', async () => {
                                const notifId = card.dataset.notifId;
                                await marcarNotificacaoLida(notifId);
                            });
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Erro ao carregar notificações:', error);
        }
    }

    async function marcarNotificacaoLida(notifId) {
        try {
            await fetch(`/api/notificacoes/${notifId}/lida`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            await carregarNotificacoes();
        } catch (error) {
            console.error('Erro ao marcar notificação como lida:', error);
        }
    }

    if (btnNotificacoes) {
        btnNotificacoes.addEventListener('click', async () => {
            await carregarNotificacoes();
            modalNotificacoes?.classList.remove('hidden');
        });
    }

    if (btnMarcarTodasLidas) {
        btnMarcarTodasLidas.addEventListener('click', async () => {
            try {
                await fetch('/api/notificacoes/marcar-todas-lidas', {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                await carregarNotificacoes();
            } catch (error) {
                console.error('Erro ao marcar todas como lidas:', error);
            }
        });
    }

    // Carrega notificações a cada 30 segundos
    setInterval(carregarNotificacoes, 30000);
    carregarNotificacoes(); // Carrega imediatamente

    // ============================================
    // SISTEMA DE DISPUTAS
    // ============================================
    
    const modalCriarDisputa = document.getElementById('modal-criar-disputa');
    const formCriarDisputa = document.getElementById('form-criar-disputa');
    const modalMinhasDisputas = document.getElementById('modal-minhas-disputas');

    // Função para abrir modal de criar disputa
    window.abrirCriarDisputa = function(pagamentoId) {
        if (!modalCriarDisputa) return;
        document.getElementById('disputa-pagamento-id').value = pagamentoId;
        modalCriarDisputa.classList.remove('hidden');
    };

    if (formCriarDisputa) {
        formCriarDisputa.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const pagamentoId = document.getElementById('disputa-pagamento-id').value;
            const tipo = document.getElementById('disputa-tipo').value;
            const motivo = document.getElementById('disputa-motivo').value;
            const evidencias = [
                document.getElementById('disputa-evidencia-1').value,
                document.getElementById('disputa-evidencia-2').value,
                document.getElementById('disputa-evidencia-3').value
            ].filter(e => e.trim() !== '');

            try {
                const response = await fetch('/api/disputas', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        pagamentoId,
                        tipo,
                        motivo,
                        evidencias
                    })
                });

                const data = await response.json();
                
                if (data.success) {
                    alert('Disputa criada com sucesso! Nossa equipe analisará o caso em até 48 horas.');
                    formCriarDisputa.reset();
                    modalCriarDisputa.classList.add('hidden');
                    await carregarDisputas();
                } else {
                    alert(data.message || 'Erro ao criar disputa.');
                }
            } catch (error) {
                console.error('Erro ao criar disputa:', error);
                alert('Erro ao criar disputa.');
            }
        });
    }

    async function carregarDisputas() {
        const listaDisputas = document.getElementById('lista-disputas');
        if (!listaDisputas) return;

        try {
            const response = await fetch('/api/disputas', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                if (data.disputas.length === 0) {
                    listaDisputas.innerHTML = '<p>Você não tem disputas.</p>';
                    return;
                }

                listaDisputas.innerHTML = data.disputas.map(disputa => {
                    const pagamento = disputa.pagamentoId;
                    const statusBadge = {
                        'aberta': '<span style="background: #ffc107; color: #333; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Aberta</span>',
                        'em_analise': '<span style="background: #007bff; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Em Análise</span>',
                        'resolvida_cliente': '<span style="background: #28a745; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Resolvida (Favorável ao Cliente)</span>',
                        'resolvida_profissional': '<span style="background: #28a745; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Resolvida (Favorável ao Profissional)</span>',
                        'cancelada': '<span style="background: #6c757d; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Cancelada</span>'
                    }[disputa.status] || '';

                    return `
                        <div class="disputa-card">
                            <div class="disputa-header">
                                <div>
                                    <strong>Disputa #${disputa._id.toString().substring(0, 8)}</strong>
                                    <p style="margin: 5px 0; color: var(--text-secondary);">Pagamento: R$ ${pagamento?.valor?.toFixed(2) || '0.00'}</p>
                                </div>
                                ${statusBadge}
                            </div>
                            <div class="disputa-info">
                                <p><strong>Tipo:</strong> ${disputa.tipo.replace(/_/g, ' ')}</p>
                                <p><strong>Motivo:</strong> ${disputa.motivo}</p>
                                ${disputa.resolucao ? `<p><strong>Resolução:</strong> ${disputa.resolucao}</p>` : ''}
                                <small style="color: var(--text-secondary);">Criada em: ${new Date(disputa.createdAt).toLocaleString('pt-BR')}</small>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        } catch (error) {
            console.error('Erro ao carregar disputas:', error);
            listaDisputas.innerHTML = '<p>Erro ao carregar disputas.</p>';
        }
    }

    // Adicionar botão para ver disputas
    if (userType === 'cliente' || userType === 'trabalhador') {
        const acoesRapidas = document.querySelector('.filtro-acoes-rapidas');
        if (acoesRapidas && !document.getElementById('btn-minhas-disputas')) {
            const btnNovo = document.createElement('button');
            btnNovo.id = 'btn-minhas-disputas';
            btnNovo.className = 'btn-preciso-agora-lateral';
            btnNovo.innerHTML = '<i class="fas fa-gavel"></i> Minhas Disputas';
            acoesRapidas.appendChild(btnNovo);
            
            btnNovo.addEventListener('click', async () => {
                await carregarDisputas();
                modalMinhasDisputas?.classList.remove('hidden');
            });
        }
    }

    // Adicionar botão "Abrir Disputa" nos cards de pagamento quando status é "pago"
    // Isso será feito dinamicamente quando os pagamentos forem renderizados

    // ============================================
    // DASHBOARD ADMINISTRATIVO
    // ============================================
    
    const modalDashboardAdmin = document.getElementById('modal-dashboard-admin');
    const adminTabBtns = document.querySelectorAll('.admin-tab-btn');
    const adminTabContents = document.querySelectorAll('.admin-tab-content');

    // Sistema de abas
    adminTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            
            // Remove active de todos
            adminTabBtns.forEach(b => b.classList.remove('active'));
            adminTabContents.forEach(c => c.classList.remove('active'));
            
            // Adiciona active no selecionado
            btn.classList.add('active');
            document.getElementById(`admin-tab-${tab}`).classList.add('active');
            
            // Carrega conteúdo da aba
            if (tab === 'pagamentos') {
                carregarAdminPagamentos();
            } else if (tab === 'disputas') {
                carregarAdminDisputas();
            } else if (tab === 'financeiro') {
                carregarAdminFinanceiro();
            }
        });
    });

    async function carregarDashboardAdmin() {
        if (!modalDashboardAdmin) return;

        try {
            const response = await fetch('/api/admin/dashboard', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                const stats = data.dashboard.estatisticas;
                
                // Preenche cards de estatísticas
                const adminEstatisticas = document.getElementById('admin-estatisticas');
                if (adminEstatisticas) {
                    adminEstatisticas.innerHTML = `
                        <div class="admin-stat-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px;">
                            <div style="font-size: 14px; opacity: 0.9;">Total de Pagamentos</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 10px;">${stats.totalPagamentos}</div>
                        </div>
                        <div class="admin-stat-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 8px;">
                            <div style="font-size: 14px; opacity: 0.9;">Pagamentos Este Mês</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 10px;">${stats.pagamentosMes}</div>
                        </div>
                        <div class="admin-stat-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 20px; border-radius: 8px;">
                            <div style="font-size: 14px; opacity: 0.9;">Receita do Mês</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 10px;">R$ ${parseFloat(stats.receitaMes).toFixed(2)}</div>
                        </div>
                        <div class="admin-stat-card" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); color: white; padding: 20px; border-radius: 8px;">
                            <div style="font-size: 14px; opacity: 0.9;">Disputas Abertas</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 10px;">${stats.disputasAbertas}</div>
                        </div>
                        <div class="admin-stat-card" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; padding: 20px; border-radius: 8px;">
                            <div style="font-size: 14px; opacity: 0.9;">Pagamentos Pendentes</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 10px;">${stats.pagamentosPendentes}</div>
                        </div>
                        <div class="admin-stat-card" style="background: linear-gradient(135deg, #30cfd0 0%, #330867 100%); color: white; padding: 20px; border-radius: 8px;">
                            <div style="font-size: 14px; opacity: 0.9;">Receita do Ano</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 10px;">R$ ${parseFloat(stats.receitaAno).toFixed(2)}</div>
                        </div>
                    `;
                }

                // Preenche lista de pagamentos
                carregarAdminPagamentos(data.dashboard.pagamentosRecentes);
                
                // Preenche lista de disputas
                carregarAdminDisputas(data.dashboard.disputasRecentes);
                
                // Preenche resumo financeiro
                carregarAdminFinanceiro(stats);
            }
        } catch (error) {
            console.error('Erro ao carregar dashboard:', error);
            if (error.message.includes('403')) {
                alert('Acesso negado. Apenas administradores podem acessar o dashboard.');
            }
        }
    }

    async function carregarAdminPagamentos(pagamentos = null) {
        const lista = document.getElementById('admin-lista-pagamentos');
        if (!lista) return;

        if (!pagamentos) {
            // Se não foram passados, busca do dashboard
            const response = await fetch('/api/admin/dashboard', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                pagamentos = data.dashboard.pagamentosRecentes;
            }
        }

        if (!pagamentos || pagamentos.length === 0) {
            lista.innerHTML = '<p>Nenhum pagamento recente.</p>';
            return;
        }

        lista.innerHTML = pagamentos.map(p => {
            const cliente = p.clienteId;
            const profissional = p.profissionalId;
            const valorLiquido = p.valorLiquido || (p.valor - p.taxaPlataforma);
            const statusBadge = {
                'pendente': '<span style="background: #ffc107; color: #333; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Pendente</span>',
                'pago': '<span style="background: #007bff; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Pago</span>',
                'liberado': '<span style="background: #28a745; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Liberado</span>',
                'reembolsado': '<span style="background: #6c757d; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Reembolsado</span>'
            }[p.status] || '';

            return `
                <div class="admin-pagamento-card">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>${cliente?.nome || 'Cliente'} → ${profissional?.nome || 'Profissional'}</strong>
                            <p style="margin: 5px 0; color: var(--text-secondary);">
                                ${p.tipoServico === 'agendamento' ? 'Agendamento' : 'Pedido Urgente'} • 
                                R$ ${p.valor.toFixed(2)} • 
                                Taxa: R$ ${p.taxaPlataforma.toFixed(2)}
                            </p>
                            <small style="color: var(--text-secondary);">${new Date(p.createdAt).toLocaleString('pt-BR')}</small>
                        </div>
                        ${statusBadge}
                    </div>
                </div>
            `;
        }).join('');
    }

    async function carregarAdminDisputas(disputas = null) {
        const lista = document.getElementById('admin-lista-disputas');
        if (!lista) return;

        if (!disputas) {
            const response = await fetch('/api/admin/dashboard', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                disputas = data.dashboard.disputasRecentes;
            }
        }

        if (!disputas || disputas.length === 0) {
            lista.innerHTML = '<p>Nenhuma disputa recente.</p>';
            return;
        }

        lista.innerHTML = disputas.map(d => {
            const pagamento = d.pagamentoId;
            const criador = d.criadorId;
            const statusBadge = {
                'aberta': '<span style="background: #ffc107; color: #333; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Aberta</span>',
                'em_analise': '<span style="background: #007bff; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Em Análise</span>',
                'resolvida_cliente': '<span style="background: #28a745; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Resolvida</span>',
                'resolvida_profissional': '<span style="background: #28a745; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Resolvida</span>'
            }[d.status] || '';

            return `
                <div class="admin-disputa-card">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex: 1;">
                            <strong>Disputa #${d._id.toString().substring(0, 8)}</strong>
                            <p style="margin: 5px 0; color: var(--text-secondary);">
                                Criada por: ${criador?.nome || 'Usuário'} • 
                                Pagamento: R$ ${pagamento?.valor?.toFixed(2) || '0.00'}
                            </p>
                            <p style="margin: 5px 0;"><strong>Tipo:</strong> ${d.tipo.replace(/_/g, ' ')}</p>
                            <p style="margin: 5px 0;"><strong>Motivo:</strong> ${d.motivo.substring(0, 100)}${d.motivo.length > 100 ? '...' : ''}</p>
                            ${d.status === 'aberta' || d.status === 'em_analise' ? `
                                <button class="btn-resolver-disputa" data-disputa-id="${d._id}" style="background: #28a745; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; margin-top: 10px;">
                                    <i class="fas fa-gavel"></i> Resolver Disputa
                                </button>
                            ` : ''}
                        </div>
                        ${statusBadge}
                    </div>
                </div>
            `;
        }).join('');

        // Adiciona listeners para resolver disputas
        document.querySelectorAll('.btn-resolver-disputa').forEach(btn => {
            btn.addEventListener('click', () => {
                const disputaId = btn.dataset.disputaId;
                abrirModalResolverDisputa(disputaId);
            });
        });
    }

    function carregarAdminFinanceiro(stats) {
        const resumo = document.getElementById('admin-resumo-financeiro');
        if (!resumo || !stats) return;

        resumo.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                <div>
                    <h4 style="margin: 0 0 10px 0; color: var(--text-secondary);">Receita Total do Mês</h4>
                    <p style="font-size: 28px; font-weight: bold; color: #28a745; margin: 0;">R$ ${parseFloat(stats.receitaMes).toFixed(2)}</p>
                </div>
                <div>
                    <h4 style="margin: 0 0 10px 0; color: var(--text-secondary);">Receita Total do Ano</h4>
                    <p style="font-size: 28px; font-weight: bold; color: #007bff; margin: 0;">R$ ${parseFloat(stats.receitaAno).toFixed(2)}</p>
                </div>
                <div>
                    <h4 style="margin: 0 0 10px 0; color: var(--text-secondary);">Pagamentos Liberados</h4>
                    <p style="font-size: 28px; font-weight: bold; color: #28a745; margin: 0;">${stats.pagamentosLiberados}</p>
                </div>
                <div>
                    <h4 style="margin: 0 0 10px 0; color: var(--text-secondary);">Taxa Média</h4>
                    <p style="font-size: 28px; font-weight: bold; color: #ffc107; margin: 0;">5%</p>
                </div>
            </div>
        `;
    }

    async function abrirModalResolverDisputa(disputaId) {
        const resolucao = prompt('Digite a resolução da disputa:');
        if (!resolucao) return;

        const favoravelA = confirm('A resolução é favorável ao CLIENTE? (OK = Cliente, Cancelar = Profissional)') ? 'cliente' : 'profissional';

        try {
            const response = await fetch(`/api/disputas/${disputaId}/resolver`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ resolucao, favoravelA })
            });

            const data = await response.json();
            
            if (data.success) {
                alert('Disputa resolvida com sucesso!');
                await carregarDashboardAdmin();
            } else {
                alert(data.message || 'Erro ao resolver disputa.');
            }
        } catch (error) {
            console.error('Erro ao resolver disputa:', error);
            alert('Erro ao resolver disputa.');
        }
    }

    // Adicionar botão de dashboard admin (apenas para admins)
    // Nota: Em produção, você deve verificar se o usuário é admin no backend
    // Por enquanto, vamos adicionar um botão que só aparece se o usuário tiver permissão
    const acoesRapidas = document.querySelector('.filtro-acoes-rapidas');
    if (acoesRapidas && !document.getElementById('btn-dashboard-admin')) {
        // Verifica se é admin (em produção, isso viria do backend)
        fetch('/api/usuario/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.json()).then(userData => {
            if (userData.isAdmin) {
                const btnAdmin = document.createElement('button');
                btnAdmin.id = 'btn-dashboard-admin';
                btnAdmin.className = 'btn-preciso-agora-lateral';
                btnAdmin.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                btnAdmin.style.color = 'white';
                btnAdmin.innerHTML = '<i class="fas fa-chart-line"></i> Dashboard Admin';
                acoesRapidas.appendChild(btnAdmin);
                
                btnAdmin.addEventListener('click', async () => {
                    await carregarDashboardAdmin();
                    modalDashboardAdmin?.classList.remove('hidden');
                });
            }
        }).catch(() => {
            // Se não conseguir verificar, não adiciona o botão
        });
    }
});

