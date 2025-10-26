document.addEventListener('DOMContentLoaded', () => {
    // Pega o ID da URL (ex: perfil.html?id=123)
    const urlParams = new URLSearchParams(window.location.search);
    // Pega o ID do usuário logado
    const loggedInUserId = localStorage.getItem('userId');
    // Decide qual perfil mostrar: o da URL ou o do usuário logado
    const profileId = urlParams.get('id') || loggedInUserId;
    
    const token = localStorage.getItem('jwtToken');
    const userType = localStorage.getItem('userType'); // Tipo do *usuário logado*

    // Checagem de segurança
    if (!loggedInUserId || !token) {
        alert('Você precisa estar logado para acessar esta página.');
        window.location.href = 'login.html';
        return;
    }
    
    // Verifica se o usuário está vendo o próprio perfil
    const isOwnProfile = (profileId === loggedInUserId);

    // --- Elementos do DOM ---
    
    // Card Principal
    const fotoPerfil = document.getElementById('fotoPerfil');
    const nomePerfil = document.getElementById('nomePerfil');
    const mediaAvaliacaoContainer = document.getElementById('media-avaliacao-container');
    const mediaEstrelas = document.getElementById('mediaEstrelas');
    const totalAvaliacoes = document.getElementById('totalAvaliacoes');
    
    // Infos (Spans e Links)
    const emailPerfil = document.getElementById('emailPerfil'); 
    const telefonePerfil = document.getElementById('telefonePerfil');
    const idadePerfil = document.getElementById('idadePerfil');
    const cidadePerfil = document.getElementById('cidadePerfil');
    const atuacaoPerfil = document.getElementById('atuacaoPerfil');
    const atuacaoItem = document.getElementById('atuacao-item'); // O <li> que contém a atuação
    const descricaoPerfil = document.getElementById('descricaoPerfil');

    // Inputs de Edição (Ocultos)
    const labelInputFotoPerfil = document.getElementById('labelInputFotoPerfil');
    const inputFotoPerfil = document.getElementById('inputFotoPerfil');
    const inputNome = document.getElementById('inputNome');
    const inputEmail = document.getElementById('inputEmail');
    const inputIdade = document.getElementById('inputIdade');
    const inputCidade = document.getElementById('inputCidade');
    const inputWhatsapp = document.getElementById('inputWhatsapp');
    const inputAtuacao = document.getElementById('inputAtuacao');
    const inputDescricao = document.getElementById('inputDescricao');

    // Botões de Ação
    const btnEditarPerfil = document.getElementById('editarPerfilBtn'); 
    const botoesEdicao = document.querySelector('.botoes-edicao');
    const btnSalvarPerfil = document.getElementById('btnSalvarPerfil');
    const btnCancelarEdicao = document.getElementById('btnCancelarEdicao');

    // Seções (Serviços / Postagens)
    const secaoServicos = document.getElementById('secao-servicos');
    const secaoPostagens = document.getElementById('secao-postagens');
    const mostrarServicosBtn = document.getElementById('mostrarServicosBtn');
    const mostrarPostagensBtn = document.getElementById('mostrarPostagensBtn');
    
    // Galeria de Serviços
    const galeriaServicos = document.getElementById('galeriaServicos');
    const addServicoBtn = document.getElementById('addServicoBtn');
    const inputFotoServico = document.getElementById('inputFotoServico'); 
    
    // Postagens
    const minhasPostagensContainer = document.getElementById('minhasPostagens');

    // Header
    const userAvatarHeader = document.getElementById('user-avatar-header');
    const userNameHeader = document.getElementById('user-name-header');
    
    // Modais
    const imageModal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const closeImageModalBtn = document.getElementById('close-image-modal');
    
    // Avaliação
    const secaoAvaliacao = document.getElementById('secao-avaliacao');
    const formAvaliacao = document.getElementById('formAvaliacao');
    const estrelasAvaliacao = document.querySelectorAll('#formAvaliacao .estrelas span');
    const notaSelecionada = document.getElementById('notaSelecionada');
    const comentarioAvaliacaoInput = document.getElementById('comentarioAvaliacaoInput');
    const btnEnviarAvaliacao = document.getElementById('btnEnviarAvaliacao');

    // Botões do novo header
    const feedButton = document.getElementById('feed-button');
    const logoutButton = document.getElementById('logout-button');
    
    // Modais de Logout
    const logoutConfirmModal = document.getElementById('logout-confirm-modal');
    const confirmLogoutYesBtn = document.getElementById('confirm-logout-yes');
    const confirmLogoutNoBtn = document.getElementById('confirm-logout-no');


    // ----------------------------------------------------------------------
    // FUNÇÕES DE CARREGAMENTO E RENDERIZAÇÃO
    // ----------------------------------------------------------------------

    function loadHeaderInfo() {
        const storedName = localStorage.getItem('userName');
        const storedPhotoUrl = localStorage.getItem('userPhotoUrl');
        
        if (storedName && userNameHeader) {
            userNameHeader.textContent = storedName.split(' ')[0];
        }
        
        if (userAvatarHeader) {
            if (storedPhotoUrl && storedPhotoUrl !== 'undefined' && !storedPhotoUrl.includes('pixabay')) {
                userAvatarHeader.src = storedPhotoUrl;
            } else {
                userAvatarHeader.src = 'imagens/default-user.png';
            }
        }
    }

    async function fetchUserProfile() {
        if (!profileId) {
            console.error("Nenhum ID de perfil para buscar.");
            return;
        }
        
        try {
            const response = await fetch(`/api/usuario/${profileId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Falha ao buscar dados do perfil.');
            }

            const user = await response.json(); 
            renderUserProfile(user);
            
            // Busca postagens para TODOS os tipos de usuário
            fetchPostagens(user._id);

            if (user.tipo === 'trabalhador') {
                fetchServicos(user._id);
            }

        } catch (error) {
            console.error('Erro ao buscar perfil:', error); 
            alert('Erro ao carregar os dados do perfil.');
        }
    }

    function renderUserProfile(user) {
        if (!user) return;
        
        const fotoFinal = (user.avatarUrl && !user.avatarUrl.includes('pixabay')) 
                          ? user.avatarUrl 
                          : (user.foto && !user.foto.includes('pixabay') 
                             ? user.foto 
                             : 'imagens/default-user.png');
        
        if (fotoPerfil) fotoPerfil.src = fotoFinal;
        if (nomePerfil) nomePerfil.textContent = user.nome || 'Nome não informado';
        
        if (idadePerfil) idadePerfil.textContent = user.idade ? `${user.idade} anos` : 'Não informado';
        if (cidadePerfil) cidadePerfil.textContent = user.cidade || 'Não informado';
        if (descricaoPerfil) descricaoPerfil.textContent = user.descricao || 'Nenhuma descrição disponível.';
        
        if (emailPerfil) {
            emailPerfil.textContent = user.email || 'Não informado';
            emailPerfil.href = `mailto:${user.email}`;
        }
        
        if (telefonePerfil) { 
            if (user.telefone) {
                telefonePerfil.href = `https://wa.me/55${user.telefone.replace(/\D/g, '')}`;
                telefonePerfil.innerHTML = `<i class="fab fa-whatsapp"></i> ${user.telefone}`;
                telefonePerfil.target = '_blank';
            } else {
                telefonePerfil.innerHTML = `<i class="fas fa-phone"></i> Não informado`;
                telefonePerfil.href = '#';
                telefonePerfil.target = '';
            }
        }

        if (user.tipo === 'trabalhador') {
            if (atuacaoPerfil) atuacaoPerfil.textContent = user.atuacao || 'Não informado';
            if (atuacaoItem) atuacaoItem.style.display = 'flex'; 
            if (mediaAvaliacaoContainer) mediaAvaliacaoContainer.style.display = 'block';
            if (secaoServicos) secaoServicos.style.display = 'block';
            if (mostrarServicosBtn) mostrarServicosBtn.style.display = 'inline-block';
            
            if (user.totalAvaliacoes > 0) {
                renderMediaAvaliacao(user.mediaAvaliacao);
                if (totalAvaliacoes) totalAvaliacoes.textContent = `${user.totalAvaliacoes} avaliações`;
            } else {
                if (mediaEstrelas) mediaEstrelas.innerHTML = '<span class="no-rating">Nenhuma avaliação</span>';
                if (totalAvaliacoes) totalAvaliacoes.textContent = '';
            }
            
            if (isOwnProfile && addServicoBtn) {
                addServicoBtn.style.display = 'block';
            }
            if (!isOwnProfile && userType === 'cliente' && secaoAvaliacao) {
                secaoAvaliacao.style.display = 'block';
            }

        } else { // Lógica para CLIENTE
            if (atuacaoItem) atuacaoItem.style.display = 'none';
            if (mediaAvaliacaoContainer) mediaAvaliacaoContainer.style.display = 'none';
            if (secaoServicos) secaoServicos.style.display = 'none';
            if (mostrarServicosBtn) mostrarServicosBtn.style.display = 'none';
            if (mostrarPostagensBtn) mostrarPostagensBtn.click();
        }

        // 🛑 CORREÇÃO: Mostra o botão "Editar Perfil" se for o dono
        if (isOwnProfile && btnEditarPerfil) {
            btnEditarPerfil.style.display = 'block';
        } else if (btnEditarPerfil) {
            btnEditarPerfil.style.display = 'none';
        }
    }

    async function fetchServicos(id) {
        if (!galeriaServicos) return;

        try {
            const response = await fetch(`/api/servicos/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Falha ao buscar serviços.');
            
            const servicos = await response.json();
            renderServicos(servicos);
        } catch (error) {
            console.error('Erro ao buscar serviços:', error);
            galeriaServicos.innerHTML = '<p class="mensagem-vazia">Erro ao carregar serviços.</p>';
        }
    }


    function renderServicos(servicos) {
        if (!galeriaServicos) return;
        galeriaServicos.innerHTML = '';
        
        if (!servicos || servicos.length === 0) {
            galeriaServicos.innerHTML = '<p class="mensagem-vazia">Nenhum serviço cadastrado ainda.</p>';
            return;
        }

        servicos.forEach(servico => {
            const imageUrl = servico.images && servico.images.length > 0 
                             ? servico.images[0] 
                             : 'https://via.placeholder.com/200?text=Serviço';
            
            const servicoElement = document.createElement('div');
            servicoElement.className = 'servico-item-container';
            
            let deleteBtn = '';
            if (isOwnProfile) {
                deleteBtn = `<button class="btn-remover-foto" data-id="${servico._id}">&times;</button>`;
            }

            servicoElement.innerHTML = `
                <div class="servico-item" data-id="${servico._id}">
                    <img src="${imageUrl}" alt="${servico.title || 'Serviço'}" class="foto-servico">
                    ${deleteBtn}
                    <p class="servico-titulo">${servico.title || 'Serviço'}</p>
                </div>
            `;
            galeriaServicos.appendChild(servicoElement);
        });

        document.querySelectorAll('.btn-remover-foto').forEach(btn => {
            btn.addEventListener('click', handleDeleteServico);
        });
        
        document.querySelectorAll('.foto-servico').forEach(img => {
            img.addEventListener('click', handleShowServicoDetails);
        });
    }

    async function fetchPostagens(id) {
        if (!minhasPostagensContainer) return;
        
        try {
            const response = await fetch(`/api/user-posts/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Falha ao buscar postagens.');
            
            const posts = await response.json();
            renderPostagens(posts);
        } catch (error) {
            console.error('Erro ao buscar postagens:', error);
            minhasPostagensContainer.innerHTML = '<p class="mensagem-vazia">Erro ao carregar postagens.</p>';
        }
    }

    // 🛑 ATUALIZADO: renderPostagens agora inclui Likes e Comentários
    function renderPostagens(posts) {
        if (!minhasPostagensContainer) return;
        minhasPostagensContainer.innerHTML = '';

        if (!posts || posts.length === 0) {
            minhasPostagensContainer.innerHTML = '<p class="mensagem-vazia">Nenhuma postagem encontrada.</p>';
            return;
        }

        posts.forEach(post => {
            const postElement = document.createElement('article');
            postElement.className = 'post'; 
            postElement.dataset.postId = post._id;

            const postAuthorPhoto = (post.userId && post.userId.foto) ? post.userId.foto : 'imagens/default-user.png';
            const postAuthorName = (post.userId && post.userId.nome) ? post.userId.nome : 'Usuário Anônimo';
            const postAuthorCity = (post.userId && post.userId.cidade) ? post.userId.cidade : '';

            let deleteButton = '';
            if (post.userId && post.userId._id === loggedInUserId) {
                deleteButton = `<button class="delete-post-btn" data-id="${post._id}"><i class="fas fa-trash"></i></button>`;
            }

            let imageHTML = '';
            if (post.imageUrl) {
                imageHTML = `<img src="${post.imageUrl}" alt="Imagem da postagem" class="post-image">`;
            }
            
            // 🛑 NOVO: Lógica de Like/Comment (copiada do script.js do feed)
            const isLiked = post.likes.includes(loggedInUserId);
            let commentsHTML = post.comments.map(comment => {
                if (!comment.userId) return '';
                const commentPhoto = comment.userId.foto || comment.userId.avatarUrl || 'imagens/default-user.png';
                return `
                <div class="comment">
                    <img src="${commentPhoto.includes('pixabay') ? 'imagens/default-user.png' : commentPhoto}" alt="Avatar" class="comment-avatar">
                    <div class="comment-body">
                        <strong>${comment.userId.nome}</strong>
                        <p>${comment.content}</p>
                    </div>
                </div>
                `;
            }).join('');
            
            const postDate = new Date(post.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const cityDisplay = postAuthorCity ? ` &bull; ${postAuthorCity}` : '';

            
            postElement.innerHTML = `
                <div class="post-header">
                    <img src="${postAuthorPhoto}" alt="Avatar" class="post-avatar" data-userid="${post.userId._id}">
                    <div class="post-meta">
                        <span class="user-name" data-userid="${post.userId._id}">${postAuthorName}</span>
                        <div>
                           <span class="post-date-display">${postDate}</span>
                           <span class="post-author-city">${cityDisplay}</span>
                        </div>
                    </div>
                    ${deleteButton}
                </div>
                <div class="post-content">
                    <p>${post.content}</p>
                    ${imageHTML}
                </div>
                <!-- NOVO: Ações do Post (Like/Comment) -->
                <div class="post-actions">
                    <button class="action-btn btn-like ${isLiked ? 'liked' : ''}" data-post-id="${post._id}">
                        <i class="fas fa-thumbs-up"></i> 
                        <span class="like-count">${post.likes.length}</span> Curtir
                    </button>
                    <button class="action-btn btn-comment" data-post-id="${post._id}">
                        <i class="fas fa-comment"></i> ${post.comments.length} Comentários
                    </button>
                </div>
                <!-- NOVO: Seção de Comentários -->
                <div class="post-comments">
                    <div class="comment-list">${commentsHTML}</div>
                    <div class="comment-form">
                        <input type="text" class="comment-input" placeholder="Escreva um comentário...">
                        <button class="btn-send-comment" data-post-id="${post._id}">Enviar</button>
                    </div>
                </div>
            `;
            minhasPostagensContainer.appendChild(postElement);
        });

        // Adiciona listeners para os novos botões
        setupPostActionListeners();
    }

    function renderMediaAvaliacao(media) {
        if (!mediaEstrelas) return;
        mediaEstrelas.innerHTML = '';
        const estrelasCheias = Math.floor(media);
        const temMeiaEstrela = media % 1 !== 0;

        for (let i = 0; i < estrelasCheias; i++) {
            mediaEstrelas.innerHTML += '<i class="fas fa-star"></i>';
        }
        if (temMeiaEstrela) {
            mediaEstrelas.innerHTML += '<i class="fas fa-star-half-alt"></i>';
        }
        const estrelasVazias = 5 - estrelasCheias - (temMeiaEstrela ? 1 : 0);
        for (let i = 0; i < estrelasVazias; i++) {
            mediaEstrelas.innerHTML += '<i class="far fa-star"></i>';
        }
    }


    // ----------------------------------------------------------------------
    // HANDLERS DE EVENTO (Cliques, Deletar, etc.)
    // ----------------------------------------------------------------------
    
    // 🛑 NOVO: Listeners de Ação de Post (Like/Comment/Delete)
    function setupPostActionListeners() {
        document.querySelectorAll('.delete-post-btn').forEach(btn => btn.addEventListener('click', handleDeletePost));
        document.querySelectorAll('.btn-like').forEach(btn => btn.addEventListener('click', handleLikePost));
        document.querySelectorAll('.btn-comment').forEach(btn => btn.addEventListener('click', toggleCommentSection));
        document.querySelectorAll('.btn-send-comment').forEach(btn => btn.addEventListener('click', handleSendComment));
        
        // Listener para clicar no nome/avatar (se houver posts de outros no futuro)
        document.querySelectorAll('.post-avatar, .user-name').forEach(el => {
            el.style.cursor = 'pointer';
            el.addEventListener('click', (e) => {
                const targetUserId = e.currentTarget.dataset.userid;
                if (targetUserId) {
                    window.location.href = `perfil.html?id=${targetUserId}`;
                }
            });
        });
    }

    async function handleDeletePost(event) {
        const button = event.currentTarget;
        const postId = button.dataset.id;
        const postElement = button.closest('.post');

        if (!confirm('Tem certeza que deseja excluir esta postagem?')) return;

        try {
            const response = await fetch(`/api/posts/${postId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();
            if (response.ok && data.success) {
                postElement.remove(); 
            } else {
                throw new Error(data.message || 'Erro ao deletar postagem.');
            }
        } catch (error) {
            console.error('Erro ao deletar postagem:', error);
            alert(error.message);
        }
    }

    async function handleDeleteServico(event) {
        event.stopPropagation(); 
        const button = event.currentTarget;
        const servicoId = button.dataset.id;
        const servicoElement = button.closest('.servico-item-container');

        if (!confirm('Tem certeza que deseja remover este serviço? Isso removerá as imagens associadas.')) return;

        try {
            const response = await fetch(`/api/user/${loggedInUserId}/servicos/${servicoId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();
            if (response.ok && data.success) {
                alert('Serviço removido com sucesso!');
                servicoElement.remove();
            } else {
                throw new Error(data.message || 'Erro ao remover serviço.');
            }
        } catch (error) {
            console.error('Erro ao remover serviço:', error);
            alert(error.message);
        }
    }
    
    async function handleShowServicoDetails(event) {
        const servicoId = event.currentTarget.closest('.servico-item').dataset.id;
        if (!servicoId) return;
        
        try {
             const response = await fetch(`/api/servico/${servicoId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Serviço não encontrado');
            const servico = await response.json();

            if (imageModal && modalImage && servico.images && servico.images.length > 0) {
                 modalImage.src = servico.images[0];
                 imageModal.classList.add('visible');
            } else if (imageModal && modalImage) {
                modalImage.src = 'https://via.placeholder.com/400?text=Serviço+sem+imagem';
                imageModal.classList.add('visible');
            }
            
        } catch (error) {
            console.error("Erro ao buscar detalhes do serviço:", error);
            alert('Não foi possível carregar os detalhes deste serviço.');
        }
    }

    function setupSectionSwitching() {
        if (!mostrarServicosBtn || !mostrarPostagensBtn || !secaoServicos || !secaoPostagens) return;

        mostrarServicosBtn.addEventListener('click', () => {
            secaoServicos.classList.add('ativa');
            secaoPostagens.classList.remove('ativa');
            mostrarServicosBtn.classList.add('ativo');
            mostrarPostagensBtn.classList.remove('ativo');
        });

        mostrarPostagensBtn.addEventListener('click', () => {
            secaoServicos.classList.remove('ativa');
            secaoPostagens.classList.add('ativa');
            mostrarServicosBtn.classList.remove('ativo');
            mostrarPostagensBtn.classList.add('ativo');
        });
    }

    // ----------------------------------------------------------------------
    // LÓGICA DE EDIÇÃO DE PERFIL
    // ----------------------------------------------------------------------

    // 🛑 CORREÇÃO: Esta é a função que mostra o botão "Alterar Foto"
    function toggleEditMode(isEditing) {
        const viewElements = [
            nomePerfil, idadePerfil, cidadePerfil, telefonePerfil, 
            atuacaoPerfil, descricaoPerfil, emailPerfil, btnEditarPerfil
        ];
        
        // 'labelInputFotoPerfil' está aqui, e será mostrado
        const editElements = [
            labelInputFotoPerfil, inputNome, inputIdade, inputCidade, 
            inputWhatsapp, inputAtuacao, inputDescricao, inputEmail, 
            botoesEdicao
        ];

        viewElements.forEach(el => el && el.classList.toggle('oculto', isEditing));
        editElements.forEach(el => el && el.classList.toggle('oculto', !isEditing));

        // Esconde atuação de Clientes
        if (isEditing && userType !== 'trabalhador') {
            if (inputAtuacao) inputAtuacao.classList.add('oculto');
            if (atuacaoItem) atuacaoItem.style.display = 'none';
        } else if (isEditing && atuacaoItem) {
             if (atuacaoItem) atuacaoItem.style.display = 'flex';
        }
        
        if (inputEmail) {
            inputEmail.disabled = true;
        }
    }

    function fillEditInputs() {
        if (!inputNome) return; 
        
        inputNome.value = nomePerfil.textContent;
        inputIdade.value = idadePerfil.textContent.replace(' anos', '').replace('Não informado', '');
        inputCidade.value = cidadePerfil.textContent.replace('Não informado', '');
        inputWhatsapp.value = telefonePerfil.textContent.replace(/<i class="[^"]+"><\/i> /g, '').trim().replace('Não informado', '');
        inputAtuacao.value = atuacaoPerfil.textContent.replace('Não informado', '');
        inputDescricao.value = descricaoPerfil.textContent.replace('Nenhuma descrição disponível.', '');
        inputEmail.value = emailPerfil.textContent.trim();
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
            const formData = new FormData();
            formData.append('nome', inputNome.value);
            formData.append('idade', inputIdade.value);
            formData.append('cidade', inputCidade.value);
            formData.append('telefone', inputWhatsapp.value);
            formData.append('descricao', inputDescricao.value);
            
            if (userType === 'trabalhador') {
                formData.append('atuacao', inputAtuacao.value);
            }
            if (inputFotoPerfil.files[0]) {
                formData.append('avatar', inputFotoPerfil.files[0]);
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

                alert('Perfil atualizado com sucesso!');
                
                localStorage.setItem('userName', data.user.nome);
                const novaFoto = data.user.avatarUrl || data.user.foto;
                localStorage.setItem('userPhotoUrl', novaFoto);

                toggleEditMode(false);
                fetchUserProfile(); 
                loadHeaderInfo(); 

            } catch (error) {
                console.error('Erro ao salvar perfil:', error);
                alert('Erro ao salvar: ' + error.message);
            }
        });
    }
    
    // ----------------------------------------------------------------------
    // LÓGICA DE AVALIAÇÃO
    // ----------------------------------------------------------------------
    
    if (estrelasAvaliacao.length > 0) {
        // ... (código sem alteração) ...
        estrelasAvaliacao.forEach(star => {
            star.addEventListener('click', () => {
                const value = star.dataset.value;
                formAvaliacao.dataset.value = value; 
                estrelasAvaliacao.forEach(s => {
                    const sValue = s.dataset.value;
                    if (sValue <= value) s.innerHTML = '<i class="fas fa-star"></i>'; 
                    else s.innerHTML = '<i class="far fa-star"></i>'; 
                });
                if (notaSelecionada) notaSelecionada.textContent = `Você selecionou ${value} estrela(s).`;
            });
        });
    }
    
    if (btnEnviarAvaliacao) {
        // ... (código sem alteração) ...
        btnEnviarAvaliacao.addEventListener('click', async (e) => {
            e.preventDefault();
            const estrelas = formAvaliacao.dataset.value;
            const comentario = comentarioAvaliacaoInput.value;
            if (estrelas == 0) {
                alert('Por favor, selecione pelo menos uma estrela.');
                return;
            }
            try {
                const response = await fetch('/api/avaliar-trabalhador', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ trabalhadorId: profileId, estrelas: parseInt(estrelas, 10), comentario: comentario })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Erro ao enviar avaliação.');
                alert('Avaliação enviada com sucesso!');
                formAvaliacao.reset();
                estrelasAvaliacao.forEach(s => s.innerHTML = '<i class="far fa-star"></i>');
                if (notaSelecionada) notaSelecionada.textContent = '';
                fetchUserProfile(); 
            } catch (error) {
                console.error('Erro ao enviar avaliação:', error);
                alert(error.message);
            }
        });
    }
    
    // ----------------------------------------------------------------------
    // LÓGICA DE SERVIÇOS
    // ----------------------------------------------------------------------
    
    if (addServicoBtn) {
        addServicoBtn.addEventListener('click', () => {
            inputFotoServico.click();
        });
    }
    
    if (inputFotoServico) {
        // ... (código sem alteração) ...
        inputFotoServico.addEventListener('change', async (event) => {
            const files = event.target.files;
            if (!files || files.length === 0) return;
            const title = prompt("Qual o título deste serviço?");
            if (!title) return; 
            const description = prompt("Descreva brevemente este serviço:");
            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', description || '');
            for (const file of files) formData.append('images', file); 
            try {
                const response = await fetch('/api/servico', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Erro ao criar serviço.');
                alert('Serviço adicionado com sucesso!');
                fetchUserProfile(); 
            } catch (error) {
                console.error('Erro ao criar serviço:', error);
                alert(error.message);
            }
        });
    }


    // ----------------------------------------------------------------------
    // 🛑 NOVAS FUNÇÕES: Like e Comentário (para a página de perfil)
    // ----------------------------------------------------------------------

    async function handleLikePost(e) {
        const btn = e.currentTarget;
        const postId = btn.dataset.postId;
        
        try {
            const response = await fetch(`/api/posts/${postId}/like`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            
            if (data.success) {
                btn.classList.toggle('liked');
                const likeCountEl = btn.querySelector('.like-count');
                if (likeCountEl) likeCountEl.textContent = data.likes.length;
            }
        } catch (error) {
            console.error('Erro ao curtir:', error);
            alert('Não foi possível processar a curtida.');
        }
    }

    function toggleCommentSection(e) {
        const btn = e.currentTarget;
        const postElement = btn.closest('.post');
        const commentSection = postElement.querySelector('.post-comments');
        
        if (commentSection) {
            commentSection.classList.toggle('visible');
            if (commentSection.classList.contains('visible')) {
                const input = commentSection.querySelector('.comment-input');
                if (input) input.focus();
            }
        }
    }

    async function handleSendComment(e) {
        const btn = e.currentTarget;
        const postId = btn.dataset.postId;
        const postElement = btn.closest('.post');
        const input = postElement.querySelector('.comment-input');
        const content = input.value.trim();

        if (!content) return; // Não envia comentário vazio

        try {
            const response = await fetch(`/api/posts/${postId}/comment`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Adiciona o novo comentário à lista
                const commentList = postElement.querySelector('.comment-list');
                const commentPhoto = data.comment.userId.foto || data.comment.userId.avatarUrl || 'imagens/default-user.png';
                
                const newCommentHTML = `
                <div class="comment">
                    <img src="${commentPhoto.includes('pixabay') ? 'imagens/default-user.png' : commentPhoto}" alt="Avatar" class="comment-avatar">
                    <div class="comment-body">
                        <strong>${data.comment.userId.nome}</strong>
                        <p>${data.comment.content}</p>
                    </div>
                </div>
                `;
                commentList.innerHTML += newCommentHTML;
                input.value = ''; // Limpa o input
            } else {
                throw new Error(data.message || 'Erro ao enviar comentário.');
            }
        } catch (error) {
            console.error('Erro ao comentar:', error);
            alert('Não foi possível enviar o comentário.');
        }
    }

    // ----------------------------------------------------------------------
    // INICIALIZAÇÃO DA PÁGINA E MODAIS
    // ----------------------------------------------------------------------
    
    loadHeaderInfo(); 
    fetchUserProfile(); 
    setupSectionSwitching(); 

    if (fotoPerfil) {
        // ... (código do modal de foto - sem alteração) ...
        fotoPerfil.style.cursor = 'pointer';
        fotoPerfil.addEventListener('click', () => {
            if (fotoPerfil.src && imageModal && modalImage) {
                modalImage.src = fotoPerfil.src;
                imageModal.classList.add('visible');
            }
        });
    }
    
    if (closeImageModalBtn) {
        // ... (código do modal de foto - sem alteração) ...
        closeImageModalBtn.addEventListener('click', () => {
            imageModal.classList.remove('visible');
        });
    }
    
    if (imageModal) {
        // ... (código do modal de foto - sem alteração) ...
        imageModal.addEventListener('click', (e) => {
            if (e.target.id === 'image-modal' || e.target.classList.contains('image-modal-overlay')) {
                imageModal.classList.remove('visible');
            }
        });
    }

    if (feedButton) {
        // ... (código do botão feed - sem alteração) ...
        feedButton.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'index.html';
        });
    }

    if (logoutButton) {
        // ... (código do botão logout - sem alteração) ...
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault(); 
            logoutConfirmModal && logoutConfirmModal.classList.remove('hidden'); 
        });
    }
    if (confirmLogoutYesBtn) {
        // ... (código do botão logout - sem alteração) ...
        confirmLogoutYesBtn.addEventListener('click', () => {
            localStorage.clear();
            window.location.href = 'login.html';
        });
    }
    if (confirmLogoutNoBtn) {
        // ... (código do botão logout - sem alteração) ...
        confirmLogoutNoBtn.addEventListener('click', () => {
            logoutConfirmModal && logoutConfirmModal.classList.add('hidden'); 
        });
    }
});

