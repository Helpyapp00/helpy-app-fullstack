// Este script é uma versão simplificada do perfil.js
// Ele cuida apenas do cabeçalho das páginas de configurações.

document.addEventListener('DOMContentLoaded', () => {
    const loggedInUserId = localStorage.getItem('userId');
    const token = localStorage.getItem('jwtToken');

    // Checagem de segurança
    if (!loggedInUserId || !token) {
        alert('Você precisa estar logado para acessar esta página.');
        window.location.href = '/login';
        return;
    }

    // --- Elementos do Header ---
    const userAvatarHeader = document.getElementById('user-avatar-header');
    const userNameHeader = document.getElementById('user-name-header');
    const feedButton = document.getElementById('feed-button');
    const profileButton = document.getElementById('profile-button');
    const logoutButton = document.getElementById('logout-button');
    
    // 🛑 NOVO: Botão Voltar
    const btnVoltar = document.getElementById('btn-voltar');

    // --- Modais de Logout ---
    const logoutConfirmModal = document.getElementById('logout-confirm-modal');
    const confirmLogoutYesBtn = document.getElementById('confirm-logout-yes');
    const confirmLogoutNoBtn = document.getElementById('confirm-logout-no');

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
            window.location.href = '/';
        });
    }

    if (profileButton) {
        profileButton.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = `/perfil?id=${loggedInUserId}`;
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
            if (typeof window.fazerLogout === 'function') {
                window.fazerLogout();
            } else {
                // Fallback se a função não estiver disponível
                if (window.notificacoesInterval) {
                    clearInterval(window.notificacoesInterval);
                }
                localStorage.clear();
                window.location.href = '/login';
            }
        });
    }
    if (confirmLogoutNoBtn) {
        confirmLogoutNoBtn.addEventListener('click', () => {
            logoutConfirmModal && logoutConfirmModal.classList.add('hidden'); 
        });
    }

    // --- Inicialização ---
    loadHeaderInfo();
});

