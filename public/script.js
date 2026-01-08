document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('jwtToken');
    const userType = localStorage.getItem('userType');

    // Tratamento especial para /login: garantir que mostre sempre a página de login real
    if (path === '/login' || path === '/login/') {
        // Se NÃO estiver logado, força ir para o arquivo de login direto
        if (!token || !userId) {
            window.location.replace('/login.html');
        } else {
            // Se já estiver logado e tentar ir para o login, manda para o feed
            window.location.replace('/');
        }
        return;
    }

    // Tratamento especial para /cadastro: garantir que mostre sempre a página de cadastro real
    if (path === '/cadastro' || path === '/cadastro/') {
        // Se NÃO estiver logado, força ir para o arquivo de cadastro direto
        if (!token || !userId) {
            window.location.replace('/cadastro.html');
        } else {
            // Se já estiver logado e tentar ir para o cadastro, manda para o feed
            window.location.replace('/');
        }
        return;
    }


    // --- Elementos do Header ---
    const userAvatarHeader = document.getElementById('user-avatar-header');
    const userNameHeader = document.getElementById('user-name-header');
    const profileButton = document.getElementById('profile-button');
    const logoutButton = document.getElementById('logout-button');
    const searchInput = document.querySelector('.search');
    const searchToggleBtn = document.getElementById('search-toggle');
    const logoBox = document.querySelector('.logo-box');
    let searchResultsContainer = null;
    let searchResultsBackdrop = null;
    
    // --- Modais ---
    const logoutConfirmModal = document.getElementById('logout-confirm-modal');
    const confirmLogoutYesBtn = document.getElementById('confirm-logout-yes');
    const confirmLogoutNoBtn = document.getElementById('confirm-logout-no');

    // --- Elementos do Feed ---
    const postForm = document.getElementById('new-post-form');
    const postContentInput = document.getElementById('post-content-input');
    const postMediaInput = document.getElementById('post-media-input');
    const postFormMessage = document.getElementById('post-form-message');
    const postsContainer = document.getElementById('posts-container');
    
    // --- Filtros e Configurações ---
    const feedTipoSelect = document.getElementById('feed-tipo-select');
    const filtroCidadeInput = document.getElementById('filtro-cidade');
    const filtroCidadeBtn = document.getElementById('filtro-cidade-btn');
    const datalistCidades = document.getElementById('cidade-sugestoes');
    // Mantém o estado do filtro (para reaplicar após recarregar posts por cidade, etc.)
    let currentTipoFeed = 'todos';
    const destaquesScroll = document.getElementById('destaques-scroll');
    const modalDestaqueServico = document.getElementById('modal-destaque-servico');
    const destaqueModalImagens = document.getElementById('destaque-modal-imagens');
    const destaqueModalInfo = document.getElementById('destaque-modal-info');
    const destaqueModalPerfil = document.getElementById('destaque-modal-perfil');
    const btnDestaquesAvancar = document.getElementById('btn-destaques-avancar');
    const btnDestaquesVoltar = document.getElementById('btn-destaques-voltar');
    let destaquesCache = [];
    
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const mobileSidebarToggle = document.getElementById('mobile-sidebar-toggle');
    const htmlElement = document.documentElement; // O elemento <html>

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

    // ----------------------------------------------------------------------
    // TOGGLE DE BUSCA NO MOBILE
    // ----------------------------------------------------------------------
    if (searchToggleBtn && searchInput) {
        const headerEl = document.querySelector('header');
        searchToggleBtn.addEventListener('click', () => {
            if (!headerEl) return;
            headerEl.classList.toggle('search-open');
            if (headerEl.classList.contains('search-open')) {
                searchInput.focus();
            } else {
                // Ao fechar, limpa só o campo (não mexe no filtro ativo)
                // searchInput.value = '';
            }
        });
    }

    // ----------------------------------------------------------------------
    // --- CARREGAMENTO INICIAL ---
    function loadHeaderInfo() {
        const storedName = localStorage.getItem('userName') || '';
        const storedPhotoUrl = localStorage.getItem('userPhotoUrl');

        if (userNameHeader) {
            userNameHeader.textContent = storedName ? storedName.split(' ')[0] : '';
        }
        if (userAvatarHeader) {
            // Se não tem foto ou é inválida, usa a imagem padrão
            if (!storedPhotoUrl || storedPhotoUrl === 'undefined' || storedPhotoUrl === 'null') {
                userAvatarHeader.src = '/imagens/default-user.png';
                return; // Retorna cedo para não continuar o processamento
            } else if (!storedPhotoUrl.includes('pixabay')) {
                // Remove src primeiro para forçar reload completo
                userAvatarHeader.src = '';
                
                // Adiciona timestamp para evitar cache e garantir carregamento fresco
                const separator = storedPhotoUrl.includes('?') ? '&' : '?';
                const freshUrl = storedPhotoUrl + separator + '_t=' + Date.now();
                
                // Pré-carrega a imagem SEM usar crossOrigin (evita erros de CORS com S3)
                const preloadImg = new Image();
                
                preloadImg.onload = function () {
                    userAvatarHeader.src = freshUrl;
                    userAvatarHeader.loading = 'eager';
                    userAvatarHeader.decoding = 'sync';
                    
                    userAvatarHeader.style.opacity = '0';
                    setTimeout(() => {
                        userAvatarHeader.style.opacity = '1';
                        userAvatarHeader.offsetHeight;
                    }, 10);
                };
                
                preloadImg.onerror = function () {
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

    // ----------------------------------------------------------------------
    // DESTAQUES MINI (faixa tipo stories)
    // ----------------------------------------------------------------------
    function buildDemoDestaques() {
        const nomes = ['Ana', 'Bruno', 'Carla', 'Diego', 'Eva', 'Fábio', 'Gabi', 'Hugo', 'Iris', 'João'];
        return nomes.map((nome, idx) => {
            const img = `https://placehold.co/300x200?text=Trabalho+${idx+1}`;
            return {
                id: `demo-${idx}`,
                title: `Projeto ${idx + 1}`,
                description: 'Trabalho de demonstração',
                images: [img, img, img, img, img, img],
                thumbUrls: [img],
                user: {
                    _id: `demo-user-${idx}`,
                    nome: nome,
                    cidade: 'Sua cidade',
                    estado: 'BR',
                    mediaAvaliacao: 5
                },
                mediaAvaliacao: 5,
                totalValidacoes: 10,
                createdAt: new Date()
            };
        });
    }

    async function fetchDestaques() {
        if (!destaquesScroll) return;
        destaquesScroll.innerHTML = '<p class="mensagem-vazia" style="padding:8px 10px;margin:0;">Carregando...</p>';
        try {
            const response = await fetch('/api/destaques-servicos', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Erro ao carregar destaques');
            }
            const recebidos = data.destaques || [];
            destaquesCache = recebidos.length > 0 ? recebidos : buildDemoDestaques();
            renderDestaquesMini(destaquesCache);
            setTimeout(atualizarBotoesDestaques, 120);
        } catch (error) {
            console.error('Erro ao buscar destaques:', error);
            destaquesCache = buildDemoDestaques();
            renderDestaquesMini(destaquesCache);
            setTimeout(atualizarBotoesDestaques, 120);
        }
    }

    function renderDestaquesMini(lista) {
        if (!destaquesScroll) return;
        if (!lista || lista.length === 0) {
            destaquesScroll.innerHTML = '<p class="mensagem-vazia" style="padding:8px 10px;margin:0;">Ainda sem destaques. Poste fotos dos serviços!</p>';
            return;
        }

        destaquesScroll.innerHTML = '';

        lista.forEach(item => {
            const imagens = (item.thumbUrls && item.thumbUrls.length > 0) ? item.thumbUrls : (item.images || []);
            const primeira = imagens[0] || 'imagens/default-user.png';
            const extra = Math.max((imagens.length - 1), 0);
            const profissional = item.user || {};
            const nota = item.mediaAvaliacao || profissional.mediaAvaliacao || 0;
            
            const card = document.createElement('div');
            card.className = 'thumb-destaque';
            card.innerHTML = `
                <img src="${primeira}" alt="Destaque do serviço">
                <div class="thumb-overlay"></div>
                ${extra > 0 ? `<span class="thumb-more">+${extra}</span>` : ''}
                <span class="thumb-badge">${(profissional.nome || 'Profissional').split(' ')[0]}</span>
                <span class="thumb-note"><i class="fas fa-star" style="color:#f5a623;"></i> ${(nota || 0).toFixed(1)}</span>
            `;
            card.addEventListener('click', () => openDestaqueModal(item));
            destaquesScroll.appendChild(card);
        });
    }

    function openDestaqueModal(item) {
        if (!modalDestaqueServico || !destaqueModalImagens || !destaqueModalInfo) return;
        const imagens = (item.images || []).slice(0, 6);
        const thumbs = (item.thumbUrls || []).slice(0, 6);
        const fotos = thumbs.length ? thumbs : imagens;
        const profissional = item.user || {};
        const cidadeEstado = [profissional.cidade, profissional.estado].filter(Boolean).join(' - ');
        const nota = item.mediaAvaliacao || profissional.mediaAvaliacao || 0;

        destaqueModalImagens.innerHTML = fotos.map(img => `<img src="${img}" alt="Foto do serviço">`).join('');
        destaqueModalInfo.innerHTML = `
            <p class="destaque-prof" style="margin:0; font-weight:700;">${item.title || 'Serviço'}</p>
            <p class="destaque-local" style="margin:4px 0 0 0;">${profissional.nome || 'Profissional'} ${cidadeEstado ? '• ' + cidadeEstado : ''}</p>
            <p class="destaque-nota" style="margin:6px 0 0 0;"><i class="fas fa-star" style="color:#f5a623;"></i> ${(nota || 0).toFixed(1)}</p>
        `;

        const perfilId = profissional._id || item.userId || item.idUser;
        if (destaqueModalPerfil) {
            destaqueModalPerfil.onclick = () => {
                if (perfilId) window.location.href = `/perfil.html?id=${perfilId}`;
            };
        }

        modalDestaqueServico.classList.remove('hidden');
    }

    async function fetchPosts(cidade = null) {
        if (!postsContainer) return;
        let url = '/api/posts';
        if (cidade) {
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
            atualizarSugestoesCidades(posts);
            renderPosts(posts);
            // Reaplica o filtro atual após renderizar/recarregar o feed
            if (typeof filterFeed === 'function') {
                filterFeed(currentTipoFeed);
            }
        } catch (error) {
            console.error('Erro ao buscar postagens:', error);
            postsContainer.innerHTML = '<p class="mensagem-vazia">Erro ao carregar o feed.</p>';
        }
    }

    function atualizarSugestoesCidades(posts) {
        if (!datalistCidades) return;
        datalistCidades.innerHTML = '';
        if (!Array.isArray(posts) || posts.length === 0) return;

        const seen = new Map(); // key normalizada -> valor original

        posts.forEach((post) => {
            const cidade = post?.userId?.cidade;
            if (!cidade || typeof cidade !== 'string') return;
            const limpa = cidade.trim();
            if (!limpa) return;
            const key = limpa.toLowerCase();
            if (!seen.has(key)) seen.set(key, limpa);
        });

        const cidades = Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
        const frag = document.createDocumentFragment();
        cidades.forEach((c) => {
            const opt = document.createElement('option');
            opt.value = c;
            frag.appendChild(opt);
        });
        datalistCidades.appendChild(frag);
    }

    function renderPosts(posts) {
        if (!postsContainer) return;
        postsContainer.innerHTML = ''; 

        if (!posts || posts.length === 0) {
            postsContainer.innerHTML = '<p class="mensagem-vazia">Nenhuma postagem encontrada.</p>';
            return;
        }

        const isMobileAds = window.innerWidth <= 992;
        const anunciosFeed = [
            {
                titulo: 'Oferta para sua obra',
                loja: 'Loja de Tintas ColorMix',
                endereco: 'Av. Central, 123 - Centro',
                linkPerfil: '/perfil.html?id=empresa-demo',
                imagem: 'https://placehold.co/600x320?text=Tintas+ColorMix',
                linkMapa: 'https://www.google.com/maps/search/Loja+de+Tintas+ColorMix+Av+Central+123'
            },
            {
                titulo: 'Ferramentas em Promoção',
                loja: 'Casa do Construtor',
                endereco: 'Rua das Ferramentas, 50 - Centro',
                linkPerfil: '/perfil.html?id=empresa-ferramentas',
                imagem: 'https://placehold.co/600x320?text=Ferramentas',
                linkMapa: 'https://www.google.com/maps/search/Casa+do+Construtor+Rua+das+Ferramentas+50'
            },
            {
                titulo: 'Entrega de Material Rápida',
                loja: 'Depósito Constrular',
                endereco: 'Av. das Indústrias, 200',
                linkPerfil: '/perfil.html?id=empresa-material',
                imagem: 'https://placehold.co/600x320?text=Material+de+Obra',
                linkMapa: 'https://www.google.com/maps/search/Deposito+Constrular+Av+das+Industrias+200'
            }
        ];

        // Constrói feed e insere no máx. 1 anúncio a cada intervalo aleatório (5-10)
        const feedItems = [];
        const pool = isMobileAds ? [...anunciosFeed].sort(() => Math.random() - 0.5) : [];
        let idxAd = 0;
        let distancia = 0;
        let intervalo = 5 + Math.floor(Math.random() * 6); // 5..10

        posts.forEach((p) => {
            feedItems.push({ tipo: 'post', data: p });
            distancia += 1;

            if (isMobileAds && idxAd < pool.length && distancia >= intervalo) {
                feedItems.push({ tipo: 'ad', data: pool[idxAd] });
                idxAd += 1;
                distancia = 0;
                intervalo = 5 + Math.floor(Math.random() * 6);
            }
        });

        feedItems.forEach(entry => {
            if (entry.tipo === 'ad') {
                const ad = entry.data;
                const adEl = document.createElement('article');
                adEl.className = 'post anuncio-nativo-feed';
                adEl.innerHTML = `
                    <img src="${ad.imagem}" alt="" class="anuncio-nativo-img">
                    <div class="anuncio-nativo-overlay feed">
                        <div class="anuncio-nativo-badge">Anúncio</div>
                        <div class="anuncio-nativo-titulo">${ad.titulo}</div>
                        <div class="anuncio-nativo-loja">${ad.loja}</div>
                        <div class="anuncio-nativo-endereco">${ad.endereco}</div>
                        ${ad.linkMapa ? `<button class="btn-como-chegar" onclick="event.stopPropagation(); window.open('${ad.linkMapa}', '_blank')"><i class="fas fa-map-marker-alt"></i> Como chegar</button>` : ''}
                    </div>
                `;
                adEl.addEventListener('click', () => {
                    if (ad.linkPerfil) window.location.href = ad.linkPerfil;
                });
                postsContainer.appendChild(adEl);
                return;
            }

            const post = entry.data;
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
            const allComments = post.comments || [];
            const totalComments = allComments.length;
            const initialComments = allComments.slice(0, 2); // Mostra apenas os 2 primeiros
            const hasMoreComments = totalComments > 2;
            
            let commentsHTML = initialComments.map(comment => {
                if (!comment.userId) return '';
                
                // Verifica se o usuário pode deletar este comentário
                const isCommentOwner = comment.userId._id === userId;
                const canDeleteComment = isPostOwner || isCommentOwner;
                
                // Renderiza Respostas primeiro
                let repliesHTML = (comment.replies || []).map(reply => {
                    const isReplyOwner = reply.userId && reply.userId._id === userId;
                    const canDeleteReply = isPostOwner || isReplyOwner;
                    return renderReply(reply, comment._id, canDeleteReply);
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
                            <!-- Botão de deletar (visível para dono do post OU dono do comentário) -->
                            ${canDeleteComment ? `<button class="btn-delete-comment" data-comment-id="${comment._id}" title="Apagar comentário">
                                <i class="fas fa-trash"></i>
                            </button>` : ''}
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
            
            // Comentários adicionais (ocultos inicialmente)
            const remainingComments = allComments.slice(2);
            let hiddenCommentsHTML = remainingComments.map((comment, index) => {
                if (!comment.userId) return '';
                
                const isCommentOwner = comment.userId._id === userId;
                const canDeleteComment = isPostOwner || isCommentOwner;
                
                let repliesHTML = (comment.replies || []).map(reply => {
                    const isReplyOwner = reply.userId && reply.userId._id === userId;
                    const canDeleteReply = isPostOwner || isReplyOwner;
                    return renderReply(reply, comment._id, canDeleteReply);
                }).join('');

                const commentPhoto = comment.userId.foto || comment.userId.avatarUrl || 'imagens/default-user.png';
                const isCommentLiked = comment.likes && comment.likes.includes(userId);
                const replyCount = comment.replies?.length || 0;
                
                return `
                <div class="comment comment-hidden" data-comment-id="${comment._id}" data-comment-index="${index + 2}">
                    <img src="${commentPhoto.includes('pixabay') ? 'imagens/default-user.png' : commentPhoto}" alt="Avatar" class="comment-avatar">
                    <div class="comment-body-container">
                        <div class="comment-body">
                            <strong>${comment.userId.nome}</strong>
                            <p>${comment.content}</p>
                            ${canDeleteComment ? `<button class="btn-delete-comment" data-comment-id="${comment._id}" title="Apagar comentário">
                                <i class="fas fa-trash"></i>
                            </button>` : ''}
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
            
            // Botão "Carregar mais" se houver mais comentários
            const loadMoreHTML = hasMoreComments ? `<div class="load-more-comments" data-post-id="${post._id}" data-loaded="2" data-total="${totalComments}">Carregar mais</div>` : '';
            
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
                    <div class="comment-list">
                        ${commentsHTML}
                        ${hiddenCommentsHTML}
                        ${loadMoreHTML}
                    </div>
                    <div class="comment-form">
                        <textarea class="comment-input" placeholder="Escreva um comentário..." rows="1"></textarea>
                        <button class="btn-send-comment" data-post-id="${post._id}">Enviar</button>
                    </div>
                </div>
            `;
            postsContainer.appendChild(postElement);
        });

        setupPostListeners();
        
        // Verifica comentários longos após carregar posts
        setTimeout(() => {
            document.querySelectorAll('.comment').forEach(comment => {
                if (comment.offsetParent !== null) {
                    checkLongComment(comment);
                }
            });
        }, 500);
    }

    // 🛑 NOVO: Função para renderizar uma Resposta (Reply)
    function renderReply(reply, commentId, canDeleteReply) {
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
                    <!-- Botão de deletar (visível para dono do post OU dono da resposta) -->
                    ${canDeleteReply ? `<button class="btn-delete-reply" data-comment-id="${commentId}" data-reply-id="${reply._id}" title="Apagar resposta">
                        <i class="fas fa-trash"></i>
                    </button>` : ''}
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
                    // Abre diretamente o arquivo perfil.html com o ID,
                    // e o próprio perfil.js vai limpar a URL depois com o slug
                    window.location.href = `/perfil.html?id=${targetUserId}`;
                }
            });
        });
        
        // Ações do Post
        document.querySelectorAll('.btn-like').forEach(btn => btn.addEventListener('click', handleLikePost));
        document.querySelectorAll('.btn-comment').forEach(btn => btn.addEventListener('click', toggleCommentSection));
        document.querySelectorAll('.btn-send-comment').forEach(btn => btn.addEventListener('click', handleSendComment));
        
        // Auto-resize e Enter para enviar comentários
        document.querySelectorAll('.comment-input').forEach(textarea => {
            // Auto-resize ao digitar
            textarea.addEventListener('input', function() {
                autoResizeTextarea(this);
            });
            
            // Enter envia, Shift+Enter quebra linha
            textarea.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const postElement = this.closest('.post');
                    const sendBtn = postElement.querySelector('.btn-send-comment');
                    if (sendBtn) {
                        sendBtn.click();
                    }
                }
            });
        });
        
        // Revalida comentários longos ao redimensionar a janela
        let resizeTimeout;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                document.querySelectorAll('.comment').forEach(comment => {
                    checkLongComment(comment);
                });
            }, 200);
        });
        
        // 🛑 NOVO: Ações de Comentário
        document.querySelectorAll('.btn-like-comment').forEach(btn => btn.addEventListener('click', handleLikeComment));
        document.querySelectorAll('.btn-delete-comment').forEach(btn => btn.addEventListener('click', handleDeleteComment));
        document.querySelectorAll('.btn-show-reply-form').forEach(btn => btn.addEventListener('click', toggleReplyForm));
        document.querySelectorAll('.btn-toggle-replies').forEach(btn => btn.addEventListener('click', toggleReplyList));
        document.querySelectorAll('.btn-send-reply').forEach(btn => btn.addEventListener('click', handleSendReply));

        // 🛑 NOVO: Ações de Resposta
        document.querySelectorAll('.btn-like-reply').forEach(btn => btn.addEventListener('click', handleLikeReply));
        document.querySelectorAll('.btn-delete-reply').forEach(btn => btn.addEventListener('click', handleDeleteReply));
        
        // Botão "Carregar mais" comentários (carrega 5 por vez)
        document.querySelectorAll('.load-more-comments').forEach(btn => {
            btn.addEventListener('click', function() {
                const postId = this.dataset.postId;
                const postElement = this.closest('.post');
                const currentlyLoaded = parseInt(this.dataset.loaded) || 2;
                const totalComments = parseInt(this.dataset.total) || 0;
                const nextBatch = currentlyLoaded + 5;
                
                // Mostra os próximos 5 comentários (ou menos se não houver 5)
                const hiddenComments = Array.from(postElement.querySelectorAll('.comment-hidden'));
                const commentsToShow = hiddenComments.slice(0, 5);
                
                commentsToShow.forEach(comment => {
                    comment.classList.remove('comment-hidden');
                    // Garante que comentários recém-visíveis não tenham estilos inline de limite
                    const commentText = comment.querySelector('.comment-body p');
                    if (commentText) {
                        commentText.style.maxHeight = '';
                        commentText.style.overflow = '';
                        commentText.style.overflowY = '';
                        commentText.style.height = '';
                    }
                });
                
                // Atualiza o contador de comentários carregados
                const newLoadedCount = Math.min(nextBatch, totalComments);
                this.dataset.loaded = newLoadedCount;
                
                // Se ainda houver mais comentários, mantém o botão, senão remove
                if (newLoadedCount >= totalComments) {
                    this.remove();
                } else {
                    // Atualiza o texto se necessário (opcional)
                    // this.textContent = `Carregar mais (${totalComments - newLoadedCount} restantes)`;
                }
                
                // Reconfigura listeners dos novos comentários visíveis
                commentsToShow.forEach(commentElement => {
                    const commentId = commentElement.dataset.commentId;
                    const likeBtn = commentElement.querySelector('.btn-like-comment');
                    const deleteBtn = commentElement.querySelector('.btn-delete-comment');
                    const replyFormBtn = commentElement.querySelector('.btn-show-reply-form');
                    const toggleRepliesBtn = commentElement.querySelector('.btn-toggle-replies');
                    const sendReplyBtn = commentElement.querySelector('.btn-send-reply');
                    
                    if (likeBtn) likeBtn.addEventListener('click', handleLikeComment);
                    if (deleteBtn) deleteBtn.addEventListener('click', handleDeleteComment);
                    if (replyFormBtn) replyFormBtn.addEventListener('click', toggleReplyForm);
                    if (toggleRepliesBtn) toggleRepliesBtn.addEventListener('click', toggleReplyList);
                    if (sendReplyBtn) sendReplyBtn.addEventListener('click', handleSendReply);
                });
                
                // Verifica comentários longos após um delay maior para garantir renderização completa
                setTimeout(() => {
                    commentsToShow.forEach(commentElement => {
                        // Aguarda o elemento estar visível antes de verificar
                        if (commentElement.offsetParent !== null) {
                            checkLongComment(commentElement);
                        }
                    });
                }, 500);
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


    // --- Estado de imagens selecionadas na criação de post ---
    const btnSelecionarFotoPost = document.getElementById('btn-selecionar-foto-post');
    const btnAdicionarFotoPost = document.getElementById('btn-adicionar-foto-post');
    const previewFotosPost = document.getElementById('preview-fotos-post');
    const fotosPostSelecionadas = [];

    function atualizarVisibilidadeBotoesPost() {
        const temFotos = fotosPostSelecionadas.length > 0;
        if (btnSelecionarFotoPost) {
            btnSelecionarFotoPost.style.display = temFotos ? 'none' : 'inline-flex';
        }
        if (btnAdicionarFotoPost) {
            btnAdicionarFotoPost.style.display = temFotos ? 'inline-flex' : 'none';
        }
    }

    function criarThumbnailPost(file) {
        if (!previewFotosPost) return;

        const item = document.createElement('div');
        item.className = 'post-foto-item';

        const img = document.createElement('img');
        const btnRemover = document.createElement('button');
        btnRemover.type = 'button';
        btnRemover.className = 'post-foto-remove';
        btnRemover.innerHTML = '&times;';

        item.appendChild(img);
        item.appendChild(btnRemover);
        previewFotosPost.appendChild(item);

        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);

        btnRemover.addEventListener('click', () => {
            const idx = fotosPostSelecionadas.indexOf(file);
            if (idx !== -1) {
                fotosPostSelecionadas.splice(idx, 1);
            }
            item.remove();
            atualizarVisibilidadeBotoesPost();
            if (postMediaInput && fotosPostSelecionadas.length === 0) {
                postMediaInput.value = '';
            }
        });
    }

    if (postMediaInput && btnSelecionarFotoPost) {
        const abrirSeletorPost = () => postMediaInput.click();

        btnSelecionarFotoPost.addEventListener('click', abrirSeletorPost);
        if (btnAdicionarFotoPost) {
            btnAdicionarFotoPost.addEventListener('click', abrirSeletorPost);
        }

        postMediaInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files || []);
            if (!files.length) return;

            files.forEach((file) => {
                if (!file.type.startsWith('image/')) return;
                if (!fotosPostSelecionadas.includes(file)) {
                    fotosPostSelecionadas.push(file);
                    criarThumbnailPost(file);
                }
            });

            atualizarVisibilidadeBotoesPost();
        });
    }

    if (postForm) {
        postForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const content = postContentInput.value;
            const temMidia = fotosPostSelecionadas.length > 0 || (postMediaInput && postMediaInput.files && postMediaInput.files.length > 0);

            if (!content && !temMidia) {
                showMessage(postFormMessage, 'Você precisa adicionar um texto ou uma foto.', 'error');
                return;
            }
            const formData = new FormData();
            formData.append('content', content);
            // Envia apenas a primeira imagem como mídia principal (backend atual aceita um campo 'media')
            const fotoPrincipal = fotosPostSelecionadas[0] || (postMediaInput.files && postMediaInput.files[0]) || null;
            if (fotoPrincipal) {
                formData.append('media', fotoPrincipal);
            }
            
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
                    // Limpa seleção de fotos e thumbnails
                    fotosPostSelecionadas.length = 0;
                    if (previewFotosPost) {
                        previewFotosPost.innerHTML = '';
                    }
                    if (postMediaInput) {
                        postMediaInput.value = '';
                    }
                    atualizarVisibilidadeBotoesPost();
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
    
    function filterFeed(tipo) {
        currentTipoFeed = tipo || 'todos';
        document.querySelectorAll('.post').forEach(post => {
            if (currentTipoFeed === 'todos') {
                post.style.display = 'block';
            } else {
                if (post.dataset.userType === currentTipoFeed) {
                    post.style.display = 'block';
                } else {
                    post.style.display = 'none';
                }
            }
        });

        // Mantém o select sincronizado (ex.: quando reaplica após fetchPosts)
        if (feedTipoSelect && feedTipoSelect.value !== currentTipoFeed) {
            feedTipoSelect.value = currentTipoFeed;
        }
    }

    if (feedTipoSelect) {
        // Inicializa (caso o HTML mude o selected)
        currentTipoFeed = feedTipoSelect.value || 'todos';
        
        // Ajusta a largura do select conforme o texto selecionado (Todos/Clientes/Profissionais)
        function ajustarLarguraSelectTipo() {
            if (!feedTipoSelect) return;

            // Em mobile o CSS já força 100%
            if (window.innerWidth <= 767) {
                feedTipoSelect.style.width = '';
                return;
            }

            const selectedText = feedTipoSelect.options[feedTipoSelect.selectedIndex]?.text || '';
            const span = document.createElement('span');
            const cs = window.getComputedStyle(feedTipoSelect);

            span.style.position = 'absolute';
            span.style.visibility = 'hidden';
            span.style.whiteSpace = 'nowrap';
            span.style.font = cs.font;
            span.textContent = selectedText;
            document.body.appendChild(span);

            const textWidth = span.getBoundingClientRect().width;
            document.body.removeChild(span);

            // Soma uma folga para paddings + seta do select
            const extra = 34;
            feedTipoSelect.style.width = `${Math.ceil(textWidth + extra)}px`;
        }

        ajustarLarguraSelectTipo();
        window.addEventListener('resize', ajustarLarguraSelectTipo);

        feedTipoSelect.addEventListener('change', () => {
            filterFeed(feedTipoSelect.value || 'todos');
            ajustarLarguraSelectTipo();
        });
    }

    // ----------------------------------------------------------------------
    // BOTÃO LATERAL (MOBILE) PARA ABRIR CATEGORIAS / AÇÕES RÁPIDAS / TIMES
    // ----------------------------------------------------------------------
    const categoriasAside = document.querySelector('.categorias');
    console.log('🔍 Elemento categorias encontrado:', categoriasAside);
    const mobileSidebarClose = document.getElementById('mobile-sidebar-close');
    let mobileSidebarBackdrop = null;

    if (mobileSidebarToggle && categoriasAside) {
        console.log('🔧 Botão de filtros encontrado, configurando...');
        mobileSidebarBackdrop = document.createElement('div');
        mobileSidebarBackdrop.id = 'mobile-sidebar-backdrop';
        document.body.appendChild(mobileSidebarBackdrop);

        function isMediaScreen() {
            return window.innerWidth >= 769 && window.innerWidth <= 992;
        }

        function fecharSidebarMobile() {
            console.log('🔒 Fechando sidebar...');
            categoriasAside.classList.remove('aberta');
            
            // Remover listener de clique fora quando fechar
            if (outsideClickHandler) {
                document.removeEventListener('click', outsideClickHandler);
                outsideClickHandler = null;
            }
            
            if (!isMediaScreen()) {
                mobileSidebarBackdrop.classList.remove('visible');
                mobileSidebarToggle.classList.remove('hidden');
            }
        }

        // Função para fechar sidebar quando modal é aberto (apenas em telas médias)
        // Torna a função global para acesso de outros scripts
        window.fecharSidebarSeMedia = function() {
            if (isMediaScreen() && categoriasAside.classList.contains('aberta')) {
                fecharSidebarMobile();
            }
        };

        function abrirSidebarMobile() {
            console.log('🔓 Abrindo sidebar...', 'isMediaScreen:', isMediaScreen());
            
            // Configura listener de clique fora para todas as telas
            setupOutsideClickHandler();
            
            if (isMediaScreen()) {
                // Primeiro adicionar a classe para mostrar
                categoriasAside.classList.add('aberta');
                
                // Posicionar dropdown abaixo do botão em telas médias
                // Usar requestAnimationFrame para garantir que o DOM seja atualizado
                requestAnimationFrame(() => {
                    const toggleRect = mobileSidebarToggle.getBoundingClientRect();
                    console.log('📍 Posicionando dropdown:', toggleRect);
                    
                    // Definir posição explicitamente
                    categoriasAside.style.position = 'fixed';
                    categoriasAside.style.top = `${toggleRect.bottom + 8}px`;
                    categoriasAside.style.left = `${toggleRect.left}px`;
                    categoriasAside.style.right = 'auto';
                    categoriasAside.style.bottom = 'auto';
                    categoriasAside.style.display = 'block';
                    categoriasAside.style.visibility = 'visible';
                    categoriasAside.style.opacity = '1';
                    categoriasAside.style.pointerEvents = 'auto';
                    categoriasAside.style.zIndex = '9999';
                    
                    // Verificar se o elemento está visível após aplicar os estilos
                    requestAnimationFrame(() => {
                        const rect = categoriasAside.getBoundingClientRect();
                        const isVisible = rect.width > 0 && rect.height > 0 && 
                                         rect.top >= 0 && rect.left >= 0 &&
                                         rect.top < window.innerHeight && 
                                         rect.left < window.innerWidth;
                        
                        console.log('✅ Estilos aplicados:', {
                            top: categoriasAside.style.top,
                            left: categoriasAside.style.left,
                            display: categoriasAside.style.display,
                            visibility: categoriasAside.style.visibility,
                            opacity: categoriasAside.style.opacity,
                            zIndex: categoriasAside.style.zIndex,
                            rect: rect,
                            isVisible: isVisible
                        });
                        
                        if (!isVisible) {
                            console.warn('⚠️ Dropdown pode estar fora da viewport!', rect);
                        }
                    });
                });
            } else {
                categoriasAside.classList.add('aberta');
                mobileSidebarBackdrop.classList.add('visible');
                mobileSidebarToggle.classList.add('hidden');
            }
        }

        let isOpening = false;
        let isProcessing = false;
        let clickTimeout = null;
        let outsideClickHandler = null;
        let lastClickTime = 0;
        const CLICK_DEBOUNCE = 300; // Tempo mínimo entre cliques em ms

        function setupOutsideClickHandler() {
            // Remover listener anterior se existir
            if (outsideClickHandler) {
                document.removeEventListener('click', outsideClickHandler);
                outsideClickHandler = null;
            }
            
            outsideClickHandler = (e) => {
                // Ignorar se estiver abrindo ou processando
                if (isOpening || isProcessing) {
                    return;
                }
                
                // Verifica se o menu está aberto
                if (!categoriasAside.classList.contains('aberta')) {
                    return;
                }
                
                const clickedElement = e.target;
                
                // Verifica se clicou dentro do menu
                if (categoriasAside.contains(clickedElement)) {
                    return;
                }
                
                // Verifica se clicou no botão de abrir/fechar
                if (mobileSidebarToggle && mobileSidebarToggle.contains(clickedElement)) {
                    return;
                }
                
                // Verifica se clicou no botão de fechar
                if (mobileSidebarClose && mobileSidebarClose.contains(clickedElement)) {
                    return;
                }
                
                // Em telas menores, verifica se clicou no backdrop (isso já fecha automaticamente)
                if (!isMediaScreen() && mobileSidebarBackdrop && 
                    (mobileSidebarBackdrop.contains(clickedElement) || clickedElement === mobileSidebarBackdrop)) {
                    return;
                }
                
                // Se chegou aqui, clicou fora - fecha o menu
                console.log('✅ Fechando menu - clique fora detectado');
                fecharSidebarMobile();
            };
            
            // Adiciona o listener imediatamente quando o menu está aberto
            // Usa um pequeno delay para evitar capturar o clique do botão que abriu
            setTimeout(() => {
                if (categoriasAside.classList.contains('aberta')) {
                    document.addEventListener('click', outsideClickHandler, true);
                    console.log('✅ Listener de clique fora adicionado');
                }
            }, 50);
        }

        mobileSidebarToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            const now = Date.now();
            const timeSinceLastClick = now - lastClickTime;
            
            // Debounce: ignorar cliques muito próximos
            if (timeSinceLastClick < CLICK_DEBOUNCE) {
                console.log(`⏸️ Clique ignorado - muito rápido (${timeSinceLastClick}ms)`);
                return;
            }
            
            // Prevenir múltiplos cliques rápidos
            if (isProcessing || isOpening) {
                console.log('⏸️ Clique ignorado - já processando ou abrindo');
                return;
            }
            
            // Verificar estado atual antes de processar
            const isCurrentlyOpen = categoriasAside.classList.contains('aberta');
            
            lastClickTime = now;
            console.log('🖱️ Botão clicado!', 'Estado atual:', isCurrentlyOpen ? 'aberto' : 'fechado');
            isProcessing = true;
            
            // Limpar timeout anterior se existir
            if (clickTimeout) {
                clearTimeout(clickTimeout);
                clickTimeout = null;
            }
            
            if (isCurrentlyOpen) {
                console.log('🔒 Fechando dropdown...');
                fecharSidebarMobile();
                setTimeout(() => {
                    isProcessing = false;
                }, 200);
            } else {
                console.log('🔓 Abrindo dropdown...');
                isOpening = true;
                abrirSidebarMobile();
                
                // Configurar listener de clique fora apenas quando abrir
                setupOutsideClickHandler();
                
                // Delay maior para garantir que o evento de clique fora não interfira
                clickTimeout = setTimeout(() => {
                    isOpening = false;
                    isProcessing = false;
                    clickTimeout = null;
                    console.log('✅ Dropdown totalmente aberto e pronto');
                }, 600);
            }
        }, { capture: true, once: false }); // Usar capture: true para garantir que seja processado primeiro

        if (mobileSidebarClose) {
            mobileSidebarClose.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                fecharSidebarMobile();
            });
        }

        mobileSidebarBackdrop.addEventListener('click', fecharSidebarMobile);

        // Reposicionar dropdown ao rolar ou redimensionar em telas médias
        function reposicionarDropdown() {
            if (isMediaScreen() && categoriasAside.classList.contains('aberta')) {
                const toggleRect = mobileSidebarToggle.getBoundingClientRect();
                categoriasAside.style.top = `${toggleRect.bottom + 8}px`;
                categoriasAside.style.left = `${toggleRect.left}px`;
            }
        }

        window.addEventListener('scroll', reposicionarDropdown, true);
        window.addEventListener('resize', () => {
            if (isMediaScreen() && categoriasAside.classList.contains('aberta')) {
                reposicionarDropdown();
            } else if (!isMediaScreen()) {
                // Se mudou para outra resolução, fechar dropdown
                fecharSidebarMobile();
            }
        });

        // Observer para fechar sidebar quando qualquer modal é aberto (apenas em telas médias)
        const observerModais = new MutationObserver((mutations) => {
            if (!isMediaScreen()) return;
            if (!categoriasAside.classList.contains('aberta')) return;
            
            mutations.forEach((mutation) => {
                // Verifica mudanças na classe 'hidden' de modais existentes
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const target = mutation.target;
                    if ((target.classList?.contains('modal-overlay') || target.classList?.contains('modal')) &&
                        !target.classList.contains('hidden')) {
                        fecharSidebarMobile();
                    }
                }
                
                // Verifica se novos modais foram adicionados
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        const isModal = node.classList?.contains('modal-overlay') || 
                                       node.classList?.contains('modal') ||
                                       (node.querySelector && (node.querySelector('.modal-overlay') || node.querySelector('.modal')));
                        
                        if (isModal) {
                            const modalElement = node.classList?.contains('modal-overlay') || node.classList?.contains('modal') 
                                ? node 
                                : node.querySelector('.modal-overlay') || node.querySelector('.modal');
                            
                            if (modalElement && !modalElement.classList.contains('hidden')) {
                                fecharSidebarMobile();
                            }
                        }
                    }
                });
            });
        });

        // Observa o body para detectar quando modais são abertos (classe hidden removida)
        observerModais.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
    }

    if (filtroCidadeBtn && filtroCidadeInput) {
        filtroCidadeBtn.addEventListener('click', () => {
            const cidade = filtroCidadeInput.value.trim();
            fetchPosts(cidade || null); // Busca todos se o campo estiver vazio
        });

        // Enter no campo também dispara a busca (mais rápido e natural)
        filtroCidadeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                filtroCidadeBtn.click();
            }
        });

        // Autocomplete de cidades (servidor) conforme digita
        let sugestaoCidadeTimer = null;
        filtroCidadeInput.addEventListener('input', () => {
            if (!datalistCidades) return;
            const termo = filtroCidadeInput.value.trim();

            if (sugestaoCidadeTimer) clearTimeout(sugestaoCidadeTimer);
            sugestaoCidadeTimer = setTimeout(async () => {
                if (!termo || termo.length < 1) return;
                try {
                    const resp = await fetch(`/api/cidades?q=${encodeURIComponent(termo)}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await resp.json();
                    if (!resp.ok || !data?.success) return;

                    datalistCidades.innerHTML = '';
                    const cidades = Array.isArray(data.cidades) ? data.cidades : [];
                    const frag = document.createDocumentFragment();
                    cidades.forEach((c) => {
                        if (!c) return;
                        const opt = document.createElement('option');
                        opt.value = c;
                        frag.appendChild(opt);
                    });
                    datalistCidades.appendChild(frag);
                } catch (err) {
                    // Se falhar, mantém as sugestões locais já existentes
                    console.warn('Falha ao buscar sugestões de cidades:', err);
                }
            }, 180);
        });
    }

    // ----------------------------------------------------------------------
    // BUSCA RÁPIDA NO CABEÇALHO (serviços / profissionais no feed)
    // ----------------------------------------------------------------------
    function aplicarFiltroBusca(term) {
        const termo = (term || '').trim().toLowerCase();
        const posts = document.querySelectorAll('.post');

        posts.forEach(post => {
            if (!termo) {
                post.style.display = 'block';
                return;
            }

            const textoPost = post.querySelector('.post-content')?.innerText.toLowerCase() || '';
            const nomeAutor = post.querySelector('.user-name')?.innerText.toLowerCase() || '';
            const cidadeAutor = post.querySelector('.post-author-city')?.innerText.toLowerCase() || '';

            const corresponde = textoPost.includes(termo) ||
                                nomeAutor.includes(termo) ||
                                cidadeAutor.includes(termo);

            post.style.display = corresponde ? 'block' : 'none';
        });
    }

    if (searchInput) {
        // Cria container de resultados de busca abaixo do header
        const headerElement = document.querySelector('header');
        if (!document.getElementById('search-results')) {
            searchResultsContainer = document.createElement('div');
            searchResultsContainer.id = 'search-results';
            searchResultsContainer.innerHTML = '';
            if (headerElement) headerElement.appendChild(searchResultsContainer);
        } else {
            searchResultsContainer = document.getElementById('search-results');
        }

        // Backdrop escuro atrás dos resultados
        if (!document.getElementById('search-results-backdrop')) {
            searchResultsBackdrop = document.createElement('div');
            searchResultsBackdrop.id = 'search-results-backdrop';
            document.body.appendChild(searchResultsBackdrop);

            searchResultsBackdrop.addEventListener('click', () => {
                // Ao clicar fora, limpa resultados e esconde o fundo escurecido
                if (searchResultsContainer) searchResultsContainer.innerHTML = '';
                searchResultsBackdrop.classList.remove('visible');
            });
        } else {
            searchResultsBackdrop = document.getElementById('search-results-backdrop');
        }

        async function buscarNoServidor(termo) {
            const q = (termo || '').trim();
            if (!q) {
                if (searchResultsContainer) searchResultsContainer.innerHTML = '';
                if (searchResultsBackdrop) searchResultsBackdrop.classList.remove('visible');
                return;
            }

            try {
                const response = await fetch(`/api/busca?q=${encodeURIComponent(q)}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                const data = await response.json();
                if (!response.ok || !data.success) {
                    console.error('Erro na busca:', data.message);
                    return;
                }
                renderSearchResults(data, q);
            } catch (err) {
                console.error('Erro ao chamar /api/busca:', err);
            }
        }

        function renderSearchResults(data, termo) {
            if (!searchResultsContainer) return;

            const { usuarios = [], servicos = [], posts = [] } = data;

            if (usuarios.length === 0 && servicos.length === 0 && posts.length === 0) {
                searchResultsContainer.innerHTML = `
                    <div class="search-results-empty">
                        Nenhum resultado para "<strong>${termo}</strong>".
                    </div>
                `;
                if (searchResultsBackdrop) searchResultsBackdrop.classList.add('visible');
                return;
            }

            let html = '<div class="search-results-box">';

            if (usuarios.length > 0) {
                html += '<div class="search-section"><h4>Usuários</h4>';
                usuarios.forEach(u => {
                    const foto = u.avatarUrl || u.foto || 'imagens/default-user.png';
                    const cidadeEstado = [u.cidade, u.estado].filter(Boolean).join(' - ');
                    html += `
                        <div class="search-item search-user" data-user-id="${u._id}">
                            <img src="${foto}" alt="${u.nome}" class="search-avatar">
                            <div>
                                <div class="search-title">${u.nome}</div>
                                <div class="search-subtitle">
                                    ${u.atuacao || ''} ${cidadeEstado ? '• ' + cidadeEstado : ''}
                                </div>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
            }

            if (servicos.length > 0) {
                html += '<div class="search-section"><h4>Serviços</h4>';
                servicos.forEach(s => {
                    html += `
                        <div class="search-item search-servico">
                            <div>
                                <div class="search-title">${s.title || 'Serviço'}</div>
                                <div class="search-subtitle">${(s.description || '').slice(0, 80)}...</div>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
            }

            if (posts.length > 0) {
                html += '<div class="search-section"><h4>Postagens</h4>';
                posts.forEach(p => {
                    const autor = p.userId || {};
                    const fotoAutor = autor.avatarUrl || autor.foto || 'imagens/default-user.png';
                    html += `
                        <div class="search-item search-post">
                            <img src="${fotoAutor}" alt="${autor.nome || ''}" class="search-avatar">
                            <div>
                                <div class="search-title">${autor.nome || 'Usuário'}</div>
                                <div class="search-subtitle">${(p.content || '').slice(0, 80)}...</div>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
            }

            html += '</div>';
            searchResultsContainer.innerHTML = html;

            if (searchResultsBackdrop) searchResultsBackdrop.classList.add('visible');

            // Clique em usuário → abre perfil
            searchResultsContainer.querySelectorAll('.search-user').forEach(item => {
                item.addEventListener('click', () => {
                    const targetUserId = item.dataset.userId;
                    if (targetUserId) {
                        window.location.href = `/perfil.html?id=${targetUserId}`;
                    }
                });
            });
        }

        let buscaTimeout = null;

        // Filtra enquanto digita (com pequeno atraso para não travar)
        searchInput.addEventListener('input', () => {
            const valor = searchInput.value;
            clearTimeout(buscaTimeout);
            buscaTimeout = setTimeout(() => {
                aplicarFiltroBusca(valor);   // Filtro local no feed
                buscarNoServidor(valor);     // Busca global (usuários/serviços/posts)
            }, 200);
        });

        // Enter também dispara a busca imediatamente
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const valor = searchInput.value;
                aplicarFiltroBusca(valor);
                buscarNoServidor(valor);
            }
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

    // Função para verificar se um comentário é longo e precisa de "Carregar comentário"
    function checkLongComment(commentElement) {
        if (window.innerWidth > 767) {
            // Em telas maiores, remove qualquer limite que possa ter sido aplicado
            const commentText = commentElement.querySelector('.comment-body p');
            if (commentText) {
                commentText.classList.remove('comment-long', 'expanded');
                const loadBtn = commentText.querySelector('.load-comment-text');
                if (loadBtn) loadBtn.remove();
            }
            return;
        }
        
        const commentText = commentElement.querySelector('.comment-body p');
        if (!commentText) return;
        
        // Remove classes anteriores para medir corretamente
        commentText.classList.remove('comment-long', 'expanded');
        const existingLoadBtn = commentText.querySelector('.load-comment-text');
        if (existingLoadBtn) existingLoadBtn.remove();
        
        // Força remoção de qualquer estilo inline que possa interferir
        commentText.style.maxHeight = '';
        commentText.style.height = '';
        commentText.style.overflow = '';
        commentText.style.overflowY = '';
        commentText.style.overflowX = '';
        
        // Aguarda um frame para garantir que o navegador renderizou
        requestAnimationFrame(() => {
            // Mede a altura real do texto sem limite
            const computedStyle = window.getComputedStyle(commentText);
            const lineHeight = parseFloat(computedStyle.lineHeight) || 22;
            const maxLines = 5;
            const maxHeight = lineHeight * maxLines;
            
            // Altura real do conteúdo
            const actualHeight = commentText.scrollHeight;
            
            if (actualHeight > maxHeight) {
                // Comentário é longo, aplica limite e adiciona botão "Carregar comentário"
                commentText.classList.add('comment-long');
                
                // Encontra o container do comentário para adicionar o botão após o parágrafo
                const commentBody = commentText.closest('.comment-body');
                if (commentBody) {
                    // Garante que o botão não existe antes de adicionar
                    const existingBtn = commentBody.querySelector('.load-comment-text');
                    if (existingBtn) existingBtn.remove();
                    
                    const loadBtn = document.createElement('span');
                    loadBtn.className = 'load-comment-text';
                    loadBtn.textContent = 'Carregar comentário';
                    loadBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        e.preventDefault();
                        commentText.classList.add('expanded');
                        commentText.style.maxHeight = 'none';
                        commentText.style.overflow = 'visible';
                        commentText.style.display = 'block';
                        commentText.style.webkitLineClamp = 'unset';
                        commentText.style.webkitBoxOrient = 'unset';
                        this.remove();
                    });
                    // Adiciona o botão após o parágrafo, dentro do comment-body
                    commentBody.insertBefore(loadBtn, commentText.nextSibling);
                }
            } else {
                // Garante que comentários curtos não tenham limite
                commentText.classList.remove('comment-long', 'expanded');
                commentText.style.maxHeight = '';
                commentText.style.overflow = '';
                commentText.style.overflowY = '';
                commentText.style.overflowX = '';
                commentText.style.height = '';
            }
        });
    }

    // Função para auto-resize do textarea
    function autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        const scrollHeight = textarea.scrollHeight;
        const maxHeight = window.innerWidth <= 767 ? 66 : 200; // 3 linhas em mobile, mais em desktop
        textarea.style.height = Math.min(scrollHeight, maxHeight) + 'px';
    }

    function toggleCommentSection(e) {
        const btn = e.currentTarget;
        const postElement = btn.closest('.post');
        const commentsSection = postElement.querySelector('.post-comments');
        commentsSection.classList.toggle('visible');
        if (commentsSection.classList.contains('visible')) {
            const textarea = commentsSection.querySelector('.comment-input');
            if (textarea) {
                textarea.focus();
                // Inicializa altura do textarea
                textarea.style.height = (window.innerWidth <= 767 ? 44 : 50) + 'px';
            }
            // Verifica comentários longos após abrir
            setTimeout(() => {
                const comments = commentsSection.querySelectorAll('.comment');
                comments.forEach(comment => {
                    if (comment.offsetParent !== null) {
                        checkLongComment(comment);
                    }
                });
            }, 300);
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
                // O usuário que acabou de criar o comentário sempre é o dono dele
                const isCommentOwner = comment.userId._id === userId;
                const canDeleteComment = isPostOwner || isCommentOwner;

                const newCommentHTML = `
                <div class="comment" data-comment-id="${comment._id}">
                    <img src="${commentPhoto.includes('pixabay') ? 'imagens/default-user.png' : commentPhoto}" alt="Avatar" class="comment-avatar">
                    <div class="comment-body-container">
                        <div class="comment-body">
                            <strong>${comment.userId.nome}</strong>
                            <p>${comment.content}</p>
                            ${canDeleteComment ? `<button class="btn-delete-comment" data-comment-id="${comment._id}" title="Apagar comentário">
                                <i class="fas fa-trash"></i>
                            </button>` : ''}
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
                
                // Verifica se o novo comentário é longo após renderização
                setTimeout(() => {
                    if (newCommentElement.offsetParent !== null) {
                        checkLongComment(newCommentElement);
                    }
                }, 300);
                
                // Limpa e reseta o textarea
                input.value = '';
                input.style.height = 'auto';
                input.style.height = (window.innerWidth <= 767 ? 44 : 50) + 'px';
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
        const userId = localStorage.getItem('userId');

        // Log no frontend para debug
        console.log('🗑️ Tentando deletar comentário:', {
            postId,
            commentId,
            userId,
            url: `/api/posts/${postId}/comments/${commentId}`
        });

        if (!confirm('Tem certeza que deseja apagar este comentário?')) return;

        try {
            const response = await fetch(`/api/posts/${postId}/comments/${commentId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            
            console.log('📥 Resposta do servidor:', {
                status: response.status,
                success: data.success,
                message: data.message
            });
            
            if (data.success) {
                btn.closest('.comment').remove(); // Remove o comentário do DOM
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('❌ Erro ao deletar comentário:', error);
            alert('Erro: ' + error.message);
        }
    }

    async function handleDeleteReply(e) {
        const btn = e.currentTarget;
        const commentId = btn.dataset.commentId;
        const replyId = btn.dataset.replyId;
        const postId = btn.closest('.post').dataset.postId;
        const userId = localStorage.getItem('userId');

        // Log no frontend para debug
        console.log('🗑️ Tentando deletar resposta:', {
            postId,
            commentId,
            replyId,
            userId,
            url: `/api/posts/${postId}/comments/${commentId}/replies/${replyId}`
        });

        if (!confirm('Tem certeza que deseja apagar esta resposta?')) return;

        try {
            const response = await fetch(`/api/posts/${postId}/comments/${commentId}/replies/${replyId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            
            console.log('📥 Resposta do servidor:', {
                status: response.status,
                success: data.success,
                message: data.message
            });
            
            if (data.success) {
                btn.closest('.reply').remove(); // Remove a resposta do DOM
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('❌ Erro ao deletar resposta:', error);
            alert('Erro: ' + error.message);
        }
    }

    // --- NAVEGAÇÃO DO HEADER ---
    // Navegação para o perfil: botão (quando existir) e avatar
    if (profileButton) {
        profileButton.addEventListener('click', () => {
            window.location.href = `/perfil.html?id=${userId}`;
        });
    }
    if (userAvatarHeader) {
        userAvatarHeader.style.cursor = 'pointer';
        userAvatarHeader.addEventListener('click', () => {
            if (userId) {
                window.location.href = `/perfil.html?id=${userId}`;
            }
        });
    }

    // Nome do usuário no cabeçalho também leva para o próprio perfil
    if (userNameHeader) {
        userNameHeader.style.cursor = 'pointer';
        userNameHeader.addEventListener('click', () => {
            if (userId) {
                window.location.href = `/perfil.html?id=${userId}`;
            }
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
            // Fecha todos os modais antes de fazer logout
            const modalPropostas = document.getElementById('modal-propostas');
            if (modalPropostas) {
                modalPropostas.classList.add('hidden');
            }
            // Preserva a informação se este dispositivo já fez login alguma vez
            const jaLogou = localStorage.getItem('helpy-ja-logou');
            localStorage.clear();
            if (jaLogou) {
                localStorage.setItem('helpy-ja-logou', jaLogou);
            }
            // Usa replace para evitar que o usuário volte para o feed com o botão "voltar"
            window.location.replace('/login');
        });
    }
    if (confirmLogoutNoBtn) {
        confirmLogoutNoBtn.addEventListener('click', () => {
            logoutConfirmModal && logoutConfirmModal.classList.add('hidden');
        });
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

            // Fecha sidebar em telas médias quando abre o modal
            if (typeof window.fecharSidebarSeMedia === 'function') {
                window.fecharSidebarSeMedia();
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

    async function buscarProfissionaisProximos(latitude, longitude, tipoServico = null) {
        if (!profissionaisProximos) return;
        
        profissionaisProximos.innerHTML = '<p>Buscando profissionais...</p>';
        
        try {
            const response = await fetch('/api/preciso-agora', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ latitude, longitude, tipoServico, raioKm: 10 })
            });

            const data = await response.json();
            
            if (data.success && data.profissionais.length > 0) {
                profissionaisProximos.innerHTML = data.profissionais.map(prof => {
                    const temSelo = prof.gamificacao?.temSeloQualidade || false;
                    const nivelReputacao = prof.gamificacao?.nivelReputacao || 'iniciante';
                    const nivel = prof.gamificacao?.nivel || 1;
                    const perfilUrl = `/perfil?id=${prof._id}`;
                    
                    return `
                    <div class="profissional-card ${temSelo ? 'com-selo' : ''}">
                        <a href="${perfilUrl}" class="profissional-avatar-link">
                            <img src="${prof.foto || prof.avatarUrl || 'imagens/default-user.png'}" alt="${prof.nome}" class="profissional-avatar">
                        </a>
                        <div class="profissional-info">
                            <h4>
                                <a href="${perfilUrl}" class="profissional-nome-link">
                                    ${prof.nome}
                                </a>
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
                    await buscarProfissionaisProximos(latitude, longitude, tipoServico);
                },
                (error) => {
                    alert('Erro ao obter localização: ' + error.message);
                }
            );
        });
    }


    // ----------------------------------------------------------------------
    // 🆕 NOVO: FUNCIONALIDADES EQUIPE
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
            // Força recarregamento sem cache para pegar a cidade atualizada
            const user = await fetch(`/api/usuario/${userId}?t=${Date.now()}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                cache: 'no-cache'
            }).then(r => r.json());
            
            const cidade = user.cidade || '';
            
            // Busca times da cidade
            const responseCidade = await fetch(`/api/times-projeto?cidade=${encodeURIComponent(cidade)}&status=aberto&t=${Date.now()}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                cache: 'no-cache'
            });
            
            const dataCidade = await responseCidade.json();
            
            // Busca também todos os times abertos (sem filtro de cidade) para encontrar os times do criador
            // Isso garante que o criador sempre veja seus próprios times, mesmo que não estejam na mesma cidade
            const responseTodosTimes = await fetch(`/api/times-projeto?status=aberto&t=${Date.now()}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                cache: 'no-cache'
            });
            
            const dataTodosTimes = await responseTodosTimes.json();
            
            // Combina os resultados
            const timesCidade = dataCidade.success ? dataCidade.times : [];
            const todosTimes = dataTodosTimes.success ? dataTodosTimes.times : [];
            
            // Filtra apenas os times criados pelo usuário atual
            const meusTimes = todosTimes.filter(time => {
                const criadorId = time.clienteId?._id?.toString() || time.clienteId?.toString() || time.clienteId;
                const userIdStr = userId?.toString();
                return criadorId === userIdStr;
            });
            
            // Combina os arrays e remove duplicatas baseado no _id
            const timesMap = new Map();
            [...timesCidade, ...meusTimes].forEach(time => {
                if (time._id) {
                    timesMap.set(time._id.toString(), time);
                }
            });
            
            // Ordena por data de criação (mais recentes primeiro)
            const timesUnicos = Array.from(timesMap.values());
            timesUnicos.sort((a, b) => {
                const dateA = new Date(a.createdAt || a._id.getTimestamp?.() || 0);
                const dateB = new Date(b.createdAt || b._id.getTimestamp?.() || 0);
                return dateB - dateA;
            });
            
            const data = {
                success: true,
                times: timesUnicos
            };
            
            if (data.success && data.times.length > 0) {
                timesContainer.innerHTML = data.times.map(time => `
                    <div class="time-card">
                        ${time.clienteId ? (() => {
                            const criador = time.clienteId;
                            const fotoCriador = criador?.foto || criador?.avatarUrl || 'imagens/default-user.png';
                            const nomeCriador = criador?.nome || 'Cliente';
                            const criadorId = criador?._id || criador?.id || time.clienteId;
                            const isCriador = (criadorId?.toString() === userId?.toString()) || (time.clienteId?.toString() === userId?.toString());
                            return `
                                <div class="time-criador-topo">
                                    <a href="/perfil.html?id=${criadorId}" class="criador-time-link">
                                        <img src="${fotoCriador}" alt="${nomeCriador}" class="criador-time-foto" onerror="this.src='imagens/default-user.png'">
                                        <span class="criador-time-nome">${nomeCriador}</span>
                                    </a>
                                    ${isCriador ? `
                                        <button class="btn-deletar-time" data-time-id="${time._id}" title="Deletar time">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    ` : ''}
                                </div>
                            `;
                        })() : ''}
                        <div class="time-header">
                            <h3>${time.titulo}</h3>
                            <span class="time-status status-${time.status}">${time.status.replace('_', ' ')}</span>
                        </div>
                        <p class="time-descricao">${time.descricao}</p>
                        <p class="time-localizacao">
                            <i class="fas fa-map-marker-alt"></i> ${(() => {
                                const endereco = [];
                                if (time.localizacao.rua) endereco.push(time.localizacao.rua);
                                if (time.localizacao.numero) endereco.push(`Nº ${time.localizacao.numero}`);
                                if (time.localizacao.bairro) endereco.push(time.localizacao.bairro);
                                if (time.localizacao.cidade) endereco.push(time.localizacao.cidade);
                                if (time.localizacao.estado) endereco.push(time.localizacao.estado);
                                return endereco.length > 0 ? endereco.join(', ') : `${time.localizacao.bairro}, ${time.localizacao.cidade} - ${time.localizacao.estado}`;
                            })()}
                        </p>
                        <div class="time-profissionais">
                            <strong>Profissionais necessários:</strong>
                            <ul>
                                ${time.profissionaisNecessarios.map(p => {
                                    // Verifica se está marcado como "A Combinar" ou se não tem valor (para compatibilidade com dados antigos)
                                    const valorBaseNum = p.valorBase !== null && p.valorBase !== undefined && !isNaN(parseFloat(p.valorBase)) && parseFloat(p.valorBase) > 0 ? parseFloat(p.valorBase) : null;
                                    const aCombinar = p.aCombinar === true || valorBaseNum === null;
                                    const valorTexto = aCombinar ? 'A Combinar' : `R$ ${valorBaseNum.toFixed(2)}/dia`;
                                    return `<li>${p.quantidade}x ${p.tipo} - ${valorTexto}</li>`;
                                }).join('')}
                            </ul>
                        </div>
                        <div class="time-candidatos">
                            ${(() => {
                                const candidatosPendentes = (time.candidatos || []).filter(c => c.status === 'pendente');
                                const totalCandidatos = candidatosPendentes.length;
                                return `
                                    <strong>Candidatos: ${totalCandidatos}</strong>
                                    ${((time.clienteId?._id === userId || time.clienteId === userId) && totalCandidatos > 0) ? `
                                        <button class="btn-ver-candidatos" data-time-id="${time._id}" title="Ver candidatos">
                                            <i class="fas fa-eye"></i>
                            </button>
                        ` : ''}
                                `;
                            })()}
                        </div>
                        ${userType === 'trabalhador' ? (() => {
                            const jaCandidatou = time.candidatos?.some(c => 
                                (c.profissionalId?._id === userId || c.profissionalId === userId) && c.status === 'pendente'
                            );
                            return jaCandidatou ? `
                                <button class="btn-candidatar candidatado" data-time-id="${time._id}" data-ja-candidatou="true">
                                    <i class="fas fa-briefcase"></i> 
                                    <span class="btn-candidatar-text">Candidatado</span>
                                </button>
                            ` : `
                                <div class="time-acoes-candidatar">
                                    ${time.profissionaisNecessarios.map((prof, index) => {
                                        const aCombinar = prof.aCombinar || !prof.valorBase;
                                        const valorBase = prof.valorBase || 0;
                                        const valorTexto = aCombinar ? 'A Combinar' : `R$ ${valorBase.toFixed(2)}/dia`;
                                        return `
                                            <div class="profissional-candidatura-item">
                                                <div class="profissional-candidatura-linha">
                                                    <span class="profissional-candidatura-tipo">${prof.tipo} (${prof.quantidade}x) - ${valorTexto}</span>
                                                    <button class="btn-candidatar-profissional" data-time-id="${time._id}" data-tipo="${prof.tipo}" data-valor-base="${valorBase}" data-a-combinar="${aCombinar}">
                                                        <span class="btn-candidatar-texto">Candidatar-se</span>
                                                        <i class="fas fa-hand-paper"></i>
                                                    </button>
                                                </div>
                                                ${index < time.profissionaisNecessarios.length - 1 ? '<hr class="profissional-separador">' : ''}
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            `;
                        })() : ''}
                    </div>
                `).join('');
                
                // Adiciona listeners aos botões de candidatar-se
                document.querySelectorAll('.btn-candidatar-profissional').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const timeId = e.currentTarget.dataset.timeId;
                        const tipo = e.currentTarget.dataset.tipo;
                        const aCombinar = e.currentTarget.dataset.aCombinar === 'true';
                        const valorBase = aCombinar ? null : parseFloat(e.currentTarget.dataset.valorBase || 0);
                        await mostrarModalEscolhaCandidatura(timeId, tipo, valorBase, aCombinar, btn);
                    });
                });
                
                // Adiciona listeners aos botões de candidatura (para cancelar)
                document.querySelectorAll('.btn-candidatar.candidatado').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const timeId = e.currentTarget.dataset.timeId;
                        const confirmar = await mostrarConfirmacaoCancelar(btn);
                        if (confirmar) {
                            await cancelarCandidatura(timeId, btn);
                        }
                    });
                });
                
                // Adiciona listeners aos botões de deletar time
                document.querySelectorAll('.btn-deletar-time').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const timeId = e.currentTarget.dataset.timeId;
                        
                        const confirmar = await mostrarConfirmacaoDeletarTime(btn, timeId);
                        if (confirmar) {
                            await deletarTime(timeId);
                        }
                    });
                });
                
                // Adiciona listeners aos botões de ver candidatos
                document.querySelectorAll('.btn-ver-candidatos').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const timeId = e.currentTarget.dataset.timeId;
                        const time = data.times.find(t => t._id === timeId);
                        if (time) {
                            mostrarCandidatosTime(time, btn);
                        }
                    });
                });
            } else {
                timesContainer.innerHTML = '<p class="mensagem-vazia">Nenhuma equipe aberta na sua cidade no momento.</p>';
            }
        } catch (error) {
            console.error('Erro ao carregar equipes:', error);
            timesContainer.innerHTML = '<p class="erro">Erro ao carregar equipes.</p>';
        }
    }


    // Função para mostrar modal de equipes concluídas (popup próximo ao botão)
    async function mostrarEquipesConcluidas(botao) {
        // Remove popup anterior se existir
        const popupAnterior = document.querySelector('.popup-equipes-concluidas');
        if (popupAnterior) {
            popupAnterior.remove();
        }

        // Carrega dados primeiro
        const token = localStorage.getItem('jwtToken');
        if (!token) return;

        let equipesData = [];
        try {
            const user = await fetch('/api/user/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(r => r.json());

            const cidade = user.cidade || '';
            const response = await fetch(`/api/times-projeto?cidade=${encodeURIComponent(cidade)}&status=concluido&t=${Date.now()}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                cache: 'no-cache'
            });

            const data = await response.json();
            if (data.success) {
                equipesData = data.times || [];
            }
        } catch (error) {
            console.error('Erro ao carregar equipes concluídas:', error);
        }

        // Cria o popup
        const popup = document.createElement('div');
        popup.className = 'popup-equipes-concluidas';

        // Variáveis para modo de seleção (escopo da função)
        let modoSelecaoEquipes = false;
        let equipesSelecionadas = new Set();
        
        if (equipesData.length > 0) {
            listaHTML = equipesData.map(time => {
                const candidatosAceitos = (time.candidatos || []).filter(c => c.status === 'aceito');
                const timeId = time._id?.toString() || time._id;
                
                return `
                    <div class="equipe-concluida-item" data-time-id="${timeId}">
                        <div class="equipe-concluida-header">
                            <h5>${time.titulo}</h5>
                        </div>
                        <p class="equipe-localizacao">
                            <i class="fas fa-map-marker-alt"></i> ${(() => {
                                const endereco = [];
                                if (time.localizacao.rua) endereco.push(time.localizacao.rua);
                                if (time.localizacao.numero) endereco.push(`Nº ${time.localizacao.numero}`);
                                if (time.localizacao.bairro) endereco.push(time.localizacao.bairro);
                                if (time.localizacao.cidade) endereco.push(time.localizacao.cidade);
                                if (time.localizacao.estado) endereco.push(time.localizacao.estado);
                                return endereco.length > 0 ? endereco.join(', ') : `${time.localizacao.bairro}, ${time.localizacao.cidade} - ${time.localizacao.estado}`;
                            })()}
                        </p>
                        <div class="equipe-profissionais-aceitos">
                            ${candidatosAceitos.map(candidato => {
                                const prof = candidato.profissionalId || {};
                                const fotoProf = prof?.foto || prof?.avatarUrl || 'imagens/default-user.png';
                                const nomeProf = prof?.nome || 'Profissional';
                                const profId = prof?._id || prof?.id || candidato.profissionalId;
                                const valor = candidato.valor || 0;
                                const tipo = candidato.tipo || 'Profissional';
                                
                                return `
                                    <div class="profissional-aceito-item">
                                        <a href="/perfil.html?id=${profId}" class="profissional-aceito-link">
                                            <img src="${fotoProf}" alt="${nomeProf}" class="profissional-aceito-foto" onerror="this.src='imagens/default-user.png'">
                                            <div class="profissional-aceito-info">
                                                <span class="profissional-aceito-nome">${nomeProf}</span>
                                                <span class="profissional-aceito-tipo">${tipo}</span>
                                                <span class="profissional-aceito-valor">R$ ${valor.toFixed(2).replace('.', ',')}/dia</span>
                                            </div>
                                        </a>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            listaHTML = '<p class="mensagem-vazia-popup">Nenhuma equipe concluída no momento.</p>';
        }

        popup.innerHTML = `
            <div class="popup-equipes-concluidas-content">
                <div class="popup-equipes-concluidas-header">
                    <h4>Equipes Concluídas</h4>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <button class="btn-lixeira-equipes" title="Deletar equipes" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 16px; padding: 5px; border-radius: 4px; transition: all 0.2s;">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="btn-fechar-popup-equipes">&times;</button>
                    </div>
                </div>
                <div id="selecionar-tudo-equipes-container" style="display: none; margin-bottom: 10px; padding: 0 12px;">
                    <button id="btn-selecionar-tudo-equipes" class="btn-secondary" style="padding: 6px 12px; font-size: 14px;">
                        Selecionar tudo
                    </button>
                    <span id="mensagem-selecionar-primeiro-equipes" style="display: none; margin-left: 10px; color: #ff6b6b; font-size: 12px;">Primeiro selecione!</span>
                </div>
                <div class="popup-equipes-concluidas-body">
                    ${listaHTML}
                </div>
            </div>
        `;

        // Posiciona o popup similar ao modal de deletar (lixeira)
        const botaoRect = botao.getBoundingClientRect();
        const isMobile = window.innerWidth <= 767;
        const isMedia = window.innerWidth >= 768 && window.innerWidth <= 992;
        const popupContent = popup.querySelector('.popup-equipes-concluidas-content');
        
        document.body.appendChild(popup);

        if (!isMobile && !isMedia) {
            // Em telas maiores, posiciona FORA do container, ao lado direito - igual ao modal de deletar
            const filtroTimesLocais = document.querySelector('.filtro-times-locais');
            
            if (filtroTimesLocais) {
                const containerRect = filtroTimesLocais.getBoundingClientRect();
                const header = document.querySelector('header');
                const headerRect = header ? header.getBoundingClientRect() : { bottom: 0 };
                const headerBottom = headerRect.bottom || 0;
                
                // Calcula a posição do popup (mesma lógica do modal de deletar)
                let popupTop = containerRect.top + 35;
                
                // O popup sempre fica abaixo do cabeçalho (z-index menor que 1000)
                if (popupTop < headerBottom) {
                    popupTop = headerBottom + 10;
                }

                // Cria um overlay transparente para posicionar o popup
                popup.style.position = 'fixed';
                popup.style.top = `${containerRect.top}px`;
                popup.style.left = `${containerRect.left}px`;
                popup.style.width = `${containerRect.width}px`;
                popup.style.height = `${containerRect.height}px`;
                popup.style.display = 'flex';
                popup.style.alignItems = 'flex-start';
                popup.style.justifyContent = 'flex-start';
                popup.style.padding = '0';
                popup.style.background = 'transparent';
                popup.style.zIndex = '10000';
                popup.style.pointerEvents = 'none';
                popup.style.overflow = 'visible';

                // Verifica se há espaço à direita
                const larguraDisponivel = window.innerWidth - containerRect.right - 32;
                const larguraPopup = Math.min(320, larguraDisponivel);

                popupContent.style.position = 'fixed';
                popupContent.style.top = `${popupTop}px`;
                
                if (larguraDisponivel >= 280) {
                    // Posiciona à direita do container
                    popupContent.style.left = `${containerRect.right + 16}px`;
                    popupContent.style.right = 'auto';
                } else {
                    // Se não há espaço à direita, posiciona à esquerda
                    popupContent.style.left = 'auto';
                    popupContent.style.right = `${window.innerWidth - containerRect.left + 16}px`;
                }
                
                popupContent.style.maxWidth = `${larguraPopup}px`;
                popupContent.style.pointerEvents = 'auto';
                popupContent.style.zIndex = '999'; // Sempre abaixo do cabeçalho (z-index 1000)
                
                // Atualiza a posição quando a janela redimensiona ou quando o container rola
                const atualizarPosicaoPopup = () => {
                    if (!document.body.contains(popup)) return;
                    
                    const novoContainerRect = filtroTimesLocais.getBoundingClientRect();
                    const novoHeaderRect = header ? header.getBoundingClientRect() : { bottom: 0 };
                    const novoHeaderBottom = novoHeaderRect.bottom || 0;
                    
                    // Atualiza a área do popup
                    popup.style.top = `${novoContainerRect.top}px`;
                    popup.style.left = `${novoContainerRect.left}px`;
                    popup.style.width = `${novoContainerRect.width}px`;
                    popup.style.height = `${novoContainerRect.height}px`;
                    
                    // Atualiza posição do conteúdo
                    let novoPopupTop = novoContainerRect.top + 35;
                    if (novoPopupTop < novoHeaderBottom) {
                        novoPopupTop = novoHeaderBottom + 10;
                    }
                    
                    const novaLarguraDisponivel = window.innerWidth - novoContainerRect.right - 32;
                    const novaLarguraPopup = Math.min(320, novaLarguraDisponivel);
                    
                    popupContent.style.top = `${novoPopupTop}px`;
                    
                    if (novaLarguraDisponivel >= 280) {
                        popupContent.style.left = `${novoContainerRect.right + 16}px`;
                        popupContent.style.right = 'auto';
                    } else {
                        popupContent.style.left = 'auto';
                        popupContent.style.right = `${window.innerWidth - novoContainerRect.left + 16}px`;
                    }
                    
                    popupContent.style.maxWidth = `${novaLarguraPopup}px`;
                };
                
                window.addEventListener('scroll', atualizarPosicaoPopup, { passive: true });
                window.addEventListener('resize', atualizarPosicaoPopup);
                
                // Remove listeners quando o popup é fechado
                const observer = new MutationObserver(() => {
                    if (!document.body.contains(popup)) {
                        window.removeEventListener('scroll', atualizarPosicaoPopup);
                        window.removeEventListener('resize', atualizarPosicaoPopup);
                        observer.disconnect();
                    }
                });
                observer.observe(document.body, { childList: true, subtree: true });
            } else {
                // Fallback: posiciona próximo ao botão
                popup.style.position = 'absolute';
                popup.style.top = `${botaoRect.bottom + 10 + window.scrollY}px`;
                popup.style.left = `${botaoRect.right + 10 + window.scrollX}px`;
            }
        } else {
            // Mobile/Tablet: aparece como modal centralizado sobreposto (evita rolagem lateral)
            // Previne rolagem do body quando o modal está aberto
            const scrollY = window.scrollY;
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
            document.body.style.overflow = 'hidden';
            
            popup.style.position = 'fixed';
            popup.style.top = '0';
            popup.style.left = '0';
            popup.style.width = '100vw';
            popup.style.height = '100vh';
            popup.style.display = 'flex';
            popup.style.alignItems = 'center';
            popup.style.justifyContent = 'center';
            popup.style.padding = '20px';
            popup.style.background = 'rgba(0, 0, 0, 0.5)';
            popup.style.zIndex = '10000';
            popup.style.pointerEvents = 'auto';
            popup.style.overflow = 'auto';
            popup.style.boxSizing = 'border-box';
            
            // Ajusta o conteúdo do popup para ser um modal centralizado
            popupContent.style.position = 'relative';
            popupContent.style.width = '100%';
            popupContent.style.maxWidth = '90vw';
            popupContent.style.maxHeight = '80vh';
            popupContent.style.margin = 'auto';
            popupContent.style.pointerEvents = 'auto';
            popupContent.style.zIndex = '10001';
            popupContent.style.boxSizing = 'border-box';
            
            // Restaura o scroll do body quando o modal for fechado
            const restaurarScroll = () => {
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.width = '';
                document.body.style.overflow = '';
                window.scrollTo(0, scrollY);
            };
            
            // Armazena a função de restauração no popup para usar quando fechar
            popup._restaurarScroll = restaurarScroll;
        }

        // Função para atualizar botão selecionar tudo
        const atualizarBotaoSelecionarTudoEquipes = () => {
            const btnSelecionarTudo = popup.querySelector('#btn-selecionar-tudo-equipes');
            if (!btnSelecionarTudo) return;
            const todasEquipes = popup.querySelectorAll('.equipe-concluida-item');
            const todasSelecionadas = todasEquipes.length > 0 && equipesSelecionadas.size === todasEquipes.length;
            btnSelecionarTudo.innerHTML = todasSelecionadas 
                ? 'Desselecionar tudo'
                : 'Selecionar tudo';
        };
        
        // Função para entrar/sair do modo de seleção
        const toggleModoSelecaoEquipes = () => {
            modoSelecaoEquipes = !modoSelecaoEquipes;
            equipesSelecionadas.clear();
            
            const btnLixeira = popup.querySelector('.btn-lixeira-equipes');
            const selecionarTudoContainer = popup.querySelector('#selecionar-tudo-equipes-container');
            const todasEquipes = popup.querySelectorAll('.equipe-concluida-item');
            
            if (modoSelecaoEquipes) {
                if (btnLixeira) {
                    btnLixeira.classList.add('modo-selecao');
                }
                if (selecionarTudoContainer) {
                    selecionarTudoContainer.style.display = 'block';
                }
                todasEquipes.forEach(item => {
                    item.classList.add('modo-selecao');
                });
            } else {
                if (btnLixeira) {
                    btnLixeira.classList.remove('modo-selecao');
                }
                if (selecionarTudoContainer) {
                    selecionarTudoContainer.style.display = 'none';
                }
                todasEquipes.forEach(item => {
                    item.classList.remove('modo-selecao', 'selecionada');
                });
            }
            atualizarBotaoSelecionarTudoEquipes();
        };
        
        // Listener para botão lixeira
        const btnLixeira = popup.querySelector('.btn-lixeira-equipes');
        if (btnLixeira) {
            btnLixeira.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                // Se não está em modo de seleção, entra no modo
                if (!modoSelecaoEquipes) {
                    toggleModoSelecaoEquipes();
                    return;
                }
                
                // Se está em modo de seleção e tem equipes selecionadas, oculta
                if (equipesSelecionadas.size === 0) {
                    const mensagemEl = popup.querySelector('#mensagem-selecionar-primeiro-equipes');
                    if (mensagemEl) {
                        mensagemEl.style.display = 'inline';
                        setTimeout(() => {
                            mensagemEl.style.display = 'none';
                        }, 3000);
                    }
                    return;
                }
                
                // Remove confirmação - oculta diretamente
                try {
                    const token = localStorage.getItem('jwtToken');
                    const equipesIds = Array.from(equipesSelecionadas);
                    
                    // Oculta cada equipe (não deleta do banco, apenas oculta para o usuário)
                    for (const timeId of equipesIds) {
                        await fetch(`/api/times-projeto/${timeId}/ocultar`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                    }
                    
                    equipesSelecionadas.clear();
                    toggleModoSelecaoEquipes();
                    
                    // Recarrega as equipes
                    await mostrarEquipesConcluidas(botao);
                } catch (err) {
                    console.error('Erro ao ocultar equipes:', err);
                    alert('Erro ao ocultar equipes. Tente novamente.');
                }
            });
        }
        
        // Listener para botão selecionar tudo
        const btnSelecionarTudo = popup.querySelector('#btn-selecionar-tudo-equipes');
        if (btnSelecionarTudo) {
            btnSelecionarTudo.addEventListener('click', () => {
                const todasEquipes = popup.querySelectorAll('.equipe-concluida-item');
                const todasSelecionadas = todasEquipes.length > 0 && equipesSelecionadas.size === todasEquipes.length;
                
                if (todasSelecionadas) {
                    equipesSelecionadas.clear();
                    todasEquipes.forEach(item => item.classList.remove('selecionada'));
                } else {
                    todasEquipes.forEach(item => {
                        const timeId = item.dataset.timeId;
                        if (timeId) {
                            equipesSelecionadas.add(timeId);
                            item.classList.add('selecionada');
                        }
                    });
                }
                atualizarBotaoSelecionarTudoEquipes();
            });
        }
        
        // Listeners para cliques nas equipes (modo seleção)
        popup.querySelectorAll('.equipe-concluida-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!modoSelecaoEquipes) return;
                
                e.stopPropagation();
                const timeId = item.dataset.timeId;
                if (!timeId) return;
                
                if (equipesSelecionadas.has(timeId)) {
                    equipesSelecionadas.delete(timeId);
                    item.classList.remove('selecionada');
                } else {
                    equipesSelecionadas.add(timeId);
                    item.classList.add('selecionada');
                }
                atualizarBotaoSelecionarTudoEquipes();
            });
        });
        
        // Função para fechar o popup e restaurar scroll
        const fecharPopup = () => {
            // Se estiver em modo de seleção sem seleção, apenas reseta
            if (modoSelecaoEquipes && equipesSelecionadas.size === 0) {
                toggleModoSelecaoEquipes();
                return;
            }
            
            // Restaura scroll do body se estiver em mobile
            if ((isMobile || isMedia) && popup._restaurarScroll) {
                popup._restaurarScroll();
            }
            popup.remove();
        };
        
        // Botão fechar
        const btnFechar = popup.querySelector('.btn-fechar-popup-equipes');
        btnFechar.addEventListener('click', fecharPopup);

        // Fecha ao clicar fora
        const fecharAoClicarFora = (e) => {
            // Se estiver em modo de seleção sem seleção, apenas reseta
            if (modoSelecaoEquipes && equipesSelecionadas.size === 0) {
                if (!popupContent.contains(e.target) && e.target !== botao) {
                    toggleModoSelecaoEquipes();
                    document.removeEventListener('click', fecharAoClicarFora);
                }
                return;
            }
            
            // Em mobile, fecha ao clicar no overlay (background escuro)
            if (isMobile || isMedia) {
                if (e.target === popup || (!popupContent.contains(e.target) && e.target !== botao)) {
                    fecharPopup();
                    document.removeEventListener('click', fecharAoClicarFora);
                }
            } else {
                // Em telas maiores, comportamento original
                if (!popup.contains(e.target) && e.target !== botao) {
                    fecharPopup();
                    document.removeEventListener('click', fecharAoClicarFora);
                }
            }
        };

        setTimeout(() => {
            document.addEventListener('click', fecharAoClicarFora);
        }, 100);
    }

    // Listener para botão "Concluídas"
    const btnVerConcluidas = document.getElementById('btn-ver-concluidas');
    if (btnVerConcluidas) {
        btnVerConcluidas.addEventListener('click', async (e) => {
            e.stopPropagation();
            // Fecha sidebar em telas médias quando abre o popup
            if (typeof window.fecharSidebarSeMedia === 'function') {
                window.fecharSidebarSeMedia();
            }
            await mostrarEquipesConcluidas(btnVerConcluidas);
        });
    }

    // Função para mostrar popup de confirmação de cancelamento
    function mostrarConfirmacaoCancelar(botao) {
        return new Promise((resolve) => {
            // Remove popup anterior se existir
            const popupAnterior = document.querySelector('.popup-confirmacao-cancelar');
            if (popupAnterior) {
                popupAnterior.remove();
            }

            // Cria o popup
            const popup = document.createElement('div');
            popup.className = 'popup-confirmacao-cancelar';
            popup.innerHTML = `
                <div class="popup-confirmacao-content">
                    <p>Cancelar candidatura?</p>
                    <div class="popup-confirmacao-buttons">
                        <button class="btn-confirmar-sim">Sim</button>
                        <button class="btn-confirmar-nao">Não</button>
                    </div>
                </div>
            `;

            // Posiciona o popup ao lado do botão
            const rect = botao.getBoundingClientRect();
            document.body.appendChild(popup);
            
            // Ajusta posição
            const popupRect = popup.getBoundingClientRect();
            popup.style.top = `${rect.top + window.scrollY}px`;
            popup.style.left = `${rect.right + 10 + window.scrollX}px`;

            // Em telas menores, ajusta para aparecer acima ou abaixo
            if (window.innerWidth < 768) {
                popup.style.left = `${rect.left + window.scrollX}px`;
                popup.style.top = `${rect.bottom + 10 + window.scrollY}px`;
            }

            // Botões
            const btnSim = popup.querySelector('.btn-confirmar-sim');
            const btnNao = popup.querySelector('.btn-confirmar-nao');

            // Event listeners
            btnSim.addEventListener('click', () => {
                popup.remove();
                resolve(true);
            });

            btnNao.addEventListener('click', () => {
                popup.remove();
                resolve(false);
            });

            // Fecha ao clicar fora
            const fecharAoClicarFora = (e) => {
                if (!popup.contains(e.target) && e.target !== botao) {
                    popup.remove();
                    document.removeEventListener('click', fecharAoClicarFora);
                    resolve(false);
                }
            };

            // Aguarda um pouco antes de adicionar o listener para não fechar imediatamente
            setTimeout(() => {
                document.addEventListener('click', fecharAoClicarFora);
            }, 100);
        });
    }

    // Função para mostrar modal de escolha (aceitar ou contraproposta)
    function mostrarModalEscolhaCandidatura(timeId, tipo, valorBase, aCombinar, botao) {
        return new Promise((resolve) => {
            // Remove modal anterior se existir
            const modalAnterior = document.getElementById('modal-escolha-candidatura');
            if (modalAnterior) {
                modalAnterior.remove();
            }

            // Cria novo modal
            const modal = document.createElement('div');
            modal.id = 'modal-escolha-candidatura';
            modal.className = 'modal-overlay';
            // Fecha sidebar em telas médias quando abre o modal
            if (typeof window.fecharSidebarSeMedia === 'function') {
                window.fecharSidebarSeMedia();
            }
            
            document.body.appendChild(modal);

            const valorTexto = aCombinar ? 'A Combinar' : `R$ ${(valorBase || 0).toFixed(2)}/dia`;
            
            modal.innerHTML = `
                <div class="modal-content modal-escolha-candidatura">
                    <div class="modal-body">
                        <div class="escolha-candidatura-content">
                            <p class="escolha-candidatura-info">Profissional: <strong>${tipo}</strong></p>
                            <p class="escolha-candidatura-info">Valor: <strong>${valorTexto}</strong></p>
                            <div class="escolha-candidatura-botoes">
                                ${!aCombinar ? `
                                    <button class="btn-escolher-aceitar" data-time-id="${timeId}" data-tipo="${tipo}" data-valor="${valorBase}">
                                        <i class="fas fa-check-circle"></i> Aceitar Valor
                                    </button>
                                ` : ''}
                                <button class="btn-escolher-contraproposta" data-time-id="${timeId}" data-tipo="${tipo}" data-valor-base="${valorBase || 0}" data-a-combinar="${aCombinar}">
                                    <i class="fas fa-comment-dollar"></i> ${aCombinar ? 'Enviar Proposta' : 'Enviar Contraproposta'}
                                </button>
                                <button class="btn-cancelar-escolha">Cancelar</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Posiciona o modal similar ao modal de candidatos
            const botaoRect = botao.getBoundingClientRect();
            const isMobile = window.innerWidth <= 767;
            const isMedia = window.innerWidth >= 768 && window.innerWidth <= 992;
            
            if (!isMobile && !isMedia) {
                // Em telas maiores, posiciona o modal FORA do container, ao lado (lateral)
                document.body.appendChild(modal);
                const modalContent = modal.querySelector('.modal-content');
                const filtroTimesLocais = document.querySelector('.filtro-times-locais');
                
                if (filtroTimesLocais) {
                    const containerRect = filtroTimesLocais.getBoundingClientRect();
                    
                    // Posiciona o modal fixo na tela, ao lado do container de times locais
                    modal.style.position = 'fixed';
                    modal.style.top = `${containerRect.top}px`;
                    modal.style.left = `${containerRect.left}px`;
                    modal.style.width = `${containerRect.width}px`;
                    modal.style.height = `${containerRect.height}px`;
                    modal.style.display = 'flex';
                    modal.style.alignItems = 'flex-start';
                    modal.style.justifyContent = 'flex-start';
                    modal.style.padding = '0';
                    modal.style.background = 'transparent';
                    modal.style.zIndex = '10000';
                    modal.style.pointerEvents = 'none';
                    modal.style.overflow = 'visible';
                    
                    // Posiciona o conteúdo do modal ao lado direito do container de times locais
                    const larguraDisponivel = window.innerWidth - containerRect.right - 32;
                    const larguraModal = Math.min(200, larguraDisponivel);
                    
                    // Obtém a posição do cabeçalho
                    const header = document.querySelector('header');
                    const headerRect = header ? header.getBoundingClientRect() : { bottom: 0 };
                    const headerBottom = headerRect.bottom || 0;
                    
                    // Calcula a posição do modal
                    let modalTop = containerRect.top + 35;
                    
                    // O modal sempre fica abaixo do cabeçalho (z-index menor que 1000)
                    if (modalTop < headerBottom) {
                        modalTop = headerBottom + 10;
                    }
                    
                    modalContent.style.position = 'fixed';
                    modalContent.style.top = `${modalTop}px`;
                    modalContent.style.left = `${containerRect.right + 16}px`;
                    modalContent.style.right = 'auto';
                    modalContent.style.maxWidth = `${larguraModal}px`;
                    modalContent.style.width = `${larguraModal}px`;
                    modalContent.style.pointerEvents = 'auto';
                    modalContent.style.zIndex = '999';
                    
                    // Função para atualizar a posição do modal quando houver scroll ou resize
                    const atualizarPosicaoModal = () => {
                        const novoContainerRect = filtroTimesLocais.getBoundingClientRect();
                        const novoHeaderRect = header ? header.getBoundingClientRect() : { bottom: 0 };
                        const novoHeaderBottom = novoHeaderRect.bottom || 0;
                        
                        let novoModalTop = novoContainerRect.top + 35;
                        if (novoModalTop < novoHeaderBottom) {
                            novoModalTop = novoHeaderBottom + 10;
                        }
                        
                        modal.style.top = `${novoContainerRect.top}px`;
                        modal.style.left = `${novoContainerRect.left}px`;
                        modal.style.width = `${novoContainerRect.width}px`;
                        modal.style.height = `${novoContainerRect.height}px`;
                        
                        const novaLarguraDisponivel = window.innerWidth - novoContainerRect.right - 32;
                        const novaLarguraModal = Math.min(200, novaLarguraDisponivel);
                        
                        modalContent.style.top = `${novoModalTop}px`;
                        modalContent.style.left = `${novoContainerRect.right + 16}px`;
                        modalContent.style.maxWidth = `${novaLarguraModal}px`;
                        modalContent.style.width = `${novaLarguraModal}px`;
                        modalContent.style.zIndex = '999';
                    };
                    
                    // Adiciona listeners para scroll e resize
                    window.addEventListener('scroll', atualizarPosicaoModal, { passive: true });
                    window.addEventListener('resize', atualizarPosicaoModal);
                    
                    // Remove os listeners quando o modal for fechado
                    const removerListeners = () => {
                        window.removeEventListener('scroll', atualizarPosicaoModal);
                        window.removeEventListener('resize', atualizarPosicaoModal);
                    };
                    
                    // Armazena a função de remoção no modal para ser chamada quando fechar
                    modal._removerListeners = removerListeners;
                } else {
                    document.body.appendChild(modal);
                    modal.style.position = 'fixed';
                    modal.style.top = '0';
                    modal.style.left = '0';
                    modal.style.right = '0';
                    modal.style.bottom = '0';
                    modal.style.display = 'flex';
                    modal.style.alignItems = 'center';
                    modal.style.justifyContent = 'center';
                    modal.style.background = 'rgba(0, 0, 0, 0.5)';
                    modal.style.zIndex = '10000';
                }
            } else {
                document.body.appendChild(modal);
                modal.style.position = 'fixed';
                modal.style.top = '0';
                modal.style.left = '0';
                modal.style.right = '0';
                modal.style.bottom = '0';
                modal.style.display = 'flex';
                modal.style.alignItems = 'center';
                modal.style.justifyContent = 'center';
                modal.style.background = 'rgba(0, 0, 0, 0.5)';
                modal.style.zIndex = '10000';
            }

            // Fecha sidebar em telas médias quando abre o modal
            if (typeof window.fecharSidebarSeMedia === 'function') {
                window.fecharSidebarSeMedia();
            }
            
            modal.classList.remove('hidden');

            // Listener do botão aceitar
            const btnAceitar = modal.querySelector('.btn-escolher-aceitar');
            if (btnAceitar) {
                btnAceitar.addEventListener('click', async () => {
                    if (modal._removerListeners) {
                        modal._removerListeners();
                    }
                    modal.remove();
                    const timeId = btnAceitar.dataset.timeId;
                    const tipo = btnAceitar.dataset.tipo;
                    await aceitarValorTime(timeId, tipo, botao);
                    resolve(true);
                });
            }

            // Listener do botão contraproposta
            modal.querySelector('.btn-escolher-contraproposta').addEventListener('click', async () => {
                if (modal._removerListeners) {
                    modal._removerListeners();
                }
                modal.remove();
                const timeId = modal.querySelector('.btn-escolher-contraproposta').dataset.timeId;
                const tipo = modal.querySelector('.btn-escolher-contraproposta').dataset.tipo;
                const aCombinar = modal.querySelector('.btn-escolher-contraproposta').dataset.aCombinar === 'true';
                const valorBase = aCombinar ? null : parseFloat(modal.querySelector('.btn-escolher-contraproposta').dataset.valorBase || 0);
                await mostrarModalContraproposta(timeId, tipo, valorBase, aCombinar, botao);
                resolve(true);
            });

            // Listener do botão cancelar
            modal.querySelector('.btn-cancelar-escolha').addEventListener('click', () => {
                if (modal._removerListeners) {
                    modal._removerListeners();
                }
                modal.remove();
                resolve(false);
            });

            // Fechar ao clicar fora
            const fecharModal = (e) => {
                if (!modalContent.contains(e.target) && e.target !== botao) {
                    if (modal._removerListeners) {
                        modal._removerListeners();
                    }
                    modal.remove();
                    document.removeEventListener('click', fecharModal);
                    resolve(false);
                }
            };

            setTimeout(() => {
                document.addEventListener('click', fecharModal);
            }, 100);
        });
    }

    // Função para aceitar o valor base
    async function aceitarValorTime(timeId, tipo, botao) {
        if (!botao) return;
        
        botao.disabled = true;
        const originalHTML = botao.innerHTML;
        botao.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Aceitando...';
        
        try {
            const response = await fetch(`/api/times-projeto/${timeId}/candidatar`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ tipo: tipo })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Recarrega os times para atualizar a interface
                setTimeout(() => {
                    carregarTimesLocais();
                }, 500);
            } else {
                botao.innerHTML = originalHTML;
                botao.disabled = false;
                alert(data.message || 'Erro ao aceitar valor.');
            }
        } catch (error) {
            console.error('Erro ao aceitar valor:', error);
            botao.innerHTML = originalHTML;
            botao.disabled = false;
            alert('Erro ao aceitar valor. Verifique sua conexão e tente novamente.');
        }
    }
    
    // Função para mostrar modal de contraproposta
    function mostrarModalContraproposta(timeId, tipo, valorBase, aCombinar, botao) {
        return new Promise((resolve) => {
            // Remove modal anterior se existir
            const modalAnterior = document.getElementById('modal-contraproposta-time');
            if (modalAnterior) {
                modalAnterior.remove();
            }

            // Cria novo modal
            const modal = document.createElement('div');
            modal.id = 'modal-contraproposta-time';
            modal.className = 'modal-overlay';
            
            // Fecha sidebar em telas médias quando abre o modal
            if (typeof window.fecharSidebarSeMedia === 'function') {
                window.fecharSidebarSeMedia();
            }
            
            document.body.appendChild(modal);

            modal.innerHTML = `
                <div class="modal-content modal-contraproposta">
                    <div class="modal-body">
                        <div class="contraproposta-content">
                            <p class="contraproposta-info">Profissional: <strong>${tipo}</strong></p>
                            ${aCombinar ? `
                                <p class="contraproposta-info">Valor: <strong>A Combinar</strong></p>
                            ` : `
                                <p class="contraproposta-info">Valor base: <strong>R$ ${valorBase.toFixed(2)}/dia</strong></p>
                            `}
                            <div class="form-group">
                                <label>Seu valor (R$/dia)</label>
                                <input type="number" id="contraproposta-valor" ${aCombinar ? '' : `min="${valorBase}"`} step="0.01" placeholder="Ex: 230.00" required>
                            </div>
                            <div class="form-group">
                                <label>Justificativa</label>
                                <textarea id="contraproposta-justificativa" rows="3" placeholder="Ex: Levo minhas próprias ferramentas" required></textarea>
                            </div>
                            <div class="contraproposta-botoes">
                                <button class="btn-cancelar-contraproposta">
                                    <i class="fas fa-times"></i> Cancelar
                                </button>
                                <button class="btn-enviar-contraproposta" data-time-id="${timeId}">
                                    <i class="fas fa-paper-plane"></i> Enviar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Posiciona o modal similar ao modal de confirmação
            const botaoRect = botao.getBoundingClientRect();
            const isMobile = window.innerWidth <= 767;
            const isMedia = window.innerWidth >= 768 && window.innerWidth <= 992;
            const modalContent = modal.querySelector('.modal-content');

            if (!isMobile && !isMedia) {
                const filtroTimesLocais = document.querySelector('.filtro-times-locais');
                if (filtroTimesLocais) {
                    const containerRect = filtroTimesLocais.getBoundingClientRect();
                    const header = document.querySelector('header');
                    const headerRect = header ? header.getBoundingClientRect() : { bottom: 0 };
                    const headerBottom = headerRect.bottom || 0;
                    
                    let modalTop = containerRect.top + 35;
                    if (modalTop < headerBottom) {
                        modalTop = headerBottom + 10;
                    }

                    modal.style.position = 'fixed';
                    modal.style.top = `${containerRect.top}px`;
                    modal.style.left = `${containerRect.left}px`;
                    modal.style.width = `${containerRect.width}px`;
                    modal.style.height = `${containerRect.height}px`;
                    modal.style.display = 'flex';
                    modal.style.alignItems = 'flex-start';
                    modal.style.justifyContent = 'flex-start';
                    modal.style.padding = '0';
                    modal.style.background = 'transparent';
                    modal.style.zIndex = '10000';
                    modal.style.pointerEvents = 'none';
                    modal.style.overflow = 'visible';

                    const larguraDisponivel = window.innerWidth - containerRect.right - 32;
                    const larguraModal = Math.min(320, larguraDisponivel);

                    modalContent.style.position = 'fixed';
                    modalContent.style.top = `${modalTop}px`;
                    
                    if (larguraDisponivel >= 200) {
                        modalContent.style.left = `${containerRect.right + 16}px`;
                        modalContent.style.right = 'auto';
                    } else {
                        modalContent.style.left = 'auto';
                        modalContent.style.right = `${window.innerWidth - containerRect.left + 16}px`;
                    }
                    
                    modalContent.style.maxWidth = `${larguraModal}px`;
                    modalContent.style.pointerEvents = 'auto';
                    modalContent.style.zIndex = '999';
                } else {
                    modal.style.position = 'fixed';
                    modal.style.top = '0';
                    modal.style.left = '0';
                    modal.style.right = '0';
                    modal.style.bottom = '0';
                    modal.style.display = 'flex';
                    modal.style.alignItems = 'center';
                    modal.style.justifyContent = 'center';
                    modal.style.background = 'rgba(0, 0, 0, 0.5)';
                    modal.style.zIndex = '10000';
                }
            } else {
                modal.style.position = 'fixed';
                modal.style.top = '0';
                modal.style.left = '0';
                modal.style.right = '0';
                modal.style.bottom = '0';
                modal.style.display = 'flex';
                modal.style.alignItems = 'center';
                modal.style.justifyContent = 'center';
                modal.style.background = 'rgba(0, 0, 0, 0.5)';
                modal.style.zIndex = '10000';
            }

            // Fecha sidebar em telas médias quando abre o modal
            if (typeof window.fecharSidebarSeMedia === 'function') {
                window.fecharSidebarSeMedia();
            }
            
            modal.classList.remove('hidden');

            // Listener do botão enviar
            modal.querySelector('.btn-enviar-contraproposta').addEventListener('click', async () => {
                const valor = parseFloat(document.getElementById('contraproposta-valor').value);
                const justificativa = document.getElementById('contraproposta-justificativa').value.trim();
                
                if (!valor || valor <= 0) {
                    alert('Por favor, informe um valor válido maior que zero.');
                    return;
                }
                
                if (!justificativa) {
                    alert('Por favor, informe uma justificativa.');
                    return;
                }
                
                const btnEnviar = modal.querySelector('.btn-enviar-contraproposta');
                btnEnviar.disabled = true;
                btnEnviar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
                
                try {
                    const response = await fetch(`/api/times-projeto/${timeId}/contraproposta`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            tipo: tipo,
                            valor: valor,
                            justificativa: justificativa
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        modal.remove();
                        // Recarrega os times para atualizar a interface
                        setTimeout(() => {
                            carregarTimesLocais();
                        }, 500);
                        resolve(true);
                    } else {
                        btnEnviar.disabled = false;
                        btnEnviar.innerHTML = 'Enviar';
                        alert(data.message || 'Erro ao enviar contraproposta.');
                    }
                } catch (error) {
                    console.error('Erro ao enviar contraproposta:', error);
                    btnEnviar.disabled = false;
                    btnEnviar.innerHTML = 'Enviar';
                    alert('Erro ao enviar contraproposta. Verifique sua conexão e tente novamente.');
                }
            });

            // Listener do botão cancelar
            modal.querySelector('.btn-cancelar-contraproposta').addEventListener('click', () => {
                modal.remove();
                resolve(false);
            });

            // Fechar ao clicar fora
            const fecharModal = (e) => {
                if (!modalContent.contains(e.target) && e.target !== botao) {
                    modal.remove();
                    document.removeEventListener('click', fecharModal);
                    resolve(false);
                }
            };

            setTimeout(() => {
                document.addEventListener('click', fecharModal);
            }, 100);
        });
    }

    async function candidatarTime(timeId, botao) {
        if (!botao) {
            botao = document.querySelector(`.btn-candidatar[data-time-id="${timeId}"]`);
        }
        
        if (!botao) return;
        
        const icon = botao.querySelector('i');
        const text = botao.querySelector('.btn-candidatar-text');
        
        // Desabilita o botão durante a animação
        botao.disabled = true;
        
        try {
            // Animação: transição do ícone de mão para joia
            icon.style.transition = 'transform 0.4s ease, opacity 0.3s ease';
            icon.style.transform = 'scale(0) rotate(180deg)';
            icon.style.opacity = '0';
            
            setTimeout(() => {
                icon.className = 'fas fa-briefcase';
                icon.style.transform = 'scale(1.2) rotate(0deg)';
                icon.style.opacity = '1';
                
                // Efeito de brilho
                icon.style.animation = 'bagPulse 0.6s ease';
                
                setTimeout(() => {
                    icon.style.transform = 'scale(1)';
                    icon.style.animation = '';
                }, 600);
            }, 400);
            
            // Atualiza o texto
            if (text) {
                text.textContent = 'Candidatado';
            }
            
            // Faz a requisição
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
                // Atualiza o estado do botão
                botao.classList.add('candidatado');
                botao.dataset.jaCandidatou = 'true';
                botao.disabled = false;
                
                // Recarrega para atualizar contador
                setTimeout(() => {
                carregarTimesLocais();
                }, 1000);
            } else {
                // Reverte a animação em caso de erro
                icon.className = 'fas fa-hand-paper';
                icon.style.transform = 'scale(1)';
                if (text) text.textContent = 'Candidatar-se';
                botao.classList.remove('candidatado');
                botao.dataset.jaCandidatou = 'false';
                botao.disabled = false;
                alert(data.message || 'Erro ao candidatar-se.');
            }
        } catch (error) {
            console.error('Erro ao candidatar-se:', error);
            // Reverte a animação em caso de erro
            icon.className = 'fas fa-hand-paper';
            icon.style.transform = 'scale(1)';
            if (text) text.textContent = 'Candidatar-se';
            botao.classList.remove('candidatado');
            botao.dataset.jaCandidatou = 'false';
            botao.disabled = false;
            alert('Erro ao enviar candidatura.');
        }
    }

    async function cancelarCandidatura(timeId, botao) {
        if (!botao) {
            botao = document.querySelector(`.btn-candidatar[data-time-id="${timeId}"]`);
        }
        
        if (!botao) return;
        
        const icon = botao.querySelector('i');
        const text = botao.querySelector('.btn-candidatar-text');
        
        // Desabilita o botão durante a animação
        botao.disabled = true;
        
        try {
            // Animação reversa: joia para mão
            icon.style.transition = 'transform 0.4s ease, opacity 0.3s ease';
            icon.style.transform = 'scale(0) rotate(-180deg)';
            icon.style.opacity = '0';
            
            setTimeout(() => {
                icon.className = 'fas fa-hand-paper';
                icon.style.transform = 'scale(1) rotate(0deg)';
                icon.style.opacity = '1';
            }, 400);
            
            // Atualiza o texto
            if (text) {
                text.textContent = 'Candidatar-se';
            }
            
            // Faz a requisição
            const response = await fetch(`/api/times-projeto/${timeId}/candidatar`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                // Se a resposta não for OK, tenta ler o JSON de erro
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    errorData = { message: `Erro ${response.status}: ${response.statusText}` };
                }
                throw new Error(errorData.message || 'Erro ao cancelar candidatura');
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Atualiza o estado do botão
                botao.classList.remove('candidatado');
                botao.dataset.jaCandidatou = 'false';
                botao.disabled = false;
                
                // Recarrega para atualizar contador
                setTimeout(() => {
                    carregarTimesLocais();
                }, 1000);
            } else {
                // Reverte a animação em caso de erro
                icon.className = 'fas fa-briefcase';
                icon.style.transform = 'scale(1)';
                if (text) text.textContent = 'Candidatado';
                botao.classList.add('candidatado');
                botao.dataset.jaCandidatou = 'true';
                botao.disabled = false;
                alert(data.message || 'Erro ao cancelar candidatura.');
            }
        } catch (error) {
            console.error('Erro ao cancelar candidatura:', error);
            // Reverte a animação em caso de erro
            icon.className = 'fas fa-briefcase';
            icon.style.transform = 'scale(1)';
            if (text) text.textContent = 'Candidatado';
            botao.classList.add('candidatado');
            botao.dataset.jaCandidatou = 'true';
            botao.disabled = false;
            alert(error.message || 'Erro ao cancelar candidatura. Verifique sua conexão e tente novamente.');
        }
    }

    // Função para mostrar modal de confirmação de deletar time
    function mostrarConfirmacaoDeletarTime(botao, timeId) {
        return new Promise((resolve) => {
            // Remove modal anterior se existir
            const modalAnterior = document.getElementById('modal-confirmar-deletar-time');
            if (modalAnterior) {
                modalAnterior.remove();
            }

            // Cria novo modal
            const modal = document.createElement('div');
            modal.id = 'modal-confirmar-deletar-time';
            modal.className = 'modal-overlay';
            document.body.appendChild(modal);

            modal.innerHTML = `
                <div class="modal-content modal-confirmacao-deletar">
                    <div class="modal-body">
                        <div class="confirmacao-deletar-content">
                            <p class="confirmacao-deletar-mensagem">Tem certeza?</p>
                            <div class="confirmacao-deletar-botoes">
                                <button class="btn-cancelar-deletar" data-acao="cancelar">Não</button>
                                <button class="btn-confirmar-deletar" data-acao="confirmar">Sim</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Posiciona o modal similar ao modal de candidatos
            const botaoRect = botao.getBoundingClientRect();
            const isMobile = window.innerWidth <= 767;
            const isMedia = window.innerWidth >= 768 && window.innerWidth <= 992;
            const modalContent = modal.querySelector('.modal-content');

            if (!isMobile && !isMedia) {
                // Em telas maiores, posiciona FORA do container, ao lado (lateral) - igual ao modal de candidatos
                const filtroTimesLocais = document.querySelector('.filtro-times-locais');
                
                if (filtroTimesLocais) {
                    const containerRect = filtroTimesLocais.getBoundingClientRect();
                    const header = document.querySelector('header');
                    const headerRect = header ? header.getBoundingClientRect() : { bottom: 0 };
                    const headerBottom = headerRect.bottom || 0;
                    
                    // Calcula a posição do modal (desceu pela metade - estava em 10px, agora 35px)
                    let modalTop = containerRect.top + 35;
                    
                    // O modal sempre fica abaixo do cabeçalho (z-index menor que 1000)
                    // Se o modal estiver acima do cabeçalho visualmente, ajusta a posição
                    if (modalTop < headerBottom) {
                        // Se o modal estiver atrás do cabeçalho, ajusta para ficar abaixo
                        modalTop = headerBottom + 10;
                    }

                    // Posiciona o modal fixo na tela, ao lado do container de times locais
                    modal.style.position = 'fixed';
                    modal.style.top = `${containerRect.top}px`;
                    modal.style.left = `${containerRect.left}px`;
                    modal.style.width = `${containerRect.width}px`;
                    modal.style.height = `${containerRect.height}px`;
                    modal.style.display = 'flex';
                    modal.style.alignItems = 'flex-start';
                    modal.style.justifyContent = 'flex-start';
                    modal.style.padding = '0';
                    modal.style.background = 'transparent';
                    modal.style.zIndex = '10000';
                    modal.style.pointerEvents = 'none';
                    modal.style.overflow = 'visible';

                    // Verifica se há espaço à direita
                    const larguraDisponivel = window.innerWidth - containerRect.right - 32;
                    const larguraModal = Math.min(200, larguraDisponivel);

                    modalContent.style.position = 'fixed';
                    modalContent.style.top = `${modalTop}px`;
                    
                    if (larguraDisponivel >= 150) {
                        modalContent.style.left = `${containerRect.right + 16}px`;
                        modalContent.style.right = 'auto';
                    } else {
                        modalContent.style.left = 'auto';
                        modalContent.style.right = `${window.innerWidth - containerRect.left + 16}px`;
                    }
                    
                    modalContent.style.maxWidth = `${larguraModal}px`;
                    modalContent.style.pointerEvents = 'auto';
                    modalContent.style.zIndex = '999'; // Sempre abaixo do cabeçalho (z-index 1000)
                    
                    // Atualiza a posição quando a janela redimensiona ou quando o container rola
                    const atualizarPosicaoModal = () => {
                        if (!document.body.contains(modal)) return;
                        
                        const novoContainerRect = filtroTimesLocais.getBoundingClientRect();
                        const novoBotaoRect = botao.getBoundingClientRect();
                        
                        // Obtém a posição do cabeçalho
                        const novoHeaderRect = header ? header.getBoundingClientRect() : { bottom: 0 };
                        const novoHeaderBottom = novoHeaderRect.bottom || 0;
                        
                        // Atualiza a área do modal
                        modal.style.top = `${novoContainerRect.top}px`;
                        modal.style.left = `${novoContainerRect.left}px`;
                        modal.style.width = `${novoContainerRect.width}px`;
                        modal.style.height = `${novoContainerRect.height}px`;
                        
                        // Calcula a posição do modal
                        let novoModalTop = novoContainerRect.top + 35;
                        
                        // O modal sempre fica abaixo do cabeçalho (z-index menor que 1000)
                        // Se o modal estiver acima do cabeçalho visualmente, ajusta a posição
                        if (novoModalTop < novoHeaderBottom) {
                            // Se o modal estiver atrás do cabeçalho, ajusta para ficar abaixo
                            novoModalTop = novoHeaderBottom + 10;
                        }
                        
                        // Atualiza a posição do conteúdo
                        modalContent.style.top = `${novoModalTop}px`;
                        modalContent.style.zIndex = '999'; // Sempre abaixo do cabeçalho (z-index 1000)
                        
                        // Verifica se há espaço à direita
                        const novoLarguraDisponivel = window.innerWidth - novoContainerRect.right - 32;
                        const novoLarguraModal = Math.min(200, novoLarguraDisponivel);
                        
                        if (novoLarguraDisponivel >= 150) {
                            modalContent.style.left = `${novoContainerRect.right + 16}px`;
                            modalContent.style.right = 'auto';
                        } else {
                            modalContent.style.left = 'auto';
                            modalContent.style.right = `${window.innerWidth - novoContainerRect.left + 16}px`;
                        }
                        
                        modalContent.style.maxWidth = `${novoLarguraModal}px`;
                    };
                    
                    // Adiciona listeners para atualizar posição
                    const timesContainer = document.querySelector('.times-container-lateral');
                    if (timesContainer) {
                        timesContainer.addEventListener('scroll', atualizarPosicaoModal);
                    }
                    window.addEventListener('resize', atualizarPosicaoModal);
                    window.addEventListener('scroll', atualizarPosicaoModal);
                    
                    // Remove os listeners quando o modal for fechado
                    const removerListeners = () => {
                        if (timesContainer) {
                            timesContainer.removeEventListener('scroll', atualizarPosicaoModal);
                        }
                        window.removeEventListener('resize', atualizarPosicaoModal);
                        window.removeEventListener('scroll', atualizarPosicaoModal);
                    };
                    
                    // Observa quando o modal é removido
                    const observer = new MutationObserver(() => {
                        if (!document.body.contains(modal)) {
                            removerListeners();
                            observer.disconnect();
                        }
                    });
                    observer.observe(document.body, { childList: true, subtree: true });
                    
                    // Armazena a função de remoção no modal para usar no fecharModal
                    modal._removerListeners = removerListeners;
                } else {
                    // Fallback
                    modal.style.position = 'fixed';
                    modal.style.top = '0';
                    modal.style.left = '0';
                    modal.style.right = '0';
                    modal.style.bottom = '0';
                    modal.style.display = 'flex';
                    modal.style.alignItems = 'center';
                    modal.style.justifyContent = 'center';
                    modal.style.background = 'rgba(0, 0, 0, 0.5)';
                    modal.style.zIndex = '10000';
                }
            } else {
                // Em telas menores, centraliza
                modal.style.position = 'fixed';
                modal.style.top = '0';
                modal.style.left = '0';
                modal.style.right = '0';
                modal.style.bottom = '0';
                modal.style.display = 'flex';
                modal.style.alignItems = 'center';
                modal.style.justifyContent = 'center';
                modal.style.background = 'rgba(0, 0, 0, 0.5)';
                modal.style.zIndex = '10000';
            }

            modal.classList.remove('hidden');

            // Listeners dos botões
            modal.querySelector('.btn-confirmar-deletar').addEventListener('click', () => {
                modal.remove();
                resolve(true);
            });

            modal.querySelector('.btn-cancelar-deletar').addEventListener('click', () => {
                modal.remove();
                resolve(false);
            });

            // Fechar ao clicar fora
            const fecharModal = (e) => {
                if (!modalContent.contains(e.target) && e.target !== botao) {
                    // Remove listeners se existirem
                    if (modal._removerListeners) {
                        modal._removerListeners();
                    }
                    modal.remove();
                    document.removeEventListener('click', fecharModal);
                    resolve(false);
                }
            };

            setTimeout(() => {
                document.addEventListener('click', fecharModal);
            }, 100);
        });
    }

    // Função para deletar time
    async function deletarTime(timeId) {
        try {
            const token = localStorage.getItem('jwtToken');
            if (!token) {
                alert('Você precisa estar logado para deletar um time.');
                return;
            }

            const response = await fetch(`/api/times-projeto/${timeId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                // Remove o card do time da interface
                const timeCard = document.querySelector(`.btn-deletar-time[data-time-id="${timeId}"]`)?.closest('.time-card');
                if (timeCard) {
                    timeCard.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                    timeCard.style.opacity = '0';
                    timeCard.style.transform = 'scale(0.95)';
                    setTimeout(() => {
                        timeCard.remove();
                        // Recarrega os times para atualizar a lista
                        carregarTimesLocais();
                    }, 300);
                } else {
                    // Se não encontrar o card, apenas recarrega
                    carregarTimesLocais();
                }
                // Removido alert de sucesso - não precisa aparecer nada
            } else {
                alert(data.message || 'Erro ao deletar time. Tente novamente.');
            }
        } catch (error) {
            console.error('Erro ao deletar time:', error);
            alert('Erro ao deletar time. Verifique sua conexão e tente novamente.');
        }
    }

    // Função global para abrir modal de proposta aceita
    window.abrirModalPropostaAceita = async function(dadosAdicionais) {
        try {
            const modal = document.getElementById('modal-proposta-aceita');
            if (!modal) {
                console.error('Modal de proposta aceita não encontrado');
                return;
            }

            // Busca dados do time
            const timeId = dadosAdicionais.timeId;
            const token = localStorage.getItem('jwtToken');
            
            console.log('🔍 Abrindo modal de proposta aceita:', { timeId, dadosAdicionais });
            
            if (!token || !timeId) {
                console.error('Token ou timeId não encontrado:', { token: !!token, timeId });
                alert('Erro: dados da notificação incompletos.');
                return;
            }

            // Busca dados completos do time
            const response = await fetch(`/api/times-projeto/${timeId}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                cache: 'no-cache'
            });

            console.log('📡 Resposta da API:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Erro na resposta:', errorText);
                throw new Error(`Erro ao buscar dados do time: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log('📦 Dados recebidos:', data);
            
            if (!data.success || !data.time) {
                throw new Error('Time não encontrado na resposta');
            }

            const time = data.time;
            const valorAceito = dadosAdicionais.valorAceito || 0;
            // Monta endereço completo com rua e número se disponíveis
            const enderecoParts = [];
            if (time.localizacao.rua) enderecoParts.push(time.localizacao.rua);
            if (time.localizacao.numero) enderecoParts.push(`Nº ${time.localizacao.numero}`);
            if (time.localizacao.bairro) enderecoParts.push(time.localizacao.bairro);
            if (time.localizacao.cidade) enderecoParts.push(time.localizacao.cidade);
            if (time.localizacao.estado) enderecoParts.push(time.localizacao.estado);
            const enderecoCompleto = dadosAdicionais.enderecoCompleto || (enderecoParts.length > 0 ? enderecoParts.join(', ') : `${time.localizacao.bairro}, ${time.localizacao.cidade} - ${time.localizacao.estado}`);
            const cliente = time.clienteId || {};
            const clienteNome = cliente.nome || dadosAdicionais.clienteNome || 'Cliente';
            const clienteTelefone = cliente.telefone || dadosAdicionais.clienteTelefone || '';
            const clienteId = cliente._id || cliente.id || '';
            const clienteFoto = cliente.foto || cliente.avatarUrl || '/imagens/default-user.png';

            // Preenche o perfil do cliente no header
            const perfilLink = document.getElementById('proposta-aceita-perfil-link');
            const perfilAvatar = document.getElementById('proposta-aceita-perfil-avatar');
            const perfilNome = document.getElementById('proposta-aceita-perfil-nome');
            
            if (perfilLink && perfilAvatar && perfilNome) {
                if (clienteId) {
                    perfilLink.href = `/perfil.html?id=${clienteId}`;
                    perfilLink.style.display = 'flex';
                } else {
                    perfilLink.style.display = 'none';
                }
                perfilAvatar.src = clienteFoto;
                perfilAvatar.onerror = function() {
                    this.src = '/imagens/default-user.png';
                };
                perfilNome.textContent = clienteNome;
            }

            // Preenche os dados no modal
            document.getElementById('proposta-aceita-titulo-projeto').textContent = time.titulo || '-';
            document.getElementById('proposta-aceita-valor').textContent = `R$ ${valorAceito.toFixed(2).replace('.', ',')}`;
            
            // Endereço clicável (abre no Google Maps)
            const enderecoLink = document.getElementById('proposta-aceita-endereco-link');
            if (enderecoLink) {
                enderecoLink.textContent = enderecoCompleto;
                // Cria link do Google Maps
                const enderecoEncoded = encodeURIComponent(enderecoCompleto);
                enderecoLink.href = `https://www.google.com/maps/search/?api=1&query=${enderecoEncoded}`;
            }

            // Cria mensagem do WhatsApp
            const mensagemWhatsApp = encodeURIComponent(
                `Olá! Minha proposta foi aceita no site para o projeto "${time.titulo}". Vamos combinar os detalhes?`
            );
            
            // Cria link do WhatsApp
            let whatsappLink = `https://wa.me/${clienteTelefone.replace(/\D/g, '')}?text=${mensagemWhatsApp}`;
            
            // Se não tiver telefone, usa um link genérico
            if (!clienteTelefone || clienteTelefone.trim() === '') {
                whatsappLink = `https://wa.me/?text=${mensagemWhatsApp}`;
            }

            const btnWhatsApp = document.getElementById('btn-whatsapp-proposta');
            if (btnWhatsApp) {
                btnWhatsApp.href = whatsappLink;
            }

            // Abre o modal
            // Fecha sidebar em telas médias quando abre o modal
            if (typeof window.fecharSidebarSeMedia === 'function') {
                window.fecharSidebarSeMedia();
            }
            
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden'; // Previne scroll do body

            // Fecha o modal ao clicar no backdrop ou no botão fechar
            const backdrop = modal.querySelector('.modal-proposta-aceita-backdrop');
            const btnClose = modal.querySelector('.modal-proposta-aceita-close');

            const fecharModal = () => {
                modal.classList.add('hidden');
                document.body.style.overflow = '';
            };

            if (backdrop) {
                backdrop.onclick = fecharModal;
            }

            if (btnClose) {
                btnClose.onclick = fecharModal;
            }

            // Fecha com ESC
            const handleEsc = (e) => {
                if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                    fecharModal();
                    document.removeEventListener('keydown', handleEsc);
                }
            };
            document.addEventListener('keydown', handleEsc);

        } catch (error) {
            console.error('Erro ao abrir modal de proposta aceita:', error);
            alert('Erro ao carregar informações da proposta aceita.');
        }
    };

    // Função global para abrir candidatos a partir de notificação
    window.abrirCandidatosPorNotificacao = async function(timeId, profissionalId = null, tipoNotificacao = null, candidatoId = null) {
        try {
            console.log('🔔 Abrindo candidatos por notificação, timeId:', timeId, 'profissionalId:', profissionalId, 'tipoNotificacao:', tipoNotificacao);
            const token = localStorage.getItem('jwtToken');
            if (!token) {
                console.error('Token não encontrado');
                return false; // Retorna false para indicar que não foi bem-sucedido
            }
            
            // Verifica se o modal de notificações está aberto
            const modalNotificacoes = document.getElementById('modal-notificacoes');
            const modalEstaAberto = modalNotificacoes && !modalNotificacoes.classList.contains('hidden');
            
            // Busca o time específico - busca todos os times e filtra
            const response = await fetch(`/api/times-projeto?t=${Date.now()}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                cache: 'no-cache'
            });
            
            if (!response.ok) {
                // Se a resposta não for OK (ex: 404), verifica se foi concluído ou removido
                if (response.status === 404) {
                    // Tenta buscar o time incluindo concluídos para verificar se foi concluído
                    let mensagemFinal = 'Esta equipe foi removida.';
                    try {
                        const responseConcluidos = await fetch(`/api/times-projeto?status=concluido&t=${Date.now()}`, {
                            headers: { 'Authorization': `Bearer ${token}` },
                            cache: 'no-cache'
                        });
                        
                        if (responseConcluidos.ok) {
                            const dataConcluidos = await responseConcluidos.json();
                            if (dataConcluidos.success && dataConcluidos.times) {
                                const timeConcluido = dataConcluidos.times.find(t => {
                                    const tId = t._id?.toString() || t._id;
                                    const searchId = timeId?.toString() || timeId;
                                    return tId === searchId;
                                });
                                
                                if (timeConcluido && timeConcluido.status === 'concluido') {
                                    mensagemFinal = 'Esta equipe já foi concluída.';
                                }
                            }
                        }
                    } catch (err) {
                        console.warn('Erro ao verificar time concluído:', err);
                    }
                    
                    // Garante que o modal de notificações está aberto
                    const modalNotificacoes = document.getElementById('modal-notificacoes');
                    const mensagemProposta = document.getElementById('mensagem-proposta-respondida');
                    const mensagemTexto = document.getElementById('mensagem-proposta-texto');
                    
                    if (modalNotificacoes && mensagemProposta && mensagemTexto) {
                        // Define o flag ANTES de qualquer coisa para evitar recarregamento
                        window.temMensagemErroNotificacao = true;
                        
                        // Abre o modal se estiver fechado
                        if (modalNotificacoes.classList.contains('hidden')) {
                            modalNotificacoes.classList.remove('hidden');
                        }
                        
                        mensagemTexto.textContent = mensagemFinal;
                        mensagemProposta.style.display = 'block';
                        
                        // Remove o flag após um tempo para permitir recarregamento futuro
                        setTimeout(() => {
                            window.temMensagemErroNotificacao = false;
                        }, 5000);
                    }
                    return false; // Retorna false para indicar erro
                }
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            console.log('📋 Dados recebidos:', data);
            
            if (data.success && data.times) {
                // Tenta encontrar o time pelo ID (pode ser string ou ObjectId)
                const time = data.times.find(t => {
                    const tId = t._id?.toString() || t._id;
                    const searchId = timeId?.toString() || timeId;
                    return tId === searchId;
                });
                console.log('🔍 Time encontrado:', time);
                console.log('🔍 TimeId buscado:', timeId);
                console.log('🔍 Times disponíveis:', data.times.map(t => ({ id: t._id, titulo: t.titulo })));
                
                if (!time) {
                    // Time não encontrado - verifica se foi concluído ou removido
                    console.error('❌ Time não encontrado com ID:', timeId);
                    
                    // Tenta buscar o time incluindo concluídos para verificar se foi concluído
                    let mensagemFinal = 'Esta equipe foi removida.';
                    try {
                        const responseConcluidos = await fetch(`/api/times-projeto?status=concluido&t=${Date.now()}`, {
                            headers: { 'Authorization': `Bearer ${token}` },
                            cache: 'no-cache'
                        });
                        
                        if (responseConcluidos.ok) {
                            const dataConcluidos = await responseConcluidos.json();
                            if (dataConcluidos.success && dataConcluidos.times) {
                                const timeConcluido = dataConcluidos.times.find(t => {
                                    const tId = t._id?.toString() || t._id;
                                    const searchId = timeId?.toString() || timeId;
                                    return tId === searchId;
                                });
                                
                                if (timeConcluido && timeConcluido.status === 'concluido') {
                                    mensagemFinal = 'Esta equipe já foi concluída.';
                                }
                            }
                        }
                    } catch (err) {
                        console.warn('Erro ao verificar time concluído:', err);
                    }
                    
                    // Garante que o modal de notificações está aberto
                    const modalNotificacoes = document.getElementById('modal-notificacoes');
                    const mensagemProposta = document.getElementById('mensagem-proposta-respondida');
                    const mensagemTexto = document.getElementById('mensagem-proposta-texto');
                    
                    if (modalNotificacoes && mensagemProposta && mensagemTexto) {
                        // Define o flag ANTES de qualquer coisa para evitar recarregamento
                        window.temMensagemErroNotificacao = true;
                        
                        // Abre o modal se estiver fechado
                        if (modalNotificacoes.classList.contains('hidden')) {
                            modalNotificacoes.classList.remove('hidden');
                        }
                        
                        mensagemTexto.textContent = mensagemFinal;
                        mensagemProposta.style.display = 'block';
                        
                        // Remove o flag após um tempo para permitir recarregamento futuro
                        setTimeout(() => {
                            window.temMensagemErroNotificacao = false;
                        }, 5000);
                    }
                    return false; // Retorna false para indicar erro
                }
                
                if (time) {
                    // Verifica se o time foi concluído ANTES de processar
                    if (time.status === 'concluido') {
                        // Garante que o modal de notificações está aberto
                        const modalNotificacoes = document.getElementById('modal-notificacoes');
                        const mensagemProposta = document.getElementById('mensagem-proposta-respondida');
                        const mensagemTexto = document.getElementById('mensagem-proposta-texto');
                        
                        if (modalNotificacoes && mensagemProposta && mensagemTexto) {
                            // Define o flag ANTES de qualquer coisa para evitar recarregamento
                            window.temMensagemErroNotificacao = true;
                            
                            // Abre o modal se estiver fechado
                            if (modalNotificacoes.classList.contains('hidden')) {
                                modalNotificacoes.classList.remove('hidden');
                            }
                            
                            mensagemTexto.textContent = 'Esta equipe já foi concluída.';
                            mensagemProposta.style.display = 'block';
                            
                            // Remove o flag após um tempo para permitir recarregamento futuro
                            setTimeout(() => {
                                window.temMensagemErroNotificacao = false;
                            }, 5000);
                        }
                        return false; // Não abre o modal de candidatos
                    }
                    
                    // Popula candidatos se necessário
                    // Verifica se há um candidato específico para esta notificação (por candidatoId)
                    // Busca o time completo com candidatos populados para verificar o status
                    try {
                        const timeCompletoResponse = await fetch(`/api/times-projeto/${timeId}`, {
                            headers: { 'Authorization': `Bearer ${token}` },
                            cache: 'no-cache'
                        });
                        
                        if (timeCompletoResponse.ok) {
                            const timeCompletoData = await timeCompletoResponse.json();
                            if (timeCompletoData.success && timeCompletoData.time) {
                                time = timeCompletoData.time; // Atualiza o time com dados completos
                                
                                // Verifica novamente se foi concluído após buscar dados completos
                                if (time.status === 'concluido') {
                                    // Garante que o modal de notificações está aberto
                                    const modalNotificacoes = document.getElementById('modal-notificacoes');
                                    const mensagemProposta = document.getElementById('mensagem-proposta-respondida');
                                    const mensagemTexto = document.getElementById('mensagem-proposta-texto');
                                    
                                    if (modalNotificacoes && mensagemProposta && mensagemTexto) {
                                        // Define o flag ANTES de qualquer coisa para evitar recarregamento
                                        window.temMensagemErroNotificacao = true;
                                        
                                        // Abre o modal se estiver fechado
                                        if (modalNotificacoes.classList.contains('hidden')) {
                                            modalNotificacoes.classList.remove('hidden');
                                        }
                                        
                                        mensagemTexto.textContent = 'Esta equipe já foi concluída.';
                                        mensagemProposta.style.display = 'block';
                                        
                                        // Remove o flag após um tempo para permitir recarregamento futuro
                                        setTimeout(() => {
                                            window.temMensagemErroNotificacao = false;
                                        }, 5000);
                                    }
                                    return false; // Não abre o modal de candidatos
                                }
                            }
                        }
                    } catch (err) {
                        console.warn('Erro ao buscar time completo:', err);
                    }
                    
                    // Verifica se há candidatoId na notificação (identificação específica)
                    // Se não tiver candidatoId, não podemos identificar qual candidato específico a notificação se refere
                    const candidatos = time.candidatos || [];
                    let candidatoEspecifico = null;
                    
                    console.log('🔍 Verificando candidato específico:', { candidatoId, profissionalId, totalCandidatos: candidatos.length });
                    
                    // Primeiro tenta encontrar pelo candidatoId (mais específico - como nos pedidos urgentes)
                    if (candidatoId) {
                        candidatoEspecifico = candidatos.find(c => {
                            const cId = c._id?.toString() || c._id;
                            const searchId = candidatoId?.toString() || candidatoId;
                            const match = cId === searchId;
                            if (match) {
                                console.log('✅ Candidato encontrado pelo candidatoId:', { cId, searchId, status: c.status });
                            }
                            return match;
                        });
                        
                        if (!candidatoEspecifico) {
                            console.warn('⚠️ CandidatoId fornecido mas não encontrado - candidato foi recusado/removido:', candidatoId);
                            // Se não encontrou o candidato pelo ID, significa que foi recusado (removido do array)
                            // Garante que o modal de notificações está aberto
                            const modalNotificacoes = document.getElementById('modal-notificacoes');
                            const mensagemProposta = document.getElementById('mensagem-proposta-respondida');
                            const mensagemTexto = document.getElementById('mensagem-proposta-texto');
                            
                            if (modalNotificacoes && mensagemProposta && mensagemTexto) {
                                // Define o flag ANTES de qualquer coisa para evitar recarregamento
                                window.temMensagemErroNotificacao = true;
                                
                                // Abre o modal se estiver fechado
                                if (modalNotificacoes.classList.contains('hidden')) {
                                    modalNotificacoes.classList.remove('hidden');
                                }
                                
                                mensagemTexto.textContent = 'Esta proposta/candidatura já foi recusada.';
                                mensagemProposta.style.display = 'block';
                                
                                // Remove o flag após um tempo para permitir recarregamento futuro (aumentado para evitar piscar)
                                setTimeout(() => {
                                    window.temMensagemErroNotificacao = false;
                                }, 5000);
                            }
                            return false; // Não abre o modal
                        }
                    } else {
                        console.warn('⚠️ Notificação sem candidatoId - não é possível identificar candidato específico');
                        // Se não tem candidatoId, não podemos identificar qual candidato específico
                        // Verifica se há candidatos do profissional que já foram respondidos
                        if (profissionalId) {
                            const candidatosDoProfissional = candidatos.filter(c => {
                                const cProfId = c.profissionalId?._id?.toString() || c.profissionalId?.toString() || c.profissionalId;
                                const searchProfId = profissionalId?.toString() || profissionalId;
                                return cProfId === searchProfId;
                            });
                            
                            console.log('🔍 Candidatos do profissional (sem candidatoId):', candidatosDoProfissional.length);
                            
                            // Se TODOS os candidatos do profissional já foram respondidos, mostra mensagem
                            const todosRespondidos = candidatosDoProfissional.length > 0 && 
                                candidatosDoProfissional.every(c => {
                                    const status = c.status || 'pendente';
                                    return status !== 'pendente';
                                });
                            
                            if (todosRespondidos) {
                                console.log('✅ Todos os candidatos do profissional já foram respondidos');
                                // Garante que o modal de notificações está aberto
                                const modalNotificacoes = document.getElementById('modal-notificacoes');
                                const mensagemProposta = document.getElementById('mensagem-proposta-respondida');
                                const mensagemTexto = document.getElementById('mensagem-proposta-texto');
                                
                                if (modalNotificacoes && mensagemProposta && mensagemTexto) {
                                    // Abre o modal se estiver fechado
                                    if (modalNotificacoes.classList.contains('hidden')) {
                                        modalNotificacoes.classList.remove('hidden');
                                    }
                                    
                                    mensagemTexto.textContent = 'Esta notificação não pode ser aberta porque não é possível identificar qual proposta específica ela se refere.';
                                    mensagemProposta.style.display = 'block';
                                    
                                    setTimeout(() => {
                                        mensagemProposta.style.display = 'none';
                                    }, 5000);
                                }
                                return false;
                            }
                            // Se houver candidatos pendentes, não faz nada aqui - deixa abrir o modal normalmente
                            // mas não destaca nenhum candidato específico
                        }
                    }
                    
                    // Se encontrou o candidato específico pelo candidatoId, verifica se ainda está pendente
                    if (candidatoEspecifico) {
                        const status = candidatoEspecifico.status || 'pendente';
                        console.log('🔍 Status do candidato específico:', status);
                        if (status !== 'pendente') {
                            // Candidatura já foi respondida
                            const statusTexto = status === 'aceito' ? 'aceita' : status === 'rejeitado' ? 'recusada' : 'respondida';
                            // Garante que o modal de notificações está aberto
                            const modalNotificacoes = document.getElementById('modal-notificacoes');
                            const mensagemProposta = document.getElementById('mensagem-proposta-respondida');
                            const mensagemTexto = document.getElementById('mensagem-proposta-texto');
                            
                            if (modalNotificacoes && mensagemProposta && mensagemTexto) {
                                // Define o flag ANTES de qualquer coisa para evitar recarregamento
                                window.temMensagemErroNotificacao = true;
                                
                                // Abre o modal se estiver fechado
                                if (modalNotificacoes.classList.contains('hidden')) {
                                    modalNotificacoes.classList.remove('hidden');
                                }
                                
                                mensagemTexto.textContent = `Esta proposta/candidatura já foi ${statusTexto}.`;
                                mensagemProposta.style.display = 'block';
                                
                                // Remove o flag após um tempo para permitir recarregamento futuro (aumentado para evitar piscar)
                                setTimeout(() => {
                                    window.temMensagemErroNotificacao = false;
                                }, 5000);
                            }
                            return false;
                        }
                    }
                    if (time.candidatos && time.candidatos.length > 0) {
                        console.log('👥 Candidatos no time:', time.candidatos.length);
                        const candidatosPendentes = time.candidatos.filter(c => c.status === 'pendente');
                        console.log('⏳ Candidatos pendentes:', candidatosPendentes.length);
                    }
                    
                    const isMobile = window.innerWidth <= 767;
                    const isMedia = window.innerWidth >= 768 && window.innerWidth <= 992;
                    
                    // Em todas as telas (médias, menores e maiores), rola até o time antes de abrir o modal
                    // Sempre executa o scroll para todas as telas
                    // Abre o menu lateral se estiver fechado (apenas em telas médias e menores)
                    if (isMobile || isMedia) {
                        const categoriasAside = document.querySelector('.categorias');
                        if (categoriasAside && !categoriasAside.classList.contains('aberta')) {
                            const mobileSidebarToggle = document.getElementById('mobile-sidebar-toggle');
                            if (mobileSidebarToggle) {
                                mobileSidebarToggle.click();
                            }
                        }
                    }
                    
                    // Aguarda o menu abrir (se necessário) e depois rola até o time
                    const delayMenu = (isMobile || isMedia) ? 200 : 0;
                    setTimeout(() => {
                            // Primeiro, rola a página até a seção de times locais
                            const filtroTimesLocais = document.querySelector('.filtro-times-locais');
                            if (filtroTimesLocais) {
                                filtroTimesLocais.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                            
                            // Aguarda um pouco e depois procura o time card (reduzido de 500ms para 200ms)
                            setTimeout(() => {
                                // Procura o time card pelo ID - tenta várias formas
                                let timeCardEncontrado = null;
                                let botaoEncontrado = null;
                                
                                // Primeiro tenta encontrar pelo botão
                                botaoEncontrado = document.querySelector(`.btn-ver-candidatos[data-time-id="${timeId}"]`);
                                if (botaoEncontrado) {
                                    timeCardEncontrado = botaoEncontrado.closest('.time-card');
                                }
                                
                                // Se não encontrou, procura em todos os time cards
                                if (!timeCardEncontrado) {
                                    const timeCards = document.querySelectorAll('.time-card');
                                    timeCards.forEach(card => {
                                        const btnVerCandidatos = card.querySelector(`.btn-ver-candidatos[data-time-id="${timeId}"]`);
                                        if (btnVerCandidatos) {
                                            timeCardEncontrado = card;
                                            botaoEncontrado = btnVerCandidatos;
                                        }
                                    });
                                }
                                
                                if (timeCardEncontrado && botaoEncontrado) {
                                    // Rola até o time card dentro do container de times
                                    const timesContainer = document.querySelector('.times-container-lateral');
                                    if (timesContainer) {
                                        // Primeiro rola a página até o card se necessário
                                        const cardRect = timeCardEncontrado.getBoundingClientRect();
                                        const containerRect = timesContainer.getBoundingClientRect();
                                        
                                        // Se o card não está visível, rola a página primeiro
                                        if (cardRect.top < containerRect.top || cardRect.bottom > containerRect.bottom) {
                                            timeCardEncontrado.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            
                                            // Aguarda o scroll da página e depois rola dentro do container (reduzido de 500ms para 200ms)
                                            setTimeout(() => {
                                                const novoCardRect = timeCardEncontrado.getBoundingClientRect();
                                                const novoContainerRect = timesContainer.getBoundingClientRect();
                                                const scrollTop = timesContainer.scrollTop;
                                                const targetScroll = scrollTop + (novoCardRect.top - novoContainerRect.top) - (novoContainerRect.height / 2) + (novoCardRect.height / 2);
                                                
                                                timesContainer.scrollTo({
                                                    top: Math.max(0, targetScroll),
                                                    behavior: 'smooth'
                                                });
                                                
                                                // Aguarda o scroll e depois abre o modal (reduzido de 600ms para 300ms)
                                                setTimeout(() => {
                                                    // Destaca o candidato se:
                                                    // 1. For notificação de confirmar_perfil_time (sempre destaca)
                                                    // 2. Ou se tiver candidatoId e o candidato específico estiver pendente
                                                    const profissionalIdParaDestacar = (tipoNotificacao === 'confirmar_perfil_time' && candidatoEspecifico) || 
                                                        (candidatoId && candidatoEspecifico && candidatoEspecifico.status === 'pendente')
                                                        ? profissionalId 
                                                        : null;
                                                    console.log('🎯 Destacando candidato:', { profissionalIdParaDestacar, tipoNotificacao, candidatoId, status: candidatoEspecifico?.status });
                                                    mostrarCandidatosTime(time, botaoEncontrado, profissionalIdParaDestacar, tipoNotificacao);
                                                }, 300);
                                            }, 200);
                                        } else {
                                            // O card já está visível, apenas rola dentro do container
                                            const scrollTop = timesContainer.scrollTop;
                                            const targetScroll = scrollTop + (cardRect.top - containerRect.top) - (containerRect.height / 2) + (cardRect.height / 2);
                                            
                                            timesContainer.scrollTo({
                                                top: Math.max(0, targetScroll),
                                                behavior: 'smooth'
                                            });
                                            
                                            // Aguarda o scroll e depois abre o modal (reduzido de 600ms para 300ms)
                                            setTimeout(() => {
                                                // Destaca o candidato se:
                                                // 1. For notificação de confirmar_perfil_time (sempre destaca)
                                                // 2. Ou se tiver candidatoId e o candidato específico estiver pendente
                                                const profissionalIdParaDestacar = (tipoNotificacao === 'confirmar_perfil_time' && candidatoEspecifico) || 
                                                    (candidatoId && candidatoEspecifico && candidatoEspecifico.status === 'pendente')
                                                    ? profissionalId 
                                                    : null;
                                                console.log('🎯 Destacando candidato:', { profissionalIdParaDestacar, tipoNotificacao, candidatoId, status: candidatoEspecifico?.status });
                                                mostrarCandidatosTime(time, botaoEncontrado, profissionalIdParaDestacar, tipoNotificacao);
                                            }, 300);
                                        }
                                    } else {
                                        // Fallback: scroll normal
                                        timeCardEncontrado.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        
                                        setTimeout(() => {
                                            // Destaca o candidato se:
                                            // 1. For notificação de confirmar_perfil_time (sempre destaca)
                                            // 2. Ou se tiver candidatoId e o candidato específico estiver pendente
                                            const profissionalIdParaDestacar = (tipoNotificacao === 'confirmar_perfil_time' && candidatoEspecifico) || 
                                                (candidatoId && candidatoEspecifico && candidatoEspecifico.status === 'pendente')
                                                ? profissionalId 
                                                : null;
                                            console.log('🎯 Destacando candidato:', { profissionalIdParaDestacar, tipoNotificacao, candidatoId, status: candidatoEspecifico?.status });
                                            mostrarCandidatosTime(time, botaoEncontrado, profissionalIdParaDestacar, tipoNotificacao);
                                        }, 300);
                                    }
                                } else {
                                    // Se não encontrar o card, tenta abrir o modal mesmo assim
                                    if (botaoEncontrado) {
                                        setTimeout(() => {
                                            // Destaca o candidato se:
                                            // 1. For notificação de confirmar_perfil_time (sempre destaca)
                                            // 2. Ou se tiver candidatoId e o candidato específico estiver pendente
                                            const profissionalIdParaDestacar = (tipoNotificacao === 'confirmar_perfil_time' && candidatoEspecifico) || 
                                                (candidatoId && candidatoEspecifico && candidatoEspecifico.status === 'pendente')
                                                ? profissionalId 
                                                : null;
                                            console.log('🎯 Destacando candidato:', { profissionalIdParaDestacar, tipoNotificacao, candidatoId, status: candidatoEspecifico?.status });
                                            mostrarCandidatosTime(time, botaoEncontrado, profissionalIdParaDestacar, tipoNotificacao);
                                        }, 100);
                                    } else {
                                        // Fallback: cria botão virtual
                                        const botaoVirtual = document.createElement('button');
                                        botaoVirtual.style.position = 'fixed';
                                        botaoVirtual.style.top = '50%';
                                        botaoVirtual.style.left = '50%';
                                        botaoVirtual.style.opacity = '0';
                                        botaoVirtual.style.pointerEvents = 'none';
                                        document.body.appendChild(botaoVirtual);
                                        setTimeout(() => {
                                            // Destaca o candidato se:
                                            // 1. For notificação de confirmar_perfil_time (sempre destaca)
                                            // 2. Ou se tiver candidatoId e o candidato específico estiver pendente
                                            const profissionalIdParaDestacar = (tipoNotificacao === 'confirmar_perfil_time' && candidatoEspecifico) || 
                                                (candidatoId && candidatoEspecifico && candidatoEspecifico.status === 'pendente')
                                                ? profissionalId 
                                                : null;
                                            console.log('🎯 Destacando candidato:', { profissionalIdParaDestacar, tipoNotificacao, candidatoId, status: candidatoEspecifico?.status });
                                            mostrarCandidatosTime(time, botaoVirtual, profissionalIdParaDestacar, tipoNotificacao);
                                        }, 100);
                                    }
                                }
                            }, 200);
                    }, delayMenu);
                }
                // Retorna true para indicar sucesso
                return true;
            } else {
                console.error('❌ Erro ao buscar times:', data);
                return false;
            }
        } catch (error) {
            console.error('❌ Erro ao abrir candidatos por notificação:', error);
            
            const mensagemProposta = document.getElementById('mensagem-proposta-respondida');
            const mensagemTexto = document.getElementById('mensagem-proposta-texto');
            
            // Verifica se é erro 404 (time não encontrado)
            if (error.message && (error.message.includes('404') || error.message.includes('não encontrado') || error.message.includes('not found'))) {
                // Tenta buscar o time incluindo concluídos para verificar se foi concluído
                let mensagemFinal = 'Esta equipe foi removida.';
                try {
                    const responseConcluidos = await fetch(`/api/times-projeto?status=concluido&t=${Date.now()}`, {
                        headers: { 'Authorization': `Bearer ${token}` },
                        cache: 'no-cache'
                    });
                    
                    if (responseConcluidos.ok) {
                        const dataConcluidos = await responseConcluidos.json();
                        if (dataConcluidos.success && dataConcluidos.times) {
                            const timeConcluido = dataConcluidos.times.find(t => {
                                const tId = t._id?.toString() || t._id;
                                const searchId = timeId?.toString() || timeId;
                                return tId === searchId;
                            });
                            
                            if (timeConcluido && timeConcluido.status === 'concluido') {
                                mensagemFinal = 'Esta equipe já foi concluída.';
                            }
                        }
                    }
                } catch (err) {
                    console.warn('Erro ao verificar time concluído:', err);
                }
                
                // Garante que o modal de notificações está aberto
                const modalNotificacoes = document.getElementById('modal-notificacoes');
                const mensagemProposta = document.getElementById('mensagem-proposta-respondida');
                const mensagemTexto = document.getElementById('mensagem-proposta-texto');
                
                if (modalNotificacoes && mensagemProposta && mensagemTexto) {
                    // Define o flag ANTES de qualquer coisa para evitar recarregamento
                    window.temMensagemErroNotificacao = true;
                    
                    // Abre o modal se estiver fechado
                    if (modalNotificacoes.classList.contains('hidden')) {
                        modalNotificacoes.classList.remove('hidden');
                    }
                    
                    mensagemTexto.textContent = mensagemFinal;
                    mensagemProposta.style.display = 'block';
                    
                    // Remove o flag após um tempo para permitir recarregamento futuro
                    setTimeout(() => {
                        window.temMensagemErroNotificacao = false;
                    }, 5000);
                }
            } else {
                // Garante que o modal de notificações está aberto
                const modalNotificacoes = document.getElementById('modal-notificacoes');
                const mensagemProposta = document.getElementById('mensagem-proposta-respondida');
                const mensagemTexto = document.getElementById('mensagem-proposta-texto');
                
                if (modalNotificacoes && mensagemProposta && mensagemTexto) {
                    // Define o flag ANTES de qualquer coisa para evitar recarregamento
                    window.temMensagemErroNotificacao = true;
                    
                    // Abre o modal se estiver fechado
                    if (modalNotificacoes.classList.contains('hidden')) {
                        modalNotificacoes.classList.remove('hidden');
                    }
                    
                    mensagemTexto.textContent = 'Erro ao abrir candidatos. Tente novamente.';
                    mensagemProposta.style.display = 'block';
                    
                    // Remove o flag após um tempo para permitir recarregamento futuro
                    setTimeout(() => {
                        window.temMensagemErroNotificacao = false;
                    }, 5000);
                }
            }
            return false; // Retorna false para indicar erro
        }
    };

    // Listener global para notificações (se houver sistema de notificações)
    document.addEventListener('click', async (e) => {
        const notificacaoItem = e.target.closest('[data-notificacao-tipo="candidatura_time"]');
        if (notificacaoItem) {
            const timeId = notificacaoItem.dataset.timeId || notificacaoItem.dataset.notificacaoTimeId;
            if (timeId) {
                e.preventDefault();
                await window.abrirCandidatosPorNotificacao(timeId);
            }
        }
    });

    function mostrarCandidatosTime(time, botao, profissionalIdDestacado = null, tipoNotificacao = null) {
        console.log('📦 mostrarCandidatosTime chamado, time:', time, 'profissionalIdDestacado:', profissionalIdDestacado);
        
        // Remove modal anterior se existir
        const modalAnterior = document.getElementById('modal-candidatos-time');
        if (modalAnterior) {
            modalAnterior.remove();
        }

        // Cria novo modal
        const modal = document.createElement('div');
        modal.id = 'modal-candidatos-time';
        modal.className = 'modal-overlay';
        
        // Não adiciona ao body ainda - será adicionado no posicionamento

        // Garante que os candidatos estão populados
        const candidatos = time.candidatos || [];
        console.log('👥 Total de candidatos:', candidatos.length);
        console.log('📋 Candidatos:', candidatos);
        
        const candidatosPendentes = candidatos.filter(c => {
            // Verifica se o candidato tem status pendente
            const status = c.status || 'pendente';
            return status === 'pendente';
        });
        
        console.log('⏳ Candidatos pendentes filtrados:', candidatosPendentes.length);
        
        if (candidatosPendentes.length === 0) {
            // Remove o modal se não houver candidatos
            modal.remove();
            alert('Não há candidatos pendentes no momento.');
            return;
        }

        modal.innerHTML = `
            <div class="modal-content modal-grande">
                <div class="modal-body">
                    <div class="candidatos-lista">
                        ${candidatosPendentes.map(candidato => {
                            const prof = candidato.profissionalId;
                            const fotoProf = prof?.foto || prof?.avatarUrl || 'imagens/default-user.png';
                            const nomeProf = prof?.nome || 'Profissional';
                            const atuacaoProf = prof?.atuacao || candidato.tipo || 'Profissional';
                            const profId = prof?._id || prof?.id;
                            
                            // Verifica se este candidato deve ser destacado
                            const profIdStr = profId?.toString() || prof?.toString() || '';
                            const profissionalIdDestacadoStr = profissionalIdDestacado?.toString() || '';
                            const isDestacado = profissionalIdDestacado && profIdStr === profissionalIdDestacadoStr;
                            console.log('🔍 Verificando destaque:', { profIdStr, profissionalIdDestacadoStr, isDestacado, tipoNotificacao });
                            
                            // Informações de valor e contraproposta
                            const valor = candidato.valor || time.valorBase || 0;
                            const tipoCandidatura = candidato.tipoCandidatura || 'aceite';
                            const justificativa = candidato.justificativa || '';
                            const isContraproposta = tipoCandidatura === 'contraproposta';
                            
                            return `
                                <div class="candidato-item ${isDestacado ? 'candidato-destacado' : ''}" data-candidato-id="${candidato._id}" data-time-id="${time._id}" data-profissional-id="${profId}">
                                    <div class="candidato-info">
                                        <img src="${fotoProf}" alt="${nomeProf}" class="candidato-foto" onerror="this.src='imagens/default-user.png'">
                                        <div class="candidato-detalhes">
                                            <a href="/perfil.html?id=${profId}" class="candidato-nome">${nomeProf}</a>
                                            <span class="candidato-profissao">${atuacaoProf}</span>
                                            <div class="candidato-valor">
                                                ${isContraproposta ? `
                                                    <span class="valor-contraproposta">
                                                        <i class="fas fa-comment-dollar"></i> Contraproposta: <strong>R$ ${valor.toFixed(2)}/dia</strong>
                                                    </span>
                                                    ${justificativa ? `<span class="justificativa-contraproposta">"${justificativa}"</span>` : ''}
                                                ` : `
                                                    <span class="valor-aceito">
                                                        <i class="fas fa-check-circle"></i> Aceitou: <strong>R$ ${valor.toFixed(2)}/dia</strong>
                                                    </span>
                                                `}
                                            </div>
                                        </div>
                                    </div>
                                    <div class="candidato-acoes">
                                        ${tipoNotificacao === 'confirmar_perfil_time' && candidato.tipoCandidatura === 'aceite' ? `
                                        <button class="btn-confirmar-perfil" data-candidato-id="${candidato._id}" data-time-id="${time._id}">
                                            <i class="fas fa-check-circle"></i> Confirma
                                        </button>
                                        <button class="btn-recusar-perfil" data-candidato-id="${candidato._id}" data-time-id="${time._id}">
                                            <i class="fas fa-times"></i> Recusar
                                        </button>
                                        ` : `
                                        <button class="btn-aceitar-candidato" data-candidato-id="${candidato._id}" data-time-id="${time._id}">
                                            <i class="fas fa-check"></i> Aceitar
                                        </button>
                                        <button class="btn-recusar-candidato" data-candidato-id="${candidato._id}" data-time-id="${time._id}">
                                            <i class="fas fa-times"></i> Recusar
                                        </button>
                                        `}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;

        // Posiciona o modal ao lado do botão em telas maiores
        const botaoRect = botao ? botao.getBoundingClientRect() : { bottom: window.innerHeight / 2, left: window.innerWidth / 2 };
        const isMobile = window.innerWidth <= 767;
        const isMedia = window.innerWidth >= 768 && window.innerWidth <= 992;
        
        if (!isMobile && !isMedia) {
            // Em telas maiores, posiciona o modal FORA do container, ao lado (lateral)
            // Fecha sidebar em telas médias quando abre o modal
            if (typeof window.fecharSidebarSeMedia === 'function') {
                window.fecharSidebarSeMedia();
            }
            
            document.body.appendChild(modal);
            const modalContent = modal.querySelector('.modal-content');
            const filtroTimesLocais = document.querySelector('.filtro-times-locais');
            
            if (filtroTimesLocais) {
                const containerRect = filtroTimesLocais.getBoundingClientRect();
                
                // Posiciona o modal fixo na tela, ao lado do container de times locais
                // Mas apenas na área do sidebar, não sobrepondo o feed
                modal.style.position = 'fixed';
                modal.style.top = `${containerRect.top}px`;
                modal.style.left = `${containerRect.left}px`;
                modal.style.width = `${containerRect.width}px`;
                modal.style.height = `${containerRect.height}px`;
                modal.style.display = 'flex';
                modal.style.alignItems = 'flex-start';
                modal.style.justifyContent = 'flex-start';
                modal.style.padding = '0';
                modal.style.background = 'transparent';
                modal.style.zIndex = '10000';
                modal.style.pointerEvents = 'none';
                modal.style.overflow = 'visible';
                
                // Posiciona o conteúdo do modal ao lado direito do container de times locais
                // Mas verifica se não vai ultrapassar a largura da tela
                const larguraDisponivel = window.innerWidth - containerRect.right - 32; // 16px de cada lado
                const larguraModal = Math.min(380, larguraDisponivel);
                
                // Obtém a posição do cabeçalho
                const header = document.querySelector('header');
                const headerRect = header ? header.getBoundingClientRect() : { bottom: 0 };
                const headerBottom = headerRect.bottom || 0;
                
                // Calcula a posição do modal (desceu pela metade - estava em 10px, agora 35px)
                let modalTop = containerRect.top + 35;
                
                // O modal sempre fica abaixo do cabeçalho (z-index menor que 1000)
                // Se o modal estiver acima do cabeçalho visualmente, ajusta a posição
                if (modalTop < headerBottom) {
                    // Se o modal estiver atrás do cabeçalho, ajusta para ficar abaixo
                    modalTop = headerBottom + 10;
                }
                
                modalContent.style.position = 'fixed';
                modalContent.style.top = `${modalTop}px`;
                modalContent.style.left = `${containerRect.right + 16}px`; // Ao lado direito do container
                modalContent.style.right = 'auto';
                modalContent.style.maxWidth = `${larguraModal}px`;
                modalContent.style.width = `${larguraModal}px`;
                modalContent.style.margin = '0';
                modalContent.style.pointerEvents = 'auto';
                modalContent.style.zIndex = '999'; // Sempre abaixo do cabeçalho (z-index 1000)
                
                // Se não houver espaço suficiente à direita, posiciona à esquerda do container
                if (larguraDisponivel < 200) {
                    modalContent.style.left = 'auto';
                    modalContent.style.right = `${window.innerWidth - containerRect.left + 16}px`;
                }
                
                // Atualiza a posição quando a janela redimensiona ou quando o container rola
                const atualizarPosicaoModal = () => {
                    if (!document.body.contains(modal)) return;
                    
                    const novoContainerRect = filtroTimesLocais.getBoundingClientRect();
                    const novoBotaoRect = botao ? botao.getBoundingClientRect() : botaoRect;
                    
                    // Obtém a posição do cabeçalho
                    const header = document.querySelector('header');
                    const headerRect = header ? header.getBoundingClientRect() : { bottom: 0 };
                    const headerBottom = headerRect.bottom || 0;
                    
                    // Atualiza a área do modal
                    modal.style.top = `${novoContainerRect.top}px`;
                    modal.style.left = `${novoContainerRect.left}px`;
                    modal.style.width = `${novoContainerRect.width}px`;
                    modal.style.height = `${novoContainerRect.height}px`;
                    
                    // Calcula a posição do modal (desceu pela metade - estava em 10px, agora 35px)
                    let modalTop = novoContainerRect.top + 35;
                    
                    // O modal sempre fica abaixo do cabeçalho (z-index menor que 1000)
                    // Se o modal estiver acima do cabeçalho visualmente, ajusta a posição
                    if (modalTop < headerBottom) {
                        // Se o modal estiver atrás do cabeçalho, ajusta para ficar abaixo
                        modalTop = headerBottom + 10;
                    }
                    
                    // Atualiza a posição do conteúdo
                    modalContent.style.top = `${modalTop}px`;
                    modalContent.style.zIndex = '999'; // Sempre abaixo do cabeçalho (z-index 1000)
                    
                    // Verifica se há espaço à direita
                    const larguraDisponivel = window.innerWidth - novoContainerRect.right - 32;
                    const larguraModal = Math.min(380, larguraDisponivel);
                    
                    if (larguraDisponivel >= 200) {
                        modalContent.style.left = `${novoContainerRect.right + 16}px`;
                        modalContent.style.right = 'auto';
                    } else {
                        modalContent.style.left = 'auto';
                        modalContent.style.right = `${window.innerWidth - novoContainerRect.left + 16}px`;
                    }
                    
                    modalContent.style.maxWidth = `${larguraModal}px`;
                    modalContent.style.width = `${larguraModal}px`;
                };
                
                // Adiciona listeners para atualizar posição
                const timesContainer = document.querySelector('.times-container-lateral');
                if (timesContainer) {
                    timesContainer.addEventListener('scroll', atualizarPosicaoModal);
                }
                window.addEventListener('resize', atualizarPosicaoModal);
                window.addEventListener('scroll', atualizarPosicaoModal);
                
                // Remove os listeners quando o modal for fechado
                const removerListeners = () => {
                    if (timesContainer) {
                        timesContainer.removeEventListener('scroll', atualizarPosicaoModal);
                    }
                    window.removeEventListener('resize', atualizarPosicaoModal);
                    window.removeEventListener('scroll', atualizarPosicaoModal);
                };
                
                // Observa quando o modal é removido
                const observer = new MutationObserver(() => {
                    if (!document.body.contains(modal)) {
                        removerListeners();
                        observer.disconnect();
                    }
                });
                observer.observe(document.body, { childList: true, subtree: true });
                
                // Armazena a função de remoção no modal para usar no fecharModal
                modal._removerListeners = removerListeners;
            } else {
                // Fallback: posiciona como antes se não encontrar o container
                // Fecha sidebar em telas médias quando abre o modal
                if (typeof window.fecharSidebarSeMedia === 'function') {
                    window.fecharSidebarSeMedia();
                }
                
                document.body.appendChild(modal);
                const modalContent = modal.querySelector('.modal-content');
                modal.style.position = 'fixed';
                modal.style.top = '0';
                modal.style.left = '0';
                modal.style.right = '0';
                modal.style.bottom = '0';
                modal.style.display = 'flex';
                modal.style.alignItems = 'flex-start';
                modal.style.justifyContent = 'flex-start';
                modal.style.padding = '0';
                modal.style.background = 'transparent';
                modal.style.zIndex = '10000';
                
                modalContent.style.position = 'absolute';
                modalContent.style.top = `${botaoRect.bottom + 8}px`;
                modalContent.style.left = `${botaoRect.left}px`;
                modalContent.style.right = 'auto';
                modalContent.style.maxWidth = '380px';
                modalContent.style.margin = '0';
            }
        } else {
            // Em telas menores, centraliza o modal
            // Fecha sidebar em telas médias quando abre o modal
            if (typeof window.fecharSidebarSeMedia === 'function') {
                window.fecharSidebarSeMedia();
            }
            
            document.body.appendChild(modal);
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.right = '0';
            modal.style.bottom = '0';
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.style.background = 'rgba(0, 0, 0, 0.5)';
            modal.style.zIndex = '10000';
        }

        // Fecha sidebar em telas médias quando abre o modal
        if (typeof window.fecharSidebarSeMedia === 'function') {
            window.fecharSidebarSeMedia();
        }
        
        modal.classList.remove('hidden');
        console.log('✅ Modal criado e exibido');

        // Destaca o candidato específico se foi passado profissionalIdDestacado
        if (profissionalIdDestacado) {
            setTimeout(() => {
                const candidatoItem = modal.querySelector(`[data-profissional-id="${profissionalIdDestacado}"]`);
                if (candidatoItem) {
                    console.log('✨ Destacando candidato:', profissionalIdDestacado);
                    candidatoItem.classList.add('candidato-destacado');
                    
                    // Efeito de piscar 2 vezes
                    let piscadas = 0;
                    const piscar = () => {
                        candidatoItem.style.opacity = '0.3';
                        setTimeout(() => {
                            candidatoItem.style.opacity = '1';
                            piscadas++;
                            if (piscadas < 2) {
                                setTimeout(piscar, 300);
                            } else {
                                // Remove a classe após o efeito
                                setTimeout(() => {
                                    candidatoItem.classList.remove('candidato-destacado');
                                }, 500);
                            }
                        }, 300);
                    };
                    piscar();
                    
                    // Scroll para o candidato destacado
                    candidatoItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    console.warn('⚠️ Candidato não encontrado para destacar:', profissionalIdDestacado);
                }
            }, 100);
        }

        // Listeners para aceitar/recusar
        modal.querySelectorAll('.btn-aceitar-candidato').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const candidatoId = e.currentTarget.dataset.candidatoId;
                const timeId = e.currentTarget.dataset.timeId;
                await processarCandidato(timeId, candidatoId, 'aceitar', false);
            });
        });

        modal.querySelectorAll('.btn-recusar-candidato').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const candidatoId = e.currentTarget.dataset.candidatoId;
                const timeId = e.currentTarget.dataset.timeId;
                await processarCandidato(timeId, candidatoId, 'recusar', false);
            });
        });
        
        // Listeners para confirmar/recusar perfil
        modal.querySelectorAll('.btn-confirmar-perfil').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const candidatoId = e.currentTarget.dataset.candidatoId;
                const timeId = e.currentTarget.dataset.timeId;
                await processarCandidato(timeId, candidatoId, 'aceitar', true);
            });
        });

        modal.querySelectorAll('.btn-recusar-perfil').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const candidatoId = e.currentTarget.dataset.candidatoId;
                const timeId = e.currentTarget.dataset.timeId;
                await processarCandidato(timeId, candidatoId, 'recusar', true);
            });
        });

        // Fechar ao clicar fora
        const fecharModal = (e) => {
            if (!modal.contains(e.target) && e.target !== botao) {
                // Remove listeners se existirem
                if (modal._removerListeners) {
                    modal._removerListeners();
                }
                modal.remove();
                document.removeEventListener('click', fecharModal);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', fecharModal);
        }, 100);
    }

    async function processarCandidato(timeId, candidatoId, acao, isConfirmarPerfil = false) {
        try {
            // Usa rota diferente se for confirmação de perfil
            const endpoint = isConfirmarPerfil 
                ? `/api/times-projeto/${timeId}/candidatos/${candidatoId}/confirmar-perfil`
                : `/api/times-projeto/${timeId}/candidatos/${candidatoId}`;
            
            const response = await fetch(endpoint, {
                method: isConfirmarPerfil ? 'POST' : 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ acao })
            });

            const data = await response.json();

            if (data.success) {
                // Remove o candidato da lista visualmente
                const candidatoItem = document.querySelector(`.candidato-item[data-candidato-id="${candidatoId}"]`);
                if (candidatoItem) {
                    candidatoItem.remove();
                }
                
                // Se não houver mais candidatos pendentes, fecha o modal
                const modal = document.getElementById('modal-candidatos-time');
                if (modal) {
                    const candidatosRestantes = modal.querySelectorAll('.candidato-item');
                    if (candidatosRestantes.length === 0) {
                        modal.remove();
                    }
                }
                
                // Recarrega os times para atualizar contador
                setTimeout(() => {
                    carregarTimesLocais();
                }, 300);
            } else {
                alert(data.message || 'Erro ao processar candidato.');
            }
        } catch (error) {
            console.error('Erro ao processar candidato:', error);
            alert('Erro ao processar candidato. Tente novamente.');
        }
    }

    if (btnCriarTime) {
        btnCriarTime.addEventListener('click', () => {
            // 🆕 ATUALIZADO: Permite profissionais também criarem times
            // Fecha sidebar em telas médias quando abre o modal
            if (typeof window.fecharSidebarSeMedia === 'function') {
                window.fecharSidebarSeMedia();
            }
            modalCriarTime?.classList.remove('hidden');
        });
    }

    // Adicionar/remover profissionais no formulário
    if (profissionaisLista) {
        // Adiciona listeners para checkboxes "A Combinar" existentes no carregamento
        profissionaisLista.querySelectorAll('.a-combinar-checkbox').forEach(checkbox => {
            const profissionalItem = checkbox.closest('.profissional-item');
            const valorInput = profissionalItem.querySelector('.valor-profissional');
            const label = checkbox.closest('.checkbox-a-combinar');
            
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    valorInput.disabled = true;
                    valorInput.value = '';
                    valorInput.removeAttribute('required');
                    label.classList.add('checked');
                } else {
                    valorInput.disabled = false;
                    valorInput.setAttribute('required', 'required');
                    label.classList.remove('checked');
                }
            });
            
            // Verifica estado inicial
            if (checkbox.checked) {
                label.classList.add('checked');
            }
        });
        
        document.addEventListener('click', (e) => {
            if (e.target.id === 'btn-adicionar-profissional') {
                const novoItem = document.createElement('div');
                novoItem.className = 'profissional-item';
                novoItem.innerHTML = `
                    <input type="text" placeholder="Tipo (ex: pedreiro)" class="tipo-profissional" required>
                    <input type="number" placeholder="Qtd" class="qtd-profissional" min="1" value="1" required>
                    <input type="number" placeholder="Valor/dia (R$)" class="valor-profissional" min="0" step="0.01">
                    <label class="checkbox-a-combinar">
                        <span>A Combinar</span>
                        <input type="checkbox" class="a-combinar-checkbox">
                    </label>
                    <button type="button" class="btn-remover-profissional"><i class="fas fa-trash"></i></button>
                `;
                profissionaisLista.appendChild(novoItem);
                
                // Adiciona listener para o checkbox "A Combinar"
                const checkbox = novoItem.querySelector('.a-combinar-checkbox');
                const valorInput = novoItem.querySelector('.valor-profissional');
                const label = novoItem.querySelector('.checkbox-a-combinar');
                
                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        valorInput.disabled = true;
                        valorInput.value = '';
                        valorInput.removeAttribute('required');
                        label.classList.add('checked');
                    } else {
                        valorInput.disabled = false;
                        valorInput.setAttribute('required', 'required');
                        label.classList.remove('checked');
                    }
                });
            }
            
            // Listener para checkboxes "A Combinar" existentes
            if (e.target.classList.contains('a-combinar-checkbox')) {
                const profissionalItem = e.target.closest('.profissional-item');
                const valorInput = profissionalItem.querySelector('.valor-profissional');
                const label = e.target.closest('.checkbox-a-combinar');
                
                if (e.target.checked) {
                    valorInput.disabled = true;
                    valorInput.value = '';
                    valorInput.removeAttribute('required');
                    label.classList.add('checked');
                } else {
                    valorInput.disabled = false;
                    valorInput.setAttribute('required', 'required');
                    label.classList.remove('checked');
                }
            }
            
            if (e.target.classList.contains('btn-remover-profissional') || e.target.closest('.btn-remover-profissional')) {
                const botao = e.target.classList.contains('btn-remover-profissional') ? e.target : e.target.closest('.btn-remover-profissional');
                if (profissionaisLista.children.length > 1) {
                    botao.closest('.profissional-item').remove();
                } else {
                    alert('Você precisa de pelo menos um profissional.');
                }
            }
        });
    }

    if (formCriarTime) {
        formCriarTime.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Remove mensagem de erro anterior
            const mensagemErro = document.getElementById('mensagem-erro-criar-time');
            if (mensagemErro) {
                mensagemErro.style.display = 'none';
                mensagemErro.textContent = '';
            }
            
            // Remove classes de erro anteriores
            document.querySelectorAll('.campo-erro').forEach(el => {
                el.classList.remove('campo-erro');
                el.style.borderColor = '';
            });
            
            // Validação dos campos obrigatórios
            const titulo = document.getElementById('time-titulo');
            const descricao = document.getElementById('time-descricao');
            const rua = document.getElementById('time-rua');
            const bairro = document.getElementById('time-bairro');
            const numero = document.getElementById('time-numero');
            const cidade = document.getElementById('time-cidade');
            const estado = document.getElementById('time-estado');
            
            const erros = [];
            let primeiroCampoErro = null;
            
            // Valida título
            if (!titulo || !titulo.value.trim()) {
                erros.push('Título do Projeto');
                if (!primeiroCampoErro) primeiroCampoErro = titulo;
                titulo.classList.add('campo-erro');
                titulo.style.borderColor = '#dc3545';
            }
            
            // Valida descrição
            if (!descricao || !descricao.value.trim()) {
                erros.push('Descrição');
                if (!primeiroCampoErro) primeiroCampoErro = descricao;
                descricao.classList.add('campo-erro');
                descricao.style.borderColor = '#dc3545';
            }
            
            // Valida rua
            if (!rua || !rua.value.trim()) {
                erros.push('Endereço (Rua)');
                if (!primeiroCampoErro) primeiroCampoErro = rua;
                rua.classList.add('campo-erro');
                rua.style.borderColor = '#dc3545';
            }
            
            // Valida bairro
            if (!bairro || !bairro.value.trim()) {
                erros.push('Bairro');
                if (!primeiroCampoErro) primeiroCampoErro = bairro;
                bairro.classList.add('campo-erro');
                bairro.style.borderColor = '#dc3545';
            }
            
            // Valida número
            if (!numero || !numero.value.trim()) {
                erros.push('Número');
                if (!primeiroCampoErro) primeiroCampoErro = numero;
                numero.classList.add('campo-erro');
                numero.style.borderColor = '#dc3545';
            }
            
            // Valida cidade
            if (!cidade || !cidade.value.trim()) {
                erros.push('Cidade');
                if (!primeiroCampoErro) primeiroCampoErro = cidade;
                cidade.classList.add('campo-erro');
                cidade.style.borderColor = '#dc3545';
            }
            
            // Valida estado
            if (!estado || !estado.value.trim()) {
                erros.push('Estado');
                if (!primeiroCampoErro) primeiroCampoErro = estado;
                estado.classList.add('campo-erro');
                estado.style.borderColor = '#dc3545';
            }
            
            // Valida profissionais
            const profissionaisItems = Array.from(profissionaisLista.children);
            if (profissionaisItems.length === 0) {
                erros.push('Adicione pelo menos um profissional');
            } else {
                profissionaisItems.forEach((item, index) => {
                    const tipoInput = item.querySelector('.tipo-profissional');
                    const quantidadeInput = item.querySelector('.qtd-profissional');
                    const valorInput = item.querySelector('.valor-profissional');
                    const aCombinarCheckbox = item.querySelector('.a-combinar-checkbox');
                    
                    // Valida tipo
                    if (!tipoInput || !tipoInput.value.trim()) {
                        erros.push(`Tipo do profissional ${index + 1}`);
                        if (!primeiroCampoErro) primeiroCampoErro = tipoInput;
                        tipoInput.classList.add('campo-erro');
                        tipoInput.style.borderColor = '#dc3545';
                    }
                    
                    // Valida quantidade
                    const quantidade = parseInt(quantidadeInput?.value || 0);
                    if (!quantidadeInput || !quantidade || quantidade <= 0) {
                        erros.push(`Quantidade do profissional ${index + 1}`);
                        if (!primeiroCampoErro) primeiroCampoErro = quantidadeInput;
                        quantidadeInput.classList.add('campo-erro');
                        quantidadeInput.style.borderColor = '#dc3545';
                    }
                    
                    // Valida valor OU "A Combinar"
                    const aCombinar = aCombinarCheckbox?.checked || false;
                    const valor = valorInput ? parseFloat(valorInput.value) : 0;
                    
                    if (!aCombinar && (!valor || valor <= 0)) {
                        erros.push(`Valor ou "A Combinar" para o profissional ${index + 1} (${tipoInput?.value || 'sem tipo'})`);
                        if (!primeiroCampoErro) primeiroCampoErro = valorInput || aCombinarCheckbox;
                        if (valorInput) {
                            valorInput.classList.add('campo-erro');
                            valorInput.style.borderColor = '#dc3545';
                        }
                    }
                });
            }
            
            // Se houver erros, mostra mensagem e rola até o primeiro campo
            if (erros.length > 0) {
                if (mensagemErro) {
                    mensagemErro.textContent = `Por favor, preencha os seguintes campos: ${erros.join(', ')}.`;
                    mensagemErro.style.display = 'block';
                }
                
                // Rola até o primeiro campo com erro em telas menores
                if (primeiroCampoErro && window.innerWidth <= 767) {
                    setTimeout(() => {
                        primeiroCampoErro.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 100);
                }
                
                return; // Para a execução
            }
            
            // Se chegou aqui, todos os campos estão válidos
            const profissionais = profissionaisItems.map(item => {
                const tipo = item.querySelector('.tipo-profissional').value;
                const quantidade = parseInt(item.querySelector('.qtd-profissional').value);
                const aCombinar = item.querySelector('.a-combinar-checkbox').checked;
                const valorInput = item.querySelector('.valor-profissional');
                const valorBase = aCombinar ? null : parseFloat(valorInput.value);
                
                return {
                    tipo: tipo,
                    quantidade: quantidade,
                    valorBase: valorBase,
                    aCombinar: aCombinar
                };
            });
            
            const timeData = {
                titulo: titulo.value.trim(),
                descricao: descricao.value.trim(),
                localizacao: {
                    rua: rua.value.trim(),
                    numero: numero.value.trim(),
                    bairro: bairro.value.trim(),
                    cidade: cidade.value.trim(),
                    estado: estado.value.toUpperCase().trim()
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
                    // Limpa o formulário
                    formCriarTime.reset();
                    
                    // Esconde o formulário e mostra mensagem de sucesso dentro do modal
                    const modalBody = modalCriarTime?.querySelector('.modal-body');
                    const formElement = formCriarTime;
                    
                    if (modalBody && formElement) {
                        // Esconde o formulário
                        formElement.style.display = 'none';
                        
                        // Remove mensagem anterior se existir
                        const mensagemAnterior = modalBody.querySelector('.mensagem-sucesso-time');
                        if (mensagemAnterior) {
                            mensagemAnterior.remove();
                        }
                        
                        // Cria nova mensagem de sucesso
                        const mensagemSucesso = document.createElement('div');
                        mensagemSucesso.className = 'mensagem-sucesso-time';
                        mensagemSucesso.innerHTML = `
                            <div style="text-align: center; padding: 40px 20px;">
                                <div style="font-size: 48px; margin-bottom: 20px;">✅</div>
                                <div style="color: #28a745; font-size: 20px; font-weight: 600; margin-bottom: 10px;">
                                    Equipe criada com sucesso!
                                </div>
                            </div>
                        `;
                        mensagemSucesso.style.cssText = `
                            color: #28a745;
                            animation: fadeIn 0.3s ease-in;
                        `;
                        
                        // Adiciona animação fadeIn se não existir
                        if (!document.querySelector('#animacao-fadein')) {
                            const style = document.createElement('style');
                            style.id = 'animacao-fadein';
                            style.textContent = `
                                @keyframes fadeIn {
                                    from { opacity: 0; transform: translateY(-10px); }
                                    to { opacity: 1; transform: translateY(0); }
                                }
                            `;
                            document.head.appendChild(style);
                        }
                        
                        // Insere a mensagem no modal-body
                        modalBody.appendChild(mensagemSucesso);
                        
                        // Fecha o modal após 2 segundos
                        setTimeout(() => {
                            // Remove estilos inline do modal para garantir que possa ser reaberto
                            if (modalCriarTime) {
                                modalCriarTime.classList.add('hidden');
                                modalCriarTime.style.cssText = '';
                            }
                            
                            // Restaura o formulário para a próxima vez
                            if (formElement) {
                                formElement.style.display = '';
                            }
                            
                            // Remove a mensagem
                            if (mensagemSucesso.parentElement) {
                                mensagemSucesso.remove();
                            }
                        }, 2000);
                    }
                    
                    // Recarrega os times após um pequeno delay para garantir que o time foi salvo no banco
                    setTimeout(() => {
                        carregarTimesLocais();
                    }, 500);
                } else {
                    // Mostra erro na mensagem de erro
                    if (mensagemErro) {
                        mensagemErro.textContent = data.message || 'Erro ao criar time.';
                        mensagemErro.style.display = 'block';
                    } else {
                        alert(data.message || 'Erro ao criar time.');
                    }
                }
            } catch (error) {
                console.error('Erro ao criar time:', error);
                // Mostra erro na mensagem de erro
                if (mensagemErro) {
                    mensagemErro.textContent = error.message || 'Erro ao criar time de projeto.';
                    mensagemErro.style.display = 'block';
                } else {
                    alert(error.message || 'Erro ao criar time de projeto.');
                }
            }
        });
        
        // Remove erro quando o usuário começa a digitar
        const camposValidacao = [
            'time-titulo',
            'time-descricao',
            'time-rua',
            'time-bairro',
            'time-numero',
            'time-cidade',
            'time-estado'
        ];
        
        camposValidacao.forEach(id => {
            const campo = document.getElementById(id);
            if (campo) {
                campo.addEventListener('input', function() {
                    this.classList.remove('campo-erro');
                    this.style.borderColor = '';
                });
            }
        });
        
        // Remove erro dos campos de profissionais quando começam a digitar
        if (profissionaisLista) {
            profissionaisLista.addEventListener('input', function(e) {
                const campo = e.target;
                if (campo.classList.contains('tipo-profissional') || 
                    campo.classList.contains('qtd-profissional') || 
                    campo.classList.contains('valor-profissional')) {
                    campo.classList.remove('campo-erro');
                    campo.style.borderColor = '';
                }
            });
            
            // Remove erro quando marca "A Combinar"
            profissionaisLista.addEventListener('change', function(e) {
                if (e.target.classList.contains('a-combinar-checkbox')) {
                    const item = e.target.closest('.profissional-item');
                    const valorInput = item?.querySelector('.valor-profissional');
                    if (valorInput) {
                        valorInput.classList.remove('campo-erro');
                        valorInput.style.borderColor = '';
                    }
                }
            });
        }
    }

    // Fechar modais
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-close-modal')) {
            const modalId = e.target.dataset.modal;
            if (modalId) {
                document.getElementById(modalId)?.classList.add('hidden');
            }
            return;
        }
        
        // Fechar ao clicar fora do modal (no overlay/backdrop)
        // Verifica se o clique foi no overlay, não no conteúdo do modal
        const modalOverlay = e.target.closest('.modal-overlay');
        if (modalOverlay) {
            const modalContent = modalOverlay.querySelector('.modal-content');
            
            // Se clicou diretamente no overlay (não no conteúdo)
            if (e.target === modalOverlay || (modalContent && !modalContent.contains(e.target))) {
                // Não fecha se clicou em um botão dentro do modal
                if (!e.target.closest('button') || e.target.classList.contains('btn-close-modal')) {
                    modalOverlay.classList.add('hidden');
                    
                    // Se o modal foi criado dinamicamente, remove do DOM após animação
                    // IMPORTANTE: NÃO remove modais permanentes que estão definidos no HTML
                    // Lista completa de todos os modais permanentes que não devem ser removidos
                    const modaisPermanentes = [
                        // Modais de notificações
                        'modal-notificacoes',
                        'modal-aviso-notificacoes',
                        // Modais de pedidos e serviços
                        'modal-propostas',
                        'modal-servicos-ativos',
                        'modal-pedido-urgente',
                        'modal-pedidos-urgentes-profissional',
                        'modal-meus-pedidos-urgentes',
                        'modal-pedidos-concluidos',
                        'modal-enviar-proposta',
                        // Modais de times e projetos
                        'modal-criar-time',
                        'modal-criar-time-local',
                        'modal-candidatos-vaga',
                        'modal-projeto-time',
                        // Modais de pagamento
                        'modal-pagamento-seguro',
                        'modal-liberar-pagamento',
                        'modal-meus-pagamentos',
                        'modal-pagamentos-garantidos',
                        // Modais de vagas
                        'modal-vaga-relampago',
                        'modal-vagas-relampago-profissional',
                        // Modais de disputas
                        'modal-criar-disputa',
                        'modal-minhas-disputas',
                        // Modais de destaque
                        'modal-destaque-servico',
                        // Modais de precisar agora
                        'modal-preciso-agora',
                        // Modais de confirmação
                        'modal-confirmacao-acao',
                        // Modais de admin
                        'modal-dashboard-admin',
                        // Modais de proposta aceita
                        'modal-proposta-aceita',
                        // Modais de perfil
                        'modal-preview-avatar',
                        'modal-validar-projeto',
                        'modal-adicionar-projeto',
                        'modal-lembrete-avaliacao',
                        'modal-postagem-completa',
                        // Modais de imagem
                        'modal-image-pedido',
                        'modal-image'
                    ];
                    const isModalPermanente = modalOverlay.id && modaisPermanentes.includes(modalOverlay.id);
                    
                    // Apenas remove modais que foram criados dinamicamente (não estão na lista de permanentes)
                    if (modalOverlay.id && (modalOverlay.id.includes('modal-') || modalOverlay.id.includes('popup-')) && !isModalPermanente) {
                        setTimeout(() => {
                            if (modalOverlay.parentNode && modalOverlay.classList.contains('hidden')) {
                                modalOverlay.remove();
                            }
                        }, 300);
                    }
                }
            }
        }
    });

    function atualizarBotoesDestaques() {
        if (!destaquesScroll || !btnDestaquesVoltar || !btnDestaquesAvancar) return;
        const maxScrollLeft = Math.max(0, destaquesScroll.scrollWidth - destaquesScroll.clientWidth);
        const atStart = destaquesScroll.scrollLeft <= 4;
        const atEnd = destaquesScroll.scrollLeft >= maxScrollLeft - 4;
        const hasOverflow = (destaquesScroll.scrollWidth - destaquesScroll.clientWidth) > 12;

        if (hasOverflow && !atStart) {
            btnDestaquesVoltar.classList.add('show');
        } else {
            btnDestaquesVoltar.classList.remove('show');
        }

        if (hasOverflow && !atEnd) {
            btnDestaquesAvancar.classList.add('show');
        } else {
            btnDestaquesAvancar.classList.remove('show');
        }
    }

    // Botões de rolagem lateral dos destaques
    if (btnDestaquesAvancar && destaquesScroll) {
        btnDestaquesAvancar.addEventListener('click', () => {
            const delta = destaquesScroll.clientWidth * 0.8;
            destaquesScroll.scrollBy({ left: delta, behavior: 'smooth' });
            setTimeout(atualizarBotoesDestaques, 220);
        });
    }
    if (btnDestaquesVoltar && destaquesScroll) {
        btnDestaquesVoltar.addEventListener('click', () => {
            const delta = destaquesScroll.clientWidth * 0.8;
            destaquesScroll.scrollBy({ left: -delta, behavior: 'smooth' });
            setTimeout(atualizarBotoesDestaques, 220);
        });
    }
    if (destaquesScroll) {
        destaquesScroll.addEventListener('scroll', atualizarBotoesDestaques);
        window.addEventListener('resize', () => setTimeout(atualizarBotoesDestaques, 80));
        setTimeout(atualizarBotoesDestaques, 80);
    }

    // Drag-to-scroll na faixa de destaques
    if (destaquesScroll) {
        let isDragging = false;
        let startX = 0;
        let scrollStart = 0;

        const startDrag = (x) => {
            isDragging = true;
            startX = x;
            scrollStart = destaquesScroll.scrollLeft;
        };
        const moveDrag = (x) => {
            if (!isDragging) return;
            const dx = x - startX;
            destaquesScroll.scrollLeft = scrollStart - dx;
        };
        const endDrag = () => {
            if (!isDragging) return;
            isDragging = false;
            atualizarBotoesDestaques();
        };

        destaquesScroll.addEventListener('mousedown', (e) => startDrag(e.pageX));
        window.addEventListener('mousemove', (e) => moveDrag(e.pageX));
        window.addEventListener('mouseup', endDrag);
        destaquesScroll.addEventListener('mouseleave', endDrag);

        destaquesScroll.addEventListener('touchstart', (e) => {
            const x = e.touches[0]?.pageX || 0;
            startDrag(x);
        }, { passive: true });
        destaquesScroll.addEventListener('touchmove', (e) => {
            const x = e.touches[0]?.pageX || 0;
            moveDrag(x);
        }, { passive: true });
        destaquesScroll.addEventListener('touchend', endDrag);
        destaquesScroll.addEventListener('touchcancel', endDrag);
    }

    // ----------------------------------------------------------------------
    // VALIDAÇÃO DA SESSÃO (TRATAR TOKEN INVÁLIDO / EXPIRADO)
    // ----------------------------------------------------------------------
    async function validarSessaoAtiva() {
        // Se não houver token ou userId, já consideramos sessão inválida aqui
        if (!token || !userId) {
            return false;
        }

        try {
            const resp = await fetch('/api/usuario/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (resp.status === 401) {
                console.warn('Sessão inválida ou expirada. Limpando dados locais e redirecionando para login.');
                const jaLogou = localStorage.getItem('helpy-ja-logou');
                localStorage.clear();
                if (jaLogou) {
                    localStorage.setItem('helpy-ja-logou', jaLogou);
                }
                window.location.replace('/login');
                return false;
            }

            // Se der outro erro (500, etc.), não vamos derrubar o usuário à força
            return true;
        } catch (e) {
            console.error('Erro ao validar sessão:', e);
            // Em caso de erro de rede, mantemos o usuário e deixamos as rotas lidarem com isso
            return true;
        }
    }

    // --- INICIALIZAÇÃO ---
    (async () => {
    if (!token || !userId) {
            const isLoginPath = path.endsWith('/login') || path.endsWith('/login.html');
            const isCadastroPath = path.endsWith('/cadastro') || path.endsWith('/cadastro.html');
            // Se está no feed (ou outra página protegida) sem login → manda para /login
            if (!isLoginPath && !isCadastroPath) {
                window.location.href = '/login';
            } else {
                // Se está na página de login/cadastro, garante header limpo
                if (userNameHeader) userNameHeader.textContent = '';
                if (userAvatarHeader) userAvatarHeader.src = '/imagens/default-user.png';
        }
    } else {
            // Antes de carregar o feed e outras informações, valida se o token ainda é aceito pelo backend
            const sessaoValida = await validarSessaoAtiva();
            if (!sessaoValida) {
                // validarSessaoAtiva já faz o redirect se for inválido
                return;
            }

        if (postsContainer) {
            loadHeaderInfo();
            fetchPosts(); 
        }
            if (destaquesScroll) {
                fetchDestaques();
        }
        if (timesContainer) {
            carregarTimesLocais();
            
            // Verifica se há parâmetro para abrir candidatos (vindo de notificação)
            const urlParams = new URLSearchParams(window.location.search);
            const abrirCandidatos = urlParams.get('abrirCandidatos');
            const profissionalId = urlParams.get('profissionalId');
            const candidatoId = urlParams.get('candidatoId');
            const tipoNotificacao = urlParams.get('tipoNotificacao');
            if (abrirCandidatos && window.abrirCandidatosPorNotificacao) {
                setTimeout(() => {
                    window.abrirCandidatosPorNotificacao(abrirCandidatos, profissionalId, tipoNotificacao, candidatoId);
                    // Remove o parâmetro da URL
                    window.history.replaceState({}, document.title, window.location.pathname);
                }, 1000); // Aguarda carregar os times primeiro
            }
            
            // Recarrega times quando a página volta ao foco (caso tenha mudado a cidade em outra aba)
            window.addEventListener('focus', () => {
                carregarTimesLocais();
            });
            
            // Recarrega times quando a cidade é atualizada (evento customizado)
            window.addEventListener('cidadeAtualizada', () => {
                carregarTimesLocais();
            });
            
            // Recarrega times quando a página de configurações é fechada (se foi aberta na mesma aba)
            window.addEventListener('storage', (e) => {
                if (e.key === 'cidadeAtualizada' || e.key === 'perfilAtualizado') {
                    carregarTimesLocais();
                }
            });
        }
        
        // Abrir modal de propostas se houver pedidoId na URL
        const urlParamsCheck = new URLSearchParams(window.location.search);
        const pedidoIdFromUrl = urlParamsCheck.get('pedidoId');
        const hashFromUrl = window.location.hash;
        
        if (pedidoIdFromUrl && hashFromUrl === '#propostas') {
            // Aguarda o carregamento completo da página e scripts
            setTimeout(async () => {
                if (typeof window.carregarPropostas === 'function') {
                    await window.carregarPropostas(pedidoIdFromUrl);
                }
            }, 1000);
        } else if (pedidoIdFromUrl && hashFromUrl === '#meus-pedidos-urgentes') {
            setTimeout(async () => {
                const modalMeusPedidos = document.getElementById('modal-meus-pedidos-urgentes');
                const btnMeusPedidos = document.getElementById('btn-meus-pedidos-urgentes');
                if (modalMeusPedidos && typeof window.carregarMeusPedidosUrgentes === 'function') {
                    await window.carregarMeusPedidosUrgentes();
                    // Fecha sidebar em telas médias quando abre o modal
                    if (typeof window.fecharSidebarSeMedia === 'function') {
                        window.fecharSidebarSeMedia();
                    }
                    modalMeusPedidos.classList.remove('hidden');
                } else if (btnMeusPedidos) {
                    btnMeusPedidos.click();
                }
            }, 1000);
        }
    }
    })();
});

