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
    const filterTodosBtn = document.getElementById('filter-todos');
    const filterTrabalhadoresBtn = document.getElementById('filter-trabalhadores');
    const filterClientesBtn = document.getElementById('filter-clientes');
    const filtroCidadeInput = document.getElementById('filtro-cidade');
    const filtroCidadeBtn = document.getElementById('filtro-cidade-btn');
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
            if (!storedPhotoUrl || storedPhotoUrl === 'undefined') {
                userAvatarHeader.src = 'imagens/default-user.png';
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
                    userAvatarHeader.src = storedPhotoUrl;
                    userAvatarHeader.loading = 'eager';
                };
                
                preloadImg.src = freshUrl;
            } else {
                userAvatarHeader.src = storedPhotoUrl;
            }
        }
    }

    // ----------------------------------------------------------------------
    // DESTAQUES MINI (faixa tipo stories)
    // ----------------------------------------------------------------------
    function buildDemoDestaques() {
        const nomes = ['Ana', 'Bruno', 'Carla', 'Diego', 'Eva', 'Fábio', 'Gabi', 'Hugo', 'Iris', 'João'];
        return nomes.map((nome, idx) => {
            const img = `https://via.placeholder.com/300x200?text=Trabalho+${idx+1}`;
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

        const isMobileAds = window.innerWidth <= 992;

        // Pool de anúncios (visível para todos). Para adicionar/remover, edite aqui.
        const anunciosPool = [
            {
                titulo: 'Oferta para sua obra',
                loja: 'Loja de Tintas ColorMix',
                endereco: 'Av. Central, 123 - Centro',
                linkPerfil: '/perfil.html?id=empresa-demo',
                linkMapa: 'https://www.google.com/maps/search/Loja+de+Tintas+ColorMix+Av+Central+123',
                imagem: 'https://via.placeholder.com/400x240?text=Tintas+ColorMix'
            },
            {
                titulo: 'Ferramentas em Promoção',
                loja: 'Casa do Construtor',
                endereco: 'Rua das Ferramentas, 50 - Centro',
                linkPerfil: '/perfil.html?id=empresa-ferramentas',
                linkMapa: 'https://www.google.com/maps/search/Casa+do+Construtor+Rua+das+Ferramentas+50',
                imagem: 'https://via.placeholder.com/400x240?text=Ferramentas'
            },
            {
                titulo: 'Entrega de Material Rápida',
                loja: 'Depósito Constrular',
                endereco: 'Av. das Indústrias, 200',
                linkPerfil: '/perfil.html?id=empresa-material',
                linkMapa: 'https://www.google.com/maps/search/Deposito+Constrular+Av+das+Industrias+200',
                imagem: 'https://via.placeholder.com/400x240?text=Material+de+Obra'
            }
        ];

        const baseItems = lista.map(item => {
            const imagens = (item.thumbUrls && item.thumbUrls.length > 0) ? item.thumbUrls : (item.images || []);
            const primeira = imagens[0] || 'imagens/default-user.png';
            const extra = Math.max((imagens.length - 1), 0);
            const profissional = item.user || {};
            const nota = item.mediaAvaliacao || profissional.mediaAvaliacao || 0;
            return { tipo: 'destaque', data: { item, primeira, extra, profissional, nota } };
        });

        let itemsComAnuncio = [...baseItems];

        if (isMobileAds && baseItems.length > 0 && anunciosPool.length > 0) {
            const anunciosShuffled = [...anunciosPool].sort(() => Math.random() - 0.5);
            let idxAnuncio = 0;
            let insertAt = Math.min(5 + Math.floor(Math.random() * 6), itemsComAnuncio.length);

            while (idxAnuncio < anunciosShuffled.length && itemsComAnuncio.length > 0) {
                if (insertAt >= itemsComAnuncio.length) {
                    insertAt = Math.max(1, Math.floor(itemsComAnuncio.length / 2));
                }
                itemsComAnuncio.splice(insertAt, 0, { tipo: 'anuncio', data: anunciosShuffled[idxAnuncio] });
                idxAnuncio += 1;
                insertAt += Math.min(5 + Math.floor(Math.random() * 6), Math.max(1, itemsComAnuncio.length - insertAt));
            }
        }

        destaquesScroll.innerHTML = '';

        itemsComAnuncio.forEach(entry => {
            if (entry.tipo === 'anuncio') {
                const ad = entry.data;
                const card = document.createElement('div');
                card.className = 'thumb-destaque anuncio-nativo';
                card.innerHTML = `
                    <img src="${ad.imagem}" alt="" class="anuncio-nativo-img">
                    <div class="anuncio-nativo-badge">Anúncio</div>
                    <div class="anuncio-nativo-overlay">
                        <div class="anuncio-nativo-titulo">${ad.titulo}</div>
                        <div class="anuncio-nativo-loja">${ad.loja}</div>
                        <div class="anuncio-nativo-endereco">${ad.endereco}</div>
                    </div>
                `;
                card.addEventListener('click', () => {
                    if (ad.linkPerfil) window.location.href = ad.linkPerfil;
                });
                destaquesScroll.appendChild(card);
                return;
            }

            const { item, primeira, extra, profissional, nota } = entry.data;
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

        const isMobileAds = window.innerWidth <= 992;
        const anunciosFeed = [
            {
                titulo: 'Oferta para sua obra',
                loja: 'Loja de Tintas ColorMix',
                endereco: 'Av. Central, 123 - Centro',
                linkPerfil: '/perfil.html?id=empresa-demo',
                imagem: 'https://via.placeholder.com/600x320?text=Tintas+ColorMix',
                linkMapa: 'https://www.google.com/maps/search/Loja+de+Tintas+ColorMix+Av+Central+123'
            },
            {
                titulo: 'Ferramentas em Promoção',
                loja: 'Casa do Construtor',
                endereco: 'Rua das Ferramentas, 50 - Centro',
                linkPerfil: '/perfil.html?id=empresa-ferramentas',
                imagem: 'https://via.placeholder.com/600x320?text=Ferramentas',
                linkMapa: 'https://www.google.com/maps/search/Casa+do+Construtor+Rua+das+Ferramentas+50'
            },
            {
                titulo: 'Entrega de Material Rápida',
                loja: 'Depósito Constrular',
                endereco: 'Av. das Indústrias, 200',
                linkPerfil: '/perfil.html?id=empresa-material',
                imagem: 'https://via.placeholder.com/600x320?text=Material+de+Obra',
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

    // ----------------------------------------------------------------------
    // BOTÃO LATERAL (MOBILE) PARA ABRIR CATEGORIAS / AÇÕES RÁPIDAS / TIMES
    // ----------------------------------------------------------------------
    const categoriasAside = document.querySelector('.categorias');
    const mobileSidebarClose = document.getElementById('mobile-sidebar-close');
    let mobileSidebarBackdrop = null;

    if (mobileSidebarToggle && categoriasAside) {
        mobileSidebarBackdrop = document.createElement('div');
        mobileSidebarBackdrop.id = 'mobile-sidebar-backdrop';
        document.body.appendChild(mobileSidebarBackdrop);

        function fecharSidebarMobile() {
            categoriasAside.classList.remove('aberta');
            mobileSidebarBackdrop.classList.remove('visible');
            mobileSidebarToggle.classList.remove('hidden');
        }

        function abrirSidebarMobile() {
            categoriasAside.classList.add('aberta');
            mobileSidebarBackdrop.classList.add('visible');
            mobileSidebarToggle.classList.add('hidden');
        }

        mobileSidebarToggle.addEventListener('click', () => {
            if (categoriasAside.classList.contains('aberta')) {
                fecharSidebarMobile();
            } else {
                abrirSidebarMobile();
            }
        });

        if (mobileSidebarClose) {
            mobileSidebarClose.addEventListener('click', fecharSidebarMobile);
        }

        mobileSidebarBackdrop.addEventListener('click', fecharSidebarMobile);
    }

    if (filtroCidadeBtn && filtroCidadeInput) {
        filtroCidadeBtn.addEventListener('click', () => {
            const cidade = filtroCidadeInput.value.trim();
            fetchPosts(cidade || null); // Busca todos se o campo estiver vazio
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
                if (userAvatarHeader) userAvatarHeader.src = 'imagens/default-user.png';
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
            }
        }
    })();
});

