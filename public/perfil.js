document.addEventListener('DOMContentLoaded', () => {
    // --- Identificação do Usuário ---
    const urlParams = new URLSearchParams(window.location.search);
    const loggedInUserId = localStorage.getItem('userId');
    const profileId = urlParams.get('id') || loggedInUserId; // Vê o perfil da URL ou o próprio
    
    const token = localStorage.getItem('jwtToken');
    const userType = localStorage.getItem('userType'); 

    if (!loggedInUserId || !token) {
        alert('Você precisa estar logado para acessar esta página.');
        window.location.href = 'login.html';
        return;
    }
    
    const isOwnProfile = (profileId === loggedInUserId);

    // --- Elementos do DOM (Header) ---
    const userAvatarHeader = document.getElementById('user-avatar-header');
    const userNameHeader = document.getElementById('user-name-header');
    const feedButton = document.getElementById('feed-button');
    const logoutButton = document.getElementById('logout-button');
    const profileButton = document.getElementById('profile-button'); 

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
    
    // --- Elementos do DOM (Logout Modal) ---
    const logoutConfirmModal = document.getElementById('logout-confirm-modal');
    const confirmLogoutYesBtn = document.getElementById('confirm-logout-yes');
    const confirmLogoutNoBtn = document.getElementById('confirm-logout-no');


    // --- FUNÇÃO PARA CARREGAR O HEADER ---
    function loadHeaderInfo() {
        const storedName = localStorage.getItem('userName') || 'Usuário';
        const storedPhotoUrl = localStorage.getItem('userPhotoUrl');
        if (userNameHeader) {
            userNameHeader.textContent = storedName.split(' ')[0];
        }
        if (userAvatarHeader) {
            if (storedPhotoUrl && storedPhotoUrl !== 'undefined' && !storedPhotoUrl.includes('pixabay')) {
                // Força recarregamento da imagem para garantir qualidade
                userAvatarHeader.src = '';
                userAvatarHeader.src = storedPhotoUrl;
                // Adiciona atributo para melhor qualidade
                userAvatarHeader.loading = 'eager';
            } else {
                userAvatarHeader.src = 'imagens/default-user.png';
            }
        }
    }

    // --- FUNÇÕES DE CARREGAMENTO E RENDERIZAÇÃO ---
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
            
            loadHeaderInfo();
            renderUserProfile(user);
            
            // Carregar ambas as seções
            if (user.tipo === 'trabalhador') {
                fetchServicos(user._id);
            }
            fetchPostagens(user._id);
            
            // Configurar as abas
            setupSectionSwitching();
            
        } catch (error) {
            console.error('Erro ao buscar perfil:', error); 
            if (nomePerfil) nomePerfil.textContent = "Erro ao carregar perfil.";
        }
    }

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
                             : 'imagens/default-user.png');
        
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

        if (user.tipo === 'trabalhador') {
            if (atuacaoPerfil) atuacaoPerfil.textContent = user.atuacao || 'Não informado';
            if (atuacaoItem) atuacaoItem.style.display = 'flex'; 
            if (mediaAvaliacaoContainer) mediaAvaliacaoContainer.style.display = 'block';
            if (secaoServicos) secaoServicos.style.display = 'block';
            if (mostrarServicosBtn) mostrarServicosBtn.style.display = 'inline-block';
            
            // 🆕 ATUALIZADO: Mostrar Agendador apenas para dono do perfil
            const agendadorContainer = document.getElementById('agendador-container');
            if (agendadorContainer && userType === 'trabalhador' && isOwnProfile) {
                agendadorContainer.style.display = 'flex';
            } else if (agendadorContainer) {
                agendadorContainer.style.display = 'none';
            }
            
            // 🆕 NOVO: Mostrar botão "Ver Agenda" para visitantes (sem configurar)
            if (!isOwnProfile && userType === 'trabalhador') {
                const btnVerAgendaVisitante = document.createElement('button');
                btnVerAgendaVisitante.id = 'btn-ver-agenda-visitante';
                btnVerAgendaVisitante.className = 'btn-ver-agenda';
                btnVerAgendaVisitante.innerHTML = '<i class="fas fa-calendar-alt"></i> Ver Agenda';
                btnVerAgendaVisitante.style.marginTop = '15px';
                
                const disponibilidadeContainer = document.getElementById('disponibilidade-container');
                if (disponibilidadeContainer && !document.getElementById('btn-ver-agenda-visitante')) {
                    disponibilidadeContainer.parentNode.insertBefore(btnVerAgendaVisitante, disponibilidadeContainer.nextSibling);
                    
                    btnVerAgendaVisitante.addEventListener('click', async () => {
                        const modalAgenda = document.getElementById('modal-agenda-visitante') || criarModalAgendaVisitante(userId);
                        modalAgenda.classList.remove('hidden');
                        await carregarAgendamentosVisitante(userId);
                    });
                }
            }
            
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
            if (!isOwnProfile && userType === 'cliente' && secaoAvaliacao) {
                secaoAvaliacao.style.display = 'block';
            }
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
            const imageUrl = servico.images && servico.images.length > 0 ? servico.images[0] : 'https://via.placeholder.com/200?text=Projeto';
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
    async function fetchPostagens(id) { if (!minhasPostagensContainer) return; try { const response = await fetch(`/api/user-posts/${id}`, { headers: { 'Authorization': `Bearer ${token}` } }); if (!response.ok) throw new Error('Falha ao buscar postagens.'); const posts = await response.json(); renderPostagens(posts); } catch (error) { console.error('Erro ao buscar postagens:', error); minhasPostagensContainer.innerHTML = '<p class="mensagem-vazia">Erro ao carregar postagens.</p>'; } }
    function renderPostagens(posts) { if (!minhasPostagensContainer) return; minhasPostagensContainer.innerHTML = ''; if (!posts || posts.length === 0) { minhasPostagensContainer.innerHTML = '<p class="mensagem-vazia">Nenhuma postagem encontrada.</p>'; return; } posts.forEach(post => { if (!post.userId) return; const postElement = document.createElement('article'); postElement.className = 'post'; postElement.dataset.postId = post._id; const postAuthorPhoto = (post.userId.foto && !post.userId.foto.includes('pixabay')) ? post.userId.foto : (post.userId.avatarUrl && !post.userId.avatarUrl.includes('pixabay') ? post.userId.avatarUrl : 'imagens/default-user.png'); const postAuthorName = post.userId.nome || 'Usuário Anônimo'; const postDate = new Date(post.createdAt).toLocaleString('pt-BR'); let mediaHTML = ''; if (post.mediaUrl) { if (post.mediaType === 'video') { mediaHTML = `<video src="${post.mediaUrl}" class="post-video" controls></video>`; } else if (post.mediaType === 'image') { mediaHTML = `<img src="${post.mediaUrl}" alt="Imagem da postagem" class="post-image">`; } } let deleteButton = ''; if (isOwnProfile) { deleteButton = `<button class="delete-post-btn" data-id="${post._id}"><i class="fas fa-trash"></i></button>`; } postElement.innerHTML = ` <div class="post-header"> <img src="${postAuthorPhoto}" alt="Avatar" class="post-avatar" data-userid="${post.userId._id}"> <div class="post-meta"> <span class="user-name" data-userid="${post.userId._id}">${postAuthorName}</span> <div> <span class="post-date-display">${postDate}</span> </div> </div> ${deleteButton} </div> <div class="post-content"> <p>${post.content}</p> ${mediaHTML} </div> `; minhasPostagensContainer.appendChild(postElement); }); }
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
    // LÓGICA DE UPLOAD RÁPIDO DE FOTO
    // ----------------------------------------------------------------------
    async function handleImmediatePhotoSave(file) {
        if (!file || !isOwnProfile) return;
        const formData = new FormData();
        formData.append('avatar', file);
        
        if(labelInputFotoPerfil) labelInputFotoPerfil.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

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
            // Atualiza o cabeçalho imediatamente com a nova foto
            loadHeaderInfo();
            fetchUserProfile(); 
            
        } catch (error) {
            console.error('Erro ao salvar foto:', error);
            alert('Erro ao salvar foto: ' + error.message);
        } finally {
            if(labelInputFotoPerfil) labelInputFotoPerfil.innerHTML = '<i class="fas fa-camera"></i> Alterar Foto';
        }
    }
    
    if (inputFotoPerfil) {
        inputFotoPerfil.addEventListener('change', () => {
            handleImmediatePhotoSave(inputFotoPerfil.files[0]);
        });
    }

    // ----------------------------------------------------------------------
    // LÓGICA DE AVALIAÇÃO, SERVIÇOS, MODAIS, LOGOUT, ETC.
    // ----------------------------------------------------------------------
    if (estrelasAvaliacao.length > 0) { estrelasAvaliacao.forEach(star => { star.addEventListener('click', () => { const value = star.dataset.value; if (formAvaliacao) formAvaliacao.dataset.value = value; estrelasAvaliacao.forEach(s => { const sValue = s.dataset.value; if (sValue <= value) s.innerHTML = '<i class="fas fa-star"></i>'; else s.innerHTML = '<i class="far fa-star"></i>'; }); if (notaSelecionada) notaSelecionada.textContent = `Você selecionou ${value} estrela(s).`; }); }); }
    if (btnEnviarAvaliacao) { btnEnviarAvaliacao.addEventListener('click', async (e) => { e.preventDefault(); const estrelas = formAvaliacao.dataset.value; const comentario = comentarioAvaliacaoInput.value; if (!estrelas || estrelas == 0) { alert('Por favor, selecione pelo menos uma estrela.'); return; } try { const response = await fetch('/api/avaliar-trabalhador', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ trabalhadorId: profileId, estrelas: parseInt(estrelas, 10), comentario: comentario }) }); const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Erro ao enviar avaliação.'); alert('Avaliação enviada com sucesso!'); formAvaliacao.reset(); estrelasAvaliacao.forEach(s => s.innerHTML = '<i class="far fa-star"></i>'); if (notaSelecionada) notaSelecionada.textContent = ''; fetchUserProfile(); } catch (error) { console.error('Erro ao enviar avaliação:', error); alert(error.message); } }); }
    // 🆕 ATUALIZADO: Usa modal para adicionar projeto
    const modalAdicionarProjeto = document.getElementById('modal-adicionar-projeto');
    const formAdicionarProjeto = document.getElementById('form-adicionar-projeto');
    const projetoDesafioHelpy = document.getElementById('projeto-desafio-helpy');
    const tagDesafioGroup = document.getElementById('tag-desafio-group');
    
    if (projetoDesafioHelpy && tagDesafioGroup) {
        projetoDesafioHelpy.addEventListener('change', () => {
            tagDesafioGroup.style.display = projetoDesafioHelpy.checked ? 'block' : 'none';
        });
    }
    
    if (addServicoBtn) {
        addServicoBtn.addEventListener('click', () => {
            modalAdicionarProjeto?.classList.remove('hidden');
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
            formData.append('isDesafioHelpy', projetoDesafioHelpy?.checked || false);
            formData.append('tagDesafio', document.getElementById('projeto-tag-desafio').value || '');
            
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
    if (feedButton) { feedButton.addEventListener('click', (e) => { e.preventDefault(); window.location.href = 'index.html'; }); }
    if (profileButton) { profileButton.addEventListener('click', (e) => { e.preventDefault(); window.location.href = `perfil.html?id=${loggedInUserId}`; }); }
    if (logoutButton) { logoutButton.addEventListener('click', (e) => { e.preventDefault(); logoutConfirmModal && logoutConfirmModal.classList.remove('hidden'); }); }
    if (confirmLogoutYesBtn) { confirmLogoutYesBtn.addEventListener('click', () => { localStorage.clear(); window.location.href = 'login.html'; }); }
    if (confirmLogoutNoBtn) { confirmLogoutNoBtn.addEventListener('click', () => { logoutConfirmModal && logoutConfirmModal.classList.add('hidden'); }); }
    
    // --- INICIALIZAÇÃO DA PÁGINA ---
    loadHeaderInfo(); 
    fetchUserProfile(); 
    setupSectionSwitching();
    
    // 🆕 NOVO: Agendador Helpy
    const btnVerAgenda = document.getElementById('btn-ver-agenda');
    const btnConfigurarHorarios = document.getElementById('btn-configurar-horarios');
    const modalAgenda = document.getElementById('modal-agenda');
    const modalConfigurarHorarios = document.getElementById('modal-configurar-horarios');
    const formHorarios = document.getElementById('form-horarios');
    const horariosContainer = document.getElementById('horarios-container');
    const btnAdicionarHorario = document.getElementById('btn-adicionar-horario');
    
    if (btnVerAgenda) {
        btnVerAgenda.addEventListener('click', async () => {
            if (modalAgenda) {
                modalAgenda.classList.remove('hidden');
                await carregarAgendamentos();
            }
        });
    }
    
    if (btnConfigurarHorarios) {
        btnConfigurarHorarios.addEventListener('click', async () => {
            // 🆕 ATUALIZADO: Só permite configurar se for o próprio perfil
            if (modalConfigurarHorarios && isOwnProfile) {
                modalConfigurarHorarios.classList.remove('hidden');
                await carregarHorariosExistentes();
            }
        });
    }
    
    // 🆕 NOVO: Fechar modais ao clicar no X ou fora
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = btn.dataset.modal;
            if (modalId) {
                const modal = document.getElementById(modalId);
                if (modal) modal.classList.add('hidden');
            }
        });
    });
    
    // Fecha modais ao clicar fora
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    });
    
    if (btnAdicionarHorario) {
        btnAdicionarHorario.addEventListener('click', () => {
            adicionarCampoHorario();
        });
    }
    
    if (formHorarios) {
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

