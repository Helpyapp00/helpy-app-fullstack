document.addEventListener('DOMContentLoaded', () => {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('jwtToken');
    const userType = localStorage.getItem('userType');

    // Elementos do Header
    const userAvatarHeader = document.getElementById('user-avatar-header');
    const userNameHeader = document.getElementById('user-name-header');
    const profileButton = document.getElementById('profile-button');
    const logoutButton = document.getElementById('logout-button');
    
    // Modal de Logout
    const logoutConfirmModal = document.getElementById('logout-confirm-modal');
    const confirmLogoutYesBtn = document.getElementById('confirm-logout-yes');
    const confirmLogoutNoBtn = document.getElementById('confirm-logout-no');

    // Elementos do Feed
    const postForm = document.getElementById('new-post-form');
    const postContentInput = document.getElementById('post-content-input');
    const postImageInput = document.getElementById('post-image-input');
    const imageFilename = document.getElementById('image-filename');
    const imagePreview = document.getElementById('image-preview'); 
    const postFormMessage = document.getElementById('post-form-message');
    const postsContainer = document.getElementById('posts-container');
    
    // Botões de Filtro
    const filterTodosBtn = document.getElementById('filter-todos');
    const filterTrabalhadoresBtn = document.getElementById('filter-trabalhadores');
    const filterClientesBtn = document.getElementById('filter-clientes');

    // 🛑 NOVO: Filtro de Localização
    const filtroCidadeInput = document.getElementById('filtro-cidade');
    const filtroCidadeBtn = document.getElementById('filtro-cidade-btn');


    // --- FUNÇÕES DE FEEDBACK ---
    function showMessage(element, message, type) {
        if (element) {
            element.textContent = message;
            element.className = `form-message ${type}`;
            element.classList.remove('hidden');
            if (type !== 'info') {
                setTimeout(() => {
                    element.classList.add('hidden');
                }, 4000);
            }
        }
    }

    // --- CARREGAMENTO INICIAL ---
    
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

    // 🛑 ATUALIZADO: fetchPosts agora aceita um filtro de cidade
    async function fetchPosts(cidade = null) {
        if (!postsContainer) return;
        
        let url = '/api/posts';
        if (cidade) {
            // Adiciona o parâmetro de query para a cidade
            url += `?cidade=${encodeURIComponent(cidade)}`;
        }
        
        try {
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                throw new Error('Não foi possível carregar as postagens.');
            }
            const posts = await response.json();
            renderPosts(posts);
        } catch (error) {
            console.error('Erro ao buscar postagens:', error);
            postsContainer.innerHTML = '<p class="mensagem-vazia">Erro ao carregar o feed.</p>';
        }
    }

    // 🛑 ATUALIZADO: renderPosts agora inclui Likes e Comentários
    function renderPosts(posts) {
        if (!postsContainer) return;
        postsContainer.innerHTML = ''; 

        if (!posts || posts.length === 0) {
            postsContainer.innerHTML = '<p class="mensagem-vazia">Nenhuma postagem encontrada.</p>';
            return;
        }

        posts.forEach(post => {
            if (!post.userId) return; 

            const postElement = document.createElement('article');
            postElement.className = 'post';
            postElement.dataset.postId = post._id;
            postElement.dataset.userType = post.userId.tipo; 

            const postAuthorPhoto = (post.userId.foto && !post.userId.foto.includes('pixabay')) 
                                    ? post.userId.foto 
                                    : (post.userId.avatarUrl && !post.userId.avatarUrl.includes('pixabay')
                                        ? post.userId.avatarUrl
                                        : 'imagens/default-user.png');
                                        
            const postAuthorName = post.userId.nome || 'Usuário Anônimo';
            // 🛑 NOVO: Pega a cidade do usuário
            const postAuthorCity = post.userId.cidade || '';

            let deleteButton = '';
            if (post.userId._id === userId) {
                deleteButton = `<button class="delete-post-btn" data-id="${post._id}"><i class="fas fa-trash"></i></button>`;
            }

            let imageHTML = '';
            if (post.imageUrl) {
                imageHTML = `<img src="${post.imageUrl}" alt="Imagem da postagem" class="post-image">`;
            }
            
            // 🛑 NOVO: Verifica se o usuário atual curtiu
            const isLiked = post.likes.includes(userId);
            
            // 🛑 NOVO: Gera HTML dos comentários
            let commentsHTML = post.comments.map(comment => {
                if (!comment.userId) return ''; // Segurança
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
            
            // 🛑 NOVO: Formata a data e a cidade
            const postDate = new Date(post.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const cityDisplay = postAuthorCity ? ` &bull; ${postAuthorCity}` : '';

            // 🛑 ATUALIZADO: HTML do Post com Ações e Comentários
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
            postsContainer.appendChild(postElement);
        });

        // Reativa os listeners para os novos elementos
        setupPostListeners();
    }

    // --- HANDLERS DE EVENTO ---

    // 🛑 ATUALIZADO: Adiciona listeners para like e comment
    function setupPostListeners() {
        document.querySelectorAll('.delete-post-btn').forEach(btn => {
            btn.addEventListener('click', handleDeletePost);
        });
        
        document.querySelectorAll('.post-avatar, .user-name').forEach(el => {
            el.style.cursor = 'pointer';
            el.addEventListener('click', (e) => {
                const targetUserId = e.currentTarget.dataset.userid;
                if (targetUserId) {
                    window.location.href = `perfil.html?id=${targetUserId}`;
                }
            });
        });

        // 🛑 NOVO: Listeners para Like e Comentário
        document.querySelectorAll('.btn-like').forEach(btn => btn.addEventListener('click', handleLikePost));
        document.querySelectorAll('.btn-comment').forEach(btn => btn.addEventListener('click', toggleCommentSection));
        document.querySelectorAll('.btn-send-comment').forEach(btn => btn.addEventListener('click', handleSendComment));
    }

    async function handleDeletePost(event) {
        // ... (código sem alteração)
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

    if (postForm) {
        postForm.addEventListener('submit', async (e) => {
            // ... (código sem alteração)
            e.preventDefault();
            const content = postContentInput.value;
            const imageFile = postImageInput.files[0];
            if (!content && !imageFile) {
                showMessage(postFormMessage, 'Escreva algo ou adicione uma imagem.', 'error');
                return;
            }
            showMessage(postFormMessage, 'Publicando...', 'info');
            const formData = new FormData();
            formData.append('content', content);
            if (imageFile) formData.append('image', imageFile);
            try {
                const response = await fetch('/api/posts', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                const data = await response.json();
                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Falha ao publicar.');
                }
                showMessage(postFormMessage, 'Postagem criada com sucesso!', 'success');
                postForm.reset();
                if(imageFilename) imageFilename.textContent = '';
                if(imagePreview) {
                    imagePreview.classList.add('oculto');
                    imagePreview.src = '#';
                }
                fetchPosts(); // Recarrega todos os posts
            } catch (error) {
                console.error('Erro ao criar postagem:', error);
                showMessage(postFormMessage, error.message, 'error');
            }
        });
    }
    
    if (postImageInput && imageFilename && imagePreview) {
        // ... (código do preview da imagem - sem alteração)
        postImageInput.addEventListener('change', () => {
            const file = postImageInput.files[0];
            if (file) {
                imageFilename.textContent = file.name;
                const reader = new FileReader();
                reader.onload = (e) => {
                    imagePreview.src = e.target.result;
                    imagePreview.classList.remove('oculto');
                };
                reader.readAsDataURL(file);
            } else {
                imageFilename.textContent = '';
                imagePreview.classList.add('oculto');
                imagePreview.src = '#';
            }
        });
    }
    
    // 🛑 ATUALIZADO: Lógica dos Filtros de Categoria
    function filterFeed(tipo) {
        const allPosts = document.querySelectorAll('.post');
        allPosts.forEach(post => {
            if (tipo === 'todos' || post.dataset.userType === tipo) {
                post.classList.remove('hidden');
            } else {
                post.classList.add('hidden');
            }
        });
        filterTodosBtn.classList.toggle('ativo', tipo === 'todos');
        filterTrabalhadoresBtn.classList.toggle('ativo', tipo === 'trabalhador');
        filterClientesBtn.classList.toggle('ativo', tipo === 'cliente');
    }

    if (filterTodosBtn) {
        // 🛑 ATUALIZADO: Botão "Todos" agora limpa o filtro de cidade e recarrega
        filterTodosBtn.addEventListener('click', () => {
            filterFeed('todos');
            if (filtroCidadeInput) filtroCidadeInput.value = '';
            fetchPosts(); // Recarrega o feed sem filtro de cidade
        });
        filterTrabalhadoresBtn.addEventListener('click', () => filterFeed('trabalhador'));
        filterClientesBtn.addEventListener('click', () => filterFeed('cliente'));
    }

    // 🛑 NOVO: Listener para o botão de filtro de cidade
    if (filtroCidadeBtn && filtroCidadeInput) {
        filtroCidadeBtn.addEventListener('click', () => {
            const cidade = filtroCidadeInput.value.trim();
            if (cidade) {
                fetchPosts(cidade); // Busca posts filtrando por cidade
            }
        });
    }

    // ----------------------------------------------------------------------
    // 🛑 NOVAS FUNÇÕES: Like e Comentário
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


    // --- NAVEGAÇÃO DO HEADER ---

    if (profileButton) {
        profileButton.addEventListener('click', () => {
            window.location.href = `perfil.html?id=${userId}`;
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            logoutConfirmModal && logoutConfirmModal.classList.remove('hidden');
        });
    }
    if (confirmLogoutYesBtn) {
        confirmLogoutYesBtn.addEventListener('click', () => {
            localStorage.clear();
            window.location.href = 'login.html';
        });
    }
    if (confirmLogoutNoBtn) {
        confirmLogoutNoBtn.addEventListener('click', () => {
            logoutConfirmModal && logoutConfirmModal.classList.add('hidden');
        });
    }

    // --- INICIALIZAÇÃO ---
    if (!token || !userId) {
        window.location.href = 'login.html';
    } else {
        loadHeaderInfo();
        fetchPosts(); // Carrega o feed inicial (sem filtro de cidade)
    }
});

