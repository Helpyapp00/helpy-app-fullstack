document.addEventListener('DOMContentLoaded', () => {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('jwtToken');
    const userType = localStorage.getItem('userType');

    // --- Elementos do Header ---
    const userAvatarHeader = document.getElementById('user-avatar-header');
    const userNameHeader = document.getElementById('user-name-header');
    const profileButton = document.getElementById('profile-button');
    const logoutButton = document.getElementById('logout-button');
    const searchInput = document.querySelector('.search');
    
    // --- Modais ---
    const logoutConfirmModal = document.getElementById('logout-confirm-modal');
    const confirmLogoutYesBtn = document.getElementById('confirm-logout-yes');
    const confirmLogoutNoBtn = document.getElementById('confirm-logout-no');

    // --- Elementos do Feed ---
    const postForm = document.getElementById('new-post-form');
    const postContentInput = document.getElementById('post-content-input');
    const postMediaInput = document.getElementById('post-media-input');
    const mediaFilename = document.getElementById('media-filename');
    const imagePreview = document.getElementById('image-preview'); 
    const videoPreview = document.getElementById('video-preview');
    const postFormMessage = document.getElementById('post-form-message');
    const postsContainer = document.getElementById('posts-container');
    
    // --- Filtros e Configurações ---
    const filterTodosBtn = document.getElementById('filter-todos');
    const filterTrabalhadoresBtn = document.getElementById('filter-trabalhadores');
    const filterClientesBtn = document.getElementById('filter-clientes');
    const filtroCidadeInput = document.getElementById('filtro-cidade');
    const filtroCidadeBtn = document.getElementById('filtro-cidade-btn');
    
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const htmlElement = document.documentElement; // O elemento <html>

    // ----------------------------------------------------------------------
    // LÓGICA DO TEMA (DARK MODE)
    // ----------------------------------------------------------------------
    function applyTheme(theme) {
        if (theme === 'dark') {
            htmlElement.classList.add('dark-mode');
            if (darkModeToggle) darkModeToggle.checked = true;
        } else {
            htmlElement.classList.remove('dark-mode');
            if (darkModeToggle) darkModeToggle.checked = false;
        }
    }

    // Carregar tema salvo do localStorage
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    // Atualizar tema quando o usuário mudar
    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', async () => {
            const theme = darkModeToggle.checked ? 'dark' : 'light';
            applyTheme(theme);
            localStorage.setItem('theme', theme);
            
            // Se o usuário estiver logado, atualizar a preferência no servidor
            const userId = localStorage.getItem('userId');
            const token = localStorage.getItem('jwtToken');
            
            if (userId && token) {
                try {
                    const response = await fetch('/api/user/theme', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ tema: theme })
                    });
                    
                    const result = await response.json();
                    
                    if (!response.ok) {
                        throw new Error(result.message || 'Erro ao atualizar o tema');
                    }
                    
                    console.log('Tema atualizado com sucesso:', result);
                } catch (error) {
                    console.error('Erro ao atualizar preferência de tema:', error);
                    // Reverte a mudança em caso de erro
                    const revertedTheme = theme === 'dark' ? 'light' : 'dark';
                    applyTheme(revertedTheme);
                    localStorage.setItem('theme', revertedTheme);
                    darkModeToggle.checked = revertedTheme === 'dark';
                    alert('Não foi possível salvar sua preferência de tema. Tente novamente.');
                }
            }
        });
    }

    // ----------------------------------------------------------------------
    // LÓGICA DO TEXTAREA AUTO-RESIZE
    // ----------------------------------------------------------------------
    if (postContentInput) {
        postContentInput.addEventListener('input', () => {
            postContentInput.style.height = 'auto'; // Reseta a altura
            postContentInput.style.height = (postContentInput.scrollHeight) + 'px'; // Ajusta à altura do conteúdo
        });
    }

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
        const storedName = localStorage.getItem('userName') || 'Carregando...';
        const storedPhotoUrl = localStorage.getItem('userPhotoUrl');

        if (userNameHeader) {
            userNameHeader.textContent = storedName.split(' ')[0];
        }
        if (userAvatarHeader) {
            if (storedPhotoUrl && storedPhotoUrl !== 'undefined' && !storedPhotoUrl.includes('pixabay')) {
                // Técnica similar ao Facebook: carrega a imagem com cache busting para forçar alta qualidade
                // Remove src primeiro para forçar reload completo
                userAvatarHeader.src = '';
                
                // Adiciona timestamp para evitar cache e garantir carregamento fresco
                const separator = storedPhotoUrl.includes('?') ? '&' : '?';
                const freshUrl = storedPhotoUrl + separator + '_t=' + Date.now();
                
                // Cria uma nova imagem para pré-carregar com alta qualidade
                const preloadImg = new Image();
                // Só define crossOrigin se a URL for de outro domínio
                if (freshUrl.startsWith('http') && !freshUrl.includes(window.location.hostname)) {
                    preloadImg.crossOrigin = 'anonymous';
                }
                
                preloadImg.onload = function() {
                    // Quando a imagem pré-carregada estiver pronta, aplica ao elemento
                    userAvatarHeader.src = freshUrl;
                    userAvatarHeader.loading = 'eager';
                    userAvatarHeader.decoding = 'sync'; // Síncrono para melhor qualidade
                    
                    // Força repaint para melhor renderização
                    userAvatarHeader.style.opacity = '0';
                    setTimeout(() => {
                        userAvatarHeader.style.opacity = '1';
                        // Força reflow para garantir renderização de alta qualidade
                        userAvatarHeader.offsetHeight;
                    }, 10);
                };
                
                preloadImg.onerror = function() {
                    // Fallback se pré-carregamento falhar
                    userAvatarHeader.src = storedPhotoUrl;
                    userAvatarHeader.loading = 'eager';
                };
                
                // Inicia o pré-carregamento
                preloadImg.src = freshUrl;
            } else {
                userAvatarHeader.src = 'imagens/default-user.png';
            }
        }
    }

    async function fetchPosts(cidade = null) {
        if (!postsContainer) return;
        
        // Verifica se ainda há token antes de fazer requisição
        const currentToken = localStorage.getItem('jwtToken');
        if (!currentToken) {
            return; // Não faz requisição se não há token
        }
        
        let url = '/api/posts';
        if (cidade) {
            url += `?cidade=${encodeURIComponent(cidade)}`;
        }
        try {
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${currentToken}` }
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
            
            // 🛑 NOVO: Verifica se o usuário logado é o dono do post
            const isPostOwner = (post.userId._id === userId);
            if (isPostOwner) {
                postElement.classList.add('is-owner');
            }

            const postAuthorPhoto = (post.userId.foto && !post.userId.foto.includes('pixabay')) 
                                    ? post.userId.foto 
                                    : (post.userId.avatarUrl && !post.userId.avatarUrl.includes('pixabay')
                                        ? post.userId.avatarUrl
                                        : 'imagens/default-user.png');
                                        
            const postAuthorName = post.userId.nome || 'Usuário Anônimo';
            const postAuthorCity = post.userId.cidade || '';
            const postAuthorState = post.userId.estado || '';

            let deleteButton = '';
            if (isPostOwner) {
                deleteButton = `<button class="delete-post-btn" data-id="${post._id}"><i class="fas fa-trash"></i></button>`;
            }

            let mediaHTML = '';
            if (post.mediaUrl) {
                if (post.mediaType === 'video') {
                    mediaHTML = `<video src="${post.mediaUrl}" class="post-video" controls></video>`;
                } else if (post.mediaType === 'image') {
                    mediaHTML = `<img src="${post.mediaUrl}" alt="Imagem da postagem" class="post-image">`;
                }
            }
            
            const isLiked = post.likes.includes(userId);
            
            // 🛑 ATUALIZAÇÃO: Renderização dos Comentários e Respostas
            let commentsHTML = (post.comments || []).map(comment => {
                if (!comment.userId) return '';
                
                // Renderiza Respostas primeiro
                let repliesHTML = (comment.replies || []).map(reply => {
                    return renderReply(reply, comment._id, isPostOwner);
                }).join('');

                const commentPhoto = comment.userId.foto || comment.userId.avatarUrl || 'imagens/default-user.png';
                const isCommentLiked = comment.likes && comment.likes.includes(userId);
                const replyCount = comment.replies?.length || 0;
                
                return `
                <div class="comment" data-comment-id="${comment._id}">
                    <img src="${commentPhoto.includes('pixabay') ? 'imagens/default-user.png' : commentPhoto}" alt="Avatar" class="comment-avatar">
                    <div class="comment-body-container">
                        <div class="comment-body">
                            <strong>${comment.userId.nome}</strong>
                            <p>${comment.content}</p>
                            <!-- Botão de deletar (só visível para dono do post) -->
                            <button class="btn-delete-comment" data-comment-id="${comment._id}" title="Apagar comentário">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                        <div class="comment-actions">
                            <button class="comment-action-btn btn-like-comment ${isCommentLiked ? 'liked' : ''}" data-comment-id="${comment._id}">
                                <i class="fas fa-thumbs-up"></i>
                                <span class="like-count">${comment.likes?.length || 0}</span>
                            </button>
                            <button class="comment-action-btn btn-show-reply-form" data-comment-id="${comment._id}">Responder</button>
                            ${(replyCount > 0) ? `<button class="comment-action-btn btn-toggle-replies" data-comment-id="${comment._id}">Ver ${replyCount} Respostas</button>` : ''}
                        </div>
                        <div class="reply-list oculto">${repliesHTML}</div>
                        <div class="reply-form oculto">
                            <input type="text" class="reply-input" placeholder="Responda a ${comment.userId.nome}...">
                            <button class="btn-send-reply" data-comment-id="${comment._id}">Enviar</button>
                        </div>
                    </div>
                </div>
                `;
            }).join('');
            
            const postDate = new Date(post.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            // 🛑 ATUALIZAÇÃO: Mostra Cidade e Estado
            const cityDisplay = [postAuthorCity, postAuthorState].filter(Boolean).join(', ');
            const citySeparator = cityDisplay ? ` &bull; ${cityDisplay}` : '';
            
            // 🆕 ATUALIZADO: Mostra comentários expandidos por padrão
            const comentariosVisiveis = post.comments && post.comments.length > 0 ? 'visible' : '';
            
            postElement.innerHTML = `
                <div class="post-header">
                    <img src="${postAuthorPhoto}" alt="Avatar" class="post-avatar" data-userid="${post.userId._id}">
                    <div class="post-meta">
                        <span class="user-name" data-userid="${post.userId._id}">${postAuthorName}</span>
                        <div>
                           <span class="post-date-display">${postDate}</span>
                           <span class="post-author-city">${citySeparator}</span>
                        </div>
                    </div>
                    ${deleteButton}
                </div>
                <div class="post-content">
                    <p>${post.content}</p>
                    ${mediaHTML}
                </div>
                <div class="post-actions">
                    <button class="action-btn btn-like ${isLiked ? 'liked' : ''}" data-post-id="${post._id}">
                        <i class="fas fa-thumbs-up"></i> 
                        <span class="like-count">${post.likes.length}</span> Curtir
                    </button>
                    <button class="action-btn btn-comment ${comentariosVisiveis ? 'active' : ''}" data-post-id="${post._id}">
                        <i class="fas fa-comment"></i> ${post.comments?.length || 0} Comentários
                    </button>
                </div>
                <div class="post-comments ${comentariosVisiveis}">
                    <div class="comment-list">${commentsHTML}</div>
                    <div class="comment-form">
                        <input type="text" class="comment-input" placeholder="Escreva um comentário...">
                        <button class="btn-send-comment" data-post-id="${post._id}">Enviar</button>
                    </div>
                </div>
            `;
            postsContainer.appendChild(postElement);
        });

        setupPostListeners();
    }

    // 🛑 NOVO: Função para renderizar uma Resposta (Reply)
    function renderReply(reply, commentId, isPostOwner) {
        if (!reply.userId) return '';
        const replyPhoto = reply.userId.foto || reply.userId.avatarUrl || 'imagens/default-user.png';
        const isReplyLiked = reply.likes && reply.likes.includes(userId);

        return `
        <div class="reply" data-reply-id="${reply._id}">
            <img src="${replyPhoto.includes('pixabay') ? 'imagens/default-user.png' : replyPhoto}" alt="Avatar" class="reply-avatar">
            <div class="reply-body-container">
                <div class="reply-body">
                    <strong>${reply.userId.nome}</strong>
                    <p>${reply.content}</p>
                    <!-- Botão de deletar (só visível para dono do post) -->
                    <button class="btn-delete-reply" data-comment-id="${commentId}" data-reply-id="${reply._id}" title="Apagar resposta">
                        <i class="fas fa-trash"></i>
                    </button>
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

    // --- HANDLERS DE EVENTO ---

    function setupPostListeners() {
        document.querySelectorAll('.delete-post-btn').forEach(btn => btn.addEventListener('click', handleDeletePost));
        document.querySelectorAll('.post-avatar, .user-name').forEach(el => {
            el.style.cursor = 'pointer';
            el.addEventListener('click', (e) => {
                const targetUserId = e.currentTarget.dataset.userid;
                if (targetUserId) {
                    window.location.href = `/perfil?id=${targetUserId}`;
                }
            });
        });
        
        // Ações do Post
        document.querySelectorAll('.btn-like').forEach(btn => btn.addEventListener('click', handleLikePost));
        document.querySelectorAll('.btn-comment').forEach(btn => btn.addEventListener('click', toggleCommentSection));
        document.querySelectorAll('.btn-send-comment').forEach(btn => btn.addEventListener('click', handleSendComment));
        
        // 🛑 NOVO: Ações de Comentário
        document.querySelectorAll('.btn-like-comment').forEach(btn => btn.addEventListener('click', handleLikeComment));
        document.querySelectorAll('.btn-delete-comment').forEach(btn => btn.addEventListener('click', handleDeleteComment));
        document.querySelectorAll('.btn-show-reply-form').forEach(btn => btn.addEventListener('click', toggleReplyForm));
        document.querySelectorAll('.btn-toggle-replies').forEach(btn => btn.addEventListener('click', toggleReplyList));
        document.querySelectorAll('.btn-send-reply').forEach(btn => btn.addEventListener('click', handleSendReply));

        // 🛑 NOVO: Ações de Resposta
        document.querySelectorAll('.btn-like-reply').forEach(btn => btn.addEventListener('click', handleLikeReply));
        document.querySelectorAll('.btn-delete-reply').forEach(btn => btn.addEventListener('click', handleDeleteReply));
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


    if (postForm) {
        postForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const content = postContentInput.value;
            const mediaFile = postMediaInput.files[0];
            if (!content && !mediaFile) {
                showMessage(postFormMessage, 'Você precisa adicionar um texto ou uma mídia.', 'error');
                return;
            }
            const formData = new FormData();
            formData.append('content', content);
            if (mediaFile) formData.append('media', mediaFile);
            
            showMessage(postFormMessage, 'Publicando...', 'info');
            
            try {
                const response = await fetch('/api/posts', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                const data = await response.json();
                if (response.ok && data.success) {
                    showMessage(postFormMessage, 'Postagem criada com sucesso!', 'success');
                    postForm.reset();
                    if (mediaFilename) mediaFilename.textContent = 'Nenhuma mídia selecionada';
                    if (imagePreview) imagePreview.classList.add('oculto');
                    if (videoPreview) videoPreview.classList.add('oculto');
                    if (mediaPreviewContainer) mediaPreviewContainer.classList.add('oculto');
                    if (postContentInput) postContentInput.style.height = 'auto';
                    fetchPosts(); // Recarrega o feed
                } else {
                    throw new Error(data.message || 'Erro ao criar postagem.');
                }
            } catch (error) {
                console.error('Erro ao criar postagem:', error);
                showMessage(postFormMessage, error.message, 'error');
            }
        });
    }
    
    // 🆕 ATUALIZADO: Preview de mídia melhorado
    const mediaPreviewContainer = document.getElementById('media-preview-container');
    const btnRemoverPreview = document.getElementById('btn-remover-preview');
    
    if (postMediaInput && mediaFilename && imagePreview && videoPreview) {
        postMediaInput.addEventListener('change', () => {
            const file = postMediaInput.files[0];
            if (file) {
                mediaFilename.textContent = file.name;
                if (mediaPreviewContainer) mediaPreviewContainer.classList.remove('oculto');
                
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        imagePreview.src = e.target.result;
                        imagePreview.classList.remove('oculto');
                        videoPreview.classList.add('oculto');
                    };
                    reader.readAsDataURL(file);
                } else if (file.type.startsWith('video/')) {
                    videoPreview.src = URL.createObjectURL(file);
                    videoPreview.classList.remove('oculto');
                    imagePreview.classList.add('oculto');
                }
            } else {
                if (mediaPreviewContainer) mediaPreviewContainer.classList.add('oculto');
                mediaFilename.textContent = 'Nenhuma mídia selecionada';
                imagePreview.classList.add('oculto');
                videoPreview.classList.add('oculto');
            }
        });
    }
    
    if (btnRemoverPreview) {
        btnRemoverPreview.addEventListener('click', () => {
            postMediaInput.value = '';
            if (mediaPreviewContainer) mediaPreviewContainer.classList.add('oculto');
            imagePreview.classList.add('oculto');
            videoPreview.classList.add('oculto');
            if (mediaFilename) mediaFilename.textContent = 'Nenhuma mídia selecionada';
        });
    }
    
    function filterFeed(tipo) {
        document.querySelectorAll('.post').forEach(post => {
            if (tipo === 'todos') {
                post.style.display = 'block';
            } else {
                if (post.dataset.userType === tipo) {
                    post.style.display = 'block';
                } else {
                    post.style.display = 'none';
                }
            }
        });
        // Atualiza botões ativos
        filterTodosBtn.classList.toggle('ativo', tipo === 'todos');
        filterTrabalhadoresBtn.classList.toggle('ativo', tipo === 'trabalhador');
        filterClientesBtn.classList.toggle('ativo', tipo === 'cliente');
    }

    if (filterTodosBtn) filterTodosBtn.addEventListener('click', () => filterFeed('todos'));
    if (filterTrabalhadoresBtn) filterTrabalhadoresBtn.addEventListener('click', () => filterFeed('trabalhador'));
    if (filterClientesBtn) filterClientesBtn.addEventListener('click', () => filterFeed('cliente'));

    if (filtroCidadeBtn && filtroCidadeInput) {
        filtroCidadeBtn.addEventListener('click', () => {
            const cidade = filtroCidadeInput.value.trim();
            fetchPosts(cidade || null); // Busca todos se o campo estiver vazio
        });
    }

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
                btn.querySelector('.like-count').textContent = data.likes.length;
            }
        } catch (error) {
            console.error('Erro ao curtir:', error);
        }
    }

    function toggleCommentSection(e) {
        const btn = e.currentTarget;
        const postElement = btn.closest('.post');
        const commentsSection = postElement.querySelector('.post-comments');
        commentsSection.classList.toggle('visible');
        if (commentsSection.classList.contains('visible')) {
            commentsSection.querySelector('.comment-input').focus();
        }
    }

    async function handleSendComment(e) {
        const btn = e.currentTarget;
        const postId = btn.dataset.postId;
        const postElement = btn.closest('.post');
        const input = postElement.querySelector('.comment-form .comment-input');
        const content = input.value.trim();
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
                const comment = data.comment;
                const commentPhoto = comment.userId.foto || comment.userId.avatarUrl || 'imagens/default-user.png';
                const isPostOwner = postElement.classList.contains('is-owner');

                const newCommentHTML = `
                <div class="comment" data-comment-id="${comment._id}">
                    <img src="${commentPhoto.includes('pixabay') ? 'imagens/default-user.png' : commentPhoto}" alt="Avatar" class="comment-avatar">
                    <div class="comment-body-container">
                        <div class="comment-body">
                            <strong>${comment.userId.nome}</strong>
                            <p>${comment.content}</p>
                            <button class="btn-delete-comment" data-comment-id="${comment._id}" title="Apagar comentário">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                        <div class="comment-actions">
                            <button class="comment-action-btn btn-like-comment" data-comment-id="${comment._id}">
                                <i class="fas fa-thumbs-up"></i>
                                <span class="like-count">0</span>
                            </button>
                            <button class="comment-action-btn btn-show-reply-form" data-comment-id="${comment._id}">Responder</button>
                        </div>
                        <div class="reply-list oculto"></div>
                        <div class="reply-form oculto">
                            <input type="text" class="reply-input" placeholder="Responda a ${comment.userId.nome}...">
                            <button class="btn-send-reply" data-comment-id="${comment._id}">Enviar</button>
                        </div>
                    </div>
                </div>
                `;
                commentList.innerHTML += newCommentHTML;
                
                // Re-anexa listeners para os novos botões
                const newCommentElement = commentList.lastElementChild;
                newCommentElement.querySelector('.btn-like-comment').addEventListener('click', handleLikeComment);
                newCommentElement.querySelector('.btn-delete-comment').addEventListener('click', handleDeleteComment);
                newCommentElement.querySelector('.btn-show-reply-form').addEventListener('click', toggleReplyForm);
                newCommentElement.querySelector('.btn-send-reply').addEventListener('click', handleSendReply);
                
                input.value = '';
            } else {
                throw new Error(data.message || 'Erro ao enviar comentário.');
            }
        } catch (error) {
            console.error('Erro ao comentar:', error);
            alert('Não foi possível enviar o comentário.');
        }
    }


    // ----------------------------------------------------------------------
    // 🛑 NOVOS HANDLERS (Comentários e Respostas)
    // ----------------------------------------------------------------------

    function toggleReplyForm(e) {
        const btn = e.currentTarget;
        const commentElement = btn.closest('.comment');
        const replyForm = commentElement.querySelector('.reply-form');
        if (replyForm) {
            replyForm.classList.toggle('oculto');
            if (!replyForm.classList.contains('oculto')) {
                replyForm.querySelector('.reply-input').focus();
            }
        }
    }

    function toggleReplyList(e) {
        const btn = e.currentTarget;
        const commentElement = btn.closest('.comment');
        const replyList = commentElement.querySelector('.reply-list');
        if (replyList) {
            replyList.classList.toggle('oculto');
            const replyCount = replyList.children.length;
            btn.textContent = replyList.classList.contains('oculto') ? `Ver ${replyCount} Respostas` : "Ocultar Respostas";
        }
    }

    async function handleSendReply(e) {
        const btn = e.currentTarget;
        const commentId = btn.dataset.commentId;
        const postElement = btn.closest('.post');
        const postId = postElement.dataset.postId;
        const replyForm = btn.closest('.reply-form');
        const input = replyForm.querySelector('.reply-input');
        const content = input.value.trim();
        if (!content) return;

        try {
            const response = await fetch(`/api/posts/${postId}/comments/${commentId}/reply`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });
            const data = await response.json();
            if (data.success && data.reply) {
                const replyList = btn.closest('.comment-body-container').querySelector('.reply-list');
                const isPostOwner = postElement.classList.contains('is-owner');
                const newReplyHTML = renderReply(data.reply, commentId, isPostOwner);
                replyList.innerHTML += newReplyHTML;
                
                // Re-anexa listeners para os novos botões da resposta
                const newReplyElement = replyList.lastElementChild;
                newReplyElement.querySelector('.btn-like-reply').addEventListener('click', handleLikeReply);
                newReplyElement.querySelector('.btn-delete-reply').addEventListener('click', handleDeleteReply);

                replyList.classList.remove('oculto'); // Mostra a lista
                input.value = '';
                replyForm.classList.add('oculto'); // Esconde o form
            } else {
                throw new Error(data.message || 'Erro ao enviar resposta.');
            }
        } catch (error) {
            console.error('Erro ao responder:', error);
            alert('Não foi possível enviar a resposta.');
        }
    }

    async function handleLikeComment(e) {
        const btn = e.currentTarget;
        const commentId = btn.dataset.commentId;
        const postId = btn.closest('.post').dataset.postId;
        
        try {
            const response = await fetch(`/api/posts/${postId}/comments/${commentId}/like`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                btn.classList.toggle('liked');
                btn.querySelector('.like-count').textContent = data.likes.length;
            }
        } catch (error) {
            console.error('Erro ao curtir comentário:', error);
        }
    }

    async function handleLikeReply(e) {
        const btn = e.currentTarget;
        const commentId = btn.dataset.commentId;
        const replyId = btn.dataset.replyId;
        const postId = btn.closest('.post').dataset.postId;
        
        try {
            const response = await fetch(`/api/posts/${postId}/comments/${commentId}/replies/${replyId}/like`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                btn.classList.toggle('liked');
                btn.querySelector('.like-count').textContent = data.likes.length;
            }
        } catch (error) {
            console.error('Erro ao curtir resposta:', error);
        }
    }


    async function handleDeleteComment(e) {
        const btn = e.currentTarget;
        const commentId = btn.dataset.commentId;
        const postElement = btn.closest('.post');
        const postId = postElement.dataset.postId;

        if (!confirm('Tem certeza que deseja apagar este comentário?')) return;

        try {
            const response = await fetch(`/api/posts/${postId}/comments/${commentId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                btn.closest('.comment').remove(); // Remove o comentário do DOM
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Erro ao deletar comentário:', error);
            alert('Erro: ' + error.message);
        }
    }

    async function handleDeleteReply(e) {
        const btn = e.currentTarget;
        const commentId = btn.dataset.commentId;
        const replyId = btn.dataset.replyId;
        const postId = btn.closest('.post').dataset.postId;

        if (!confirm('Tem certeza que deseja apagar esta resposta?')) return;

        try {
            const response = await fetch(`/api/posts/${postId}/comments/${commentId}/replies/${replyId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                btn.closest('.reply').remove(); // Remove a resposta do DOM
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Erro ao deletar resposta:', error);
            alert('Erro: ' + error.message);
        }
    }

    // --- NAVEGAÇÃO DO HEADER ---
    if (profileButton) {
        profileButton.addEventListener('click', () => {
            window.location.href = `/perfil?id=${userId}`;
        });
    }

    // Função para fazer logout de forma segura (disponível globalmente)
    window.fazerLogout = function() {
        // Para todos os intervalos ativos
        if (window.notificacoesInterval) {
            clearInterval(window.notificacoesInterval);
            window.notificacoesInterval = null;
        }
        
        // Cancela requisições pendentes (se houver AbortController)
        if (window.abortControllers) {
            window.abortControllers.forEach(controller => {
                try {
                    controller.abort();
                } catch (e) {
                    // Ignora erros ao abortar
                }
            });
            window.abortControllers = [];
        }
        
        // Limpa localStorage
        localStorage.clear();
        
        // Redireciona imediatamente
        window.location.href = '/login';
    };

    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            logoutConfirmModal && logoutConfirmModal.classList.remove('hidden');
        });
    }
    if (confirmLogoutYesBtn) {
        confirmLogoutYesBtn.addEventListener('click', () => {
            window.fazerLogout();
        });
    }
    if (confirmLogoutNoBtn) {
        confirmLogoutNoBtn.addEventListener('click', () => {
            logoutConfirmModal && logoutConfirmModal.classList.add('hidden');
        });
    }

    // ----------------------------------------------------------------------
    // FUNCIONALIDADE DE BUSCA (desabilitada para evitar erros)
    // ----------------------------------------------------------------------
    if (searchInput) {
        // Desabilita busca - campo apenas visual por enquanto
        searchInput.addEventListener('focus', (e) => {
            e.target.blur();
        });
        searchInput.addEventListener('keydown', (e) => {
            e.preventDefault();
            return false;
        });
        searchInput.style.cursor = 'not-allowed';
        searchInput.style.opacity = '0.6';
        searchInput.setAttribute('readonly', 'readonly');
        searchInput.setAttribute('title', 'Funcionalidade de busca em desenvolvimento');
    }

    // ----------------------------------------------------------------------
    // 🆕 NOVO: FUNCIONALIDADES "PRECISO AGORA!" - Profissionais Próximos
    // ----------------------------------------------------------------------
    // Disponível para todos os usuários (clientes e profissionais podem precisar de outros profissionais)
    const btnPrecisoAgora = document.getElementById('btn-preciso-agora');
    const modalPrecisoAgora = document.getElementById('modal-preciso-agora');
    const profissionaisProximos = document.getElementById('profissionais-proximos');
    const btnBuscarProximos = document.getElementById('btn-buscar-proximos');
    const filtroTipoServico = document.getElementById('filtro-tipo-servico');

    if (btnPrecisoAgora) {
        btnPrecisoAgora.addEventListener('click', async () => {
            if (!navigator.geolocation) {
                alert('Seu navegador não suporta geolocalização.');
                return;
            }

            modalPrecisoAgora?.classList.remove('hidden');
            profissionaisProximos.innerHTML = '<p>Obtendo sua localização...</p>';

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    
                    // Atualiza localização do usuário no servidor
                    try {
                        await fetch('/api/user/localizacao', {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ latitude, longitude })
                        });
                    } catch (error) {
                        console.error('Erro ao atualizar localização:', error);
                    }

                    // Busca profissionais próximos
                    await buscarProfissionaisProximos(latitude, longitude);
                },
                (error) => {
                    profissionaisProximos.innerHTML = `<p class="erro">Erro ao obter localização: ${error.message}</p>`;
                }
            );
        });
    }

    async function buscarProfissionaisProximos(latitude, longitude, tipoServico = null, apenasSelo = false) {
        if (!profissionaisProximos) return;
        
        profissionaisProximos.innerHTML = '<p>Buscando profissionais...</p>';
        
        try {
            const response = await fetch('/api/preciso-agora', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ latitude, longitude, tipoServico, raioKm: 10, apenasSeloQualidade: apenasSelo })
            });

            const data = await response.json();
            
            if (data.success && data.profissionais.length > 0) {
                profissionaisProximos.innerHTML = data.profissionais.map(prof => {
                    const temSelo = prof.gamificacao?.temSeloQualidade || false;
                    const nivelReputacao = prof.gamificacao?.nivelReputacao || 'iniciante';
                    const nivel = prof.gamificacao?.nivel || 1;
                    
                    return `
                    <div class="profissional-card ${temSelo ? 'com-selo' : ''}">
                        <img src="${prof.foto || prof.avatarUrl || 'imagens/default-user.png'}" alt="${prof.nome}" class="profissional-avatar">
                        <div class="profissional-info">
                            <h4>
                                ${prof.nome}
                                ${temSelo ? '<span class="selo-qualidade" title="Selo de Qualidade Helpy">🛡️</span>' : ''}
                                ${nivelReputacao === 'mestre' ? '<span class="badge-mestre" title="Mestre Helpy">👑</span>' : ''}
                            </h4>
                            <p><i class="fas fa-briefcase"></i> ${prof.atuacao || 'Profissional'}</p>
                            <p><i class="fas fa-map-marker-alt"></i> ${prof.cidade || ''}${prof.estado ? ', ' + prof.estado : ''}</p>
                            <p><i class="fas fa-star"></i> ${prof.mediaAvaliacao?.toFixed(1) || '0.0'} (${prof.totalAvaliacoes || 0} avaliações)</p>
                            <p><i class="fas fa-trophy"></i> Nível ${nivel} - ${nivelReputacao === 'mestre' ? 'Mestre' : nivelReputacao === 'validado' ? 'Validado' : 'Iniciante'}</p>
                            <p class="distancia-info">
                                <i class="fas fa-route"></i> ${prof.distancia} km &bull; 
                                <i class="fas fa-clock"></i> ~${prof.tempoEstimado} min
                            </p>
                            ${prof.telefone ? `<a href="https://wa.me/55${prof.telefone.replace(/\D/g, '')}" target="_blank" class="btn-contatar"><i class="fab fa-whatsapp"></i> Contatar</a>` : ''}
                        </div>
                    </div>
                `;
                }).join('');
            } else {
                profissionaisProximos.innerHTML = '<p class="mensagem-vazia">Nenhum profissional disponível próximo a você no momento.</p>';
            }
        } catch (error) {
            console.error('Erro ao buscar profissionais:', error);
            profissionaisProximos.innerHTML = '<p class="erro">Erro ao buscar profissionais. Tente novamente.</p>';
        }
    }

    if (btnBuscarProximos && filtroTipoServico) {
        btnBuscarProximos.addEventListener('click', async () => {
            if (!navigator.geolocation) return;
            
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    const tipoServico = filtroTipoServico.value.trim() || null;
                    const apenasSelo = document.getElementById('filtro-selo-qualidade')?.checked || false;
                    await buscarProfissionaisProximos(latitude, longitude, tipoServico, apenasSelo);
                },
                (error) => {
                    alert('Erro ao obter localização: ' + error.message);
                }
            );
        });
    }


    // ----------------------------------------------------------------------
    // 🆕 NOVO: FUNCIONALIDADES TIMES LOCAIS
    // ----------------------------------------------------------------------
    const btnCriarTime = document.getElementById('btn-criar-time');
    const modalCriarTime = document.getElementById('modal-criar-time');
    const formCriarTime = document.getElementById('form-criar-time');
    const timesContainer = document.getElementById('times-container');
    const profissionaisLista = document.getElementById('profissionais-lista');

    // Carregar times locais
    async function carregarTimesLocais() {
        if (!timesContainer) return;
        
        try {
            const user = await fetch(`/api/usuario/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(r => r.json());
            
            const cidade = user.cidade || '';
            const response = await fetch(`/api/times-projeto?cidade=${encodeURIComponent(cidade)}&status=aberto`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const data = await response.json();
            
            if (data.success && data.times.length > 0) {
                timesContainer.innerHTML = data.times.map(time => `
                    <div class="time-card">
                        <div class="time-header">
                            <h3>${time.titulo}</h3>
                            <span class="time-status status-${time.status}">${time.status.replace('_', ' ')}</span>
                        </div>
                        <p class="time-descricao">${time.descricao}</p>
                        <p class="time-localizacao">
                            <i class="fas fa-map-marker-alt"></i> ${time.localizacao.bairro}, ${time.localizacao.cidade} - ${time.localizacao.estado}
                        </p>
                        <div class="time-profissionais">
                            <strong>Profissionais necessários:</strong>
                            <ul>
                                ${time.profissionaisNecessarios.map(p => `<li>${p.quantidade}x ${p.tipo}</li>`).join('')}
                            </ul>
                        </div>
                        <div class="time-candidatos">
                            <strong>Candidatos: ${time.candidatos?.length || 0}</strong>
                        </div>
                        ${userType === 'trabalhador' ? `
                            <button class="btn-candidatar" data-time-id="${time._id}">
                                <i class="fas fa-hand-paper"></i> Candidatar-se
                            </button>
                        ` : ''}
                    </div>
                `).join('');
                
                // Adiciona listeners aos botões de candidatura
                document.querySelectorAll('.btn-candidatar').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const timeId = e.currentTarget.dataset.timeId;
                        await candidatarTime(timeId);
                    });
                });
            } else {
                timesContainer.innerHTML = '<p class="mensagem-vazia">Nenhum time de projeto aberto na sua cidade no momento.</p>';
            }
        } catch (error) {
            console.error('Erro ao carregar times:', error);
            timesContainer.innerHTML = '<p class="erro">Erro ao carregar times de projeto.</p>';
        }
    }

    async function candidatarTime(timeId) {
        try {
            const response = await fetch(`/api/times-projeto/${timeId}/candidatar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({})
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('Candidatura enviada com sucesso!');
                carregarTimesLocais();
            } else {
                alert(data.message || 'Erro ao candidatar-se.');
            }
        } catch (error) {
            console.error('Erro ao candidatar-se:', error);
            alert('Erro ao enviar candidatura.');
        }
    }

    if (btnCriarTime) {
        btnCriarTime.addEventListener('click', () => {
            // 🆕 ATUALIZADO: Permite profissionais também criarem times
            modalCriarTime?.classList.remove('hidden');
        });
    }

    // Adicionar/remover profissionais no formulário
    if (profissionaisLista) {
        document.addEventListener('click', (e) => {
            if (e.target.id === 'btn-adicionar-profissional') {
                const novoItem = document.createElement('div');
                novoItem.className = 'profissional-item';
                novoItem.innerHTML = `
                    <input type="text" placeholder="Tipo (ex: pedreiro)" class="tipo-profissional" required>
                    <input type="number" placeholder="Qtd" class="qtd-profissional" min="1" value="1" required>
                    <button type="button" class="btn-remover-profissional">&times;</button>
                `;
                profissionaisLista.appendChild(novoItem);
            }
            
            if (e.target.classList.contains('btn-remover-profissional')) {
                if (profissionaisLista.children.length > 1) {
                    e.target.closest('.profissional-item').remove();
                } else {
                    alert('Você precisa de pelo menos um profissional.');
                }
            }
        });
    }

    if (formCriarTime) {
        formCriarTime.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const profissionais = Array.from(profissionaisLista.children).map(item => ({
                tipo: item.querySelector('.tipo-profissional').value,
                quantidade: parseInt(item.querySelector('.qtd-profissional').value)
            }));
            
            const timeData = {
                titulo: document.getElementById('time-titulo').value,
                descricao: document.getElementById('time-descricao').value,
                localizacao: {
                    bairro: document.getElementById('time-bairro').value,
                    cidade: document.getElementById('time-cidade').value,
                    estado: document.getElementById('time-estado').value.toUpperCase()
                },
                profissionaisNecessarios: profissionais
            };
            
            try {
                const response = await fetch('/api/times-projeto', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(timeData)
                });
                
                const data = await response.json();
                
                if (data.success) {
                    alert('Time de projeto criado com sucesso!');
                    formCriarTime.reset();
                    modalCriarTime?.classList.add('hidden');
                    carregarTimesLocais();
                } else {
                    alert(data.message || 'Erro ao criar time.');
                }
            } catch (error) {
                console.error('Erro ao criar time:', error);
                alert('Erro ao criar time de projeto.');
            }
        });
    }

    // Fechar modais
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-close-modal')) {
            const modalId = e.target.dataset.modal;
            if (modalId) {
                document.getElementById(modalId)?.classList.add('hidden');
            }
        }
        
        // Fechar ao clicar fora do modal
        if (e.target.classList.contains('modal-overlay')) {
            e.target.classList.add('hidden');
        }
    });

    // --- INICIALIZAÇÃO ---
    // Verifica token novamente (pode ter sido removido durante o carregamento)
    const currentTokenCheck = localStorage.getItem('jwtToken');
    const currentUserIdCheck = localStorage.getItem('userId');
    
    if (!currentTokenCheck || !currentUserIdCheck) {
        if (!window.location.pathname.endsWith('/login') && !window.location.pathname.endsWith('/cadastro')) {
             window.location.href = '/login';
        }
    } else {
        if (postsContainer) {
            loadHeaderInfo();
            fetchPosts(); 
        }
        if (timesContainer) {
            carregarTimesLocais();
        }
    }
});

