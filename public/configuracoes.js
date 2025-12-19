// Este script é uma versão simplificada do perfil.js
// Ele cuida apenas do cabeçalho das páginas de configurações.

document.addEventListener('DOMContentLoaded', () => {
    const loggedInUserId = localStorage.getItem('userId');
    const token = localStorage.getItem('jwtToken');

    // Checagem de segurança
    if (!loggedInUserId || !token) {
        alert('Você precisa estar logado para acessar esta página.');
        window.location.href = 'login.html';
        return;
    }

    // --- Elementos do Header ---
    const userAvatarHeader = document.getElementById('user-avatar-header');
    const userNameHeader = document.getElementById('user-name-header');
    const feedButton = document.getElementById('feed-button');
    const profileButton = document.getElementById('profile-button');
    const logoutButton = document.getElementById('logout-button');
    const logoBox = document.querySelector('.logo-box');
    
    // 🛑 NOVO: Botão Voltar
    const btnVoltar = document.getElementById('btn-voltar');

    // --- Modais de Logout ---
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

    // --- Função para carregar o Header ---
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

    // --- Listeners de Navegação do Header ---
    if (feedButton) {
        feedButton.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'index.html';
        });
    }

    if (profileButton) {
        profileButton.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = `perfil.html?id=${loggedInUserId}`;
        });
    }

    // Avatar + nome no header levam SEMPRE para o próprio perfil
    if (userAvatarHeader) {
        userAvatarHeader.style.cursor = 'pointer';
        userAvatarHeader.addEventListener('click', () => {
            if (loggedInUserId) {
                window.location.href = `perfil.html?id=${loggedInUserId}`;
            }
        });
    }

    if (userNameHeader) {
        userNameHeader.style.cursor = 'pointer';
        userNameHeader.addEventListener('click', () => {
            if (loggedInUserId) {
                window.location.href = `perfil.html?id=${loggedInUserId}`;
            }
        });
    }

    // 🛑 NOVO: Listener do Botão Voltar
    if (btnVoltar) {
        btnVoltar.addEventListener('click', () => {
            history.back(); // Volta para a página anterior (o feed)
        });
    }

    // --- Listeners de Logout ---
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault(); 
            logoutConfirmModal && logoutConfirmModal.classList.remove('hidden');
        });
    }
    if (confirmLogoutYesBtn) {
        confirmLogoutYesBtn.addEventListener('click', () => {
            const jaLogou = localStorage.getItem('helpy-ja-logou');
            localStorage.clear();
            if (jaLogou) {
                localStorage.setItem('helpy-ja-logou', jaLogou);
            }
            window.location.href = 'login.html';
        });
    }
    if (confirmLogoutNoBtn) {
        confirmLogoutNoBtn.addEventListener('click', () => {
            logoutConfirmModal && logoutConfirmModal.classList.add('hidden'); 
        });
    }

    // --- Inicialização do Header ---
    loadHeaderInfo();

    // ============================================
    // Navegação lateral das configurações
    // ============================================
    const menuItems = document.querySelectorAll('.config-menu-item');
    const sections = document.querySelectorAll('.config-section');

    function ativarSecao(sectionId) {
        sections.forEach(sec => {
            sec.classList.toggle('active', sec.id === sectionId);
        });
    }

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const alvo = item.getAttribute('data-section');
            if (alvo) {
                ativarSecao(alvo);
            }
        });
    });

    // Mantém "Dados pessoais" como padrão se nada estiver selecionado
    if (!document.querySelector('.config-menu-item.active') && menuItems[0]) {
        menuItems[0].classList.add('active');
        const alvo = menuItems[0].getAttribute('data-section');
        if (alvo) ativarSecao(alvo);
    }

    // ============================================
    // Personalização - Tema (Modo Escuro)
    // ============================================
    const darkModeToggleConfig = document.getElementById('dark-mode-toggle-config');
    const htmlElement = document.documentElement;

    function applyTheme(theme) {
        if (theme === 'dark') {
            htmlElement.classList.add('dark-mode');
            if (darkModeToggleConfig) darkModeToggleConfig.checked = true;
        } else {
            htmlElement.classList.remove('dark-mode');
            if (darkModeToggleConfig) darkModeToggleConfig.checked = false;
        }
    }

    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    if (darkModeToggleConfig) {
        darkModeToggleConfig.addEventListener('change', async () => {
            const theme = darkModeToggleConfig.checked ? 'dark' : 'light';
            applyTheme(theme);
            localStorage.setItem('theme', theme);

            // Atualiza preferência no servidor (mesma lógica do feed)
            if (loggedInUserId && token) {
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
                } catch (error) {
                    console.error('Erro ao atualizar preferência de tema:', error);
                    const revertedTheme = theme === 'dark' ? 'light' : 'dark';
                    applyTheme(revertedTheme);
                    localStorage.setItem('theme', revertedTheme);
                    darkModeToggleConfig.checked = revertedTheme === 'dark';
                    alert('Não foi possível salvar sua preferência de tema. Tente novamente.');
                }
            }
        });
    }

    // ============================================
    // Melhorar clique dos toggles (linha inteira clicável)
    // ============================================
    const toggleRows = document.querySelectorAll('.config-item-toggle');
    toggleRows.forEach(row => {
        row.addEventListener('click', (e) => {
            // Se o clique foi diretamente no input ou no próprio switch,
            // deixa o comportamento padrão do navegador (para não dar toggle duplo)
            if (e.target && e.target.tagName === 'INPUT') return;
            if (e.target && e.target.closest && e.target.closest('label.switch')) return;

            const checkbox = row.querySelector('input[type="checkbox"]');
            if (!checkbox) return;

            checkbox.checked = !checkbox.checked;
            // Dispara evento change para qualquer lógica extra (ex: tema)
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        });
    });
});

