document.addEventListener('DOMContentLoaded', async function() {
    // --- Elementos do DOM ---
    const listaCategorias = document.getElementById('lista-categorias');
    const postsContainer = document.getElementById('posts-container');
    const newPostForm = document.getElementById('new-post-form');
    const postContentInput = document.getElementById('post-content-input');
    const postImageInput = document.getElementById('post-image-input');
    const imageFilenameDisplay = document.getElementById('image-filename');
    const imagePreview = document.getElementById('image-preview');
    const postFormMessage = document.getElementById('post-form-message');
    const logoutButton = document.getElementById('logout-button');
    const userAvatarHeader = document.getElementById('user-avatar-header');
    const userNameHeader = document.getElementById('user-name-header');
    const profileButton = document.getElementById('profile-button');

    const logoutConfirmModal = document.getElementById('logout-confirm-modal');
    const confirmLogoutYesBtn = document.getElementById('confirm-logout-yes');
    const confirmLogoutNoBtn = document.getElementById('confirm-logout-no');

    // --- Backend API URL ---
    const API_BASE_URL = 'https://helpyapp.net/api';

    // --- Funções de Feedback ---
    function showMessage(message, type, element = postFormMessage) {
        element.textContent = message;
        element.className = `form-message ${type}`;
        if (message) {
            element.classList.remove('hidden');
        } else {
            element.classList.add('hidden');
        }
    }

    // --- Autenticação e Redirecionamento ---
    function checkAuthAndRedirect() {
        const token = localStorage.getItem('jwtToken');
        if (!token) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    // --- Carregar Informações do Usuário no Cabeçalho (Atualizado) ---
    async function loadUserInfo() {
        const token = localStorage.getItem('jwtToken');
        const userId = localStorage.getItem('userId');

        if (!token || !userId) {
            console.warn('Token JWT ou User ID não encontrado. Usando placeholders.');
            userAvatarHeader.src = 'https://via.placeholder.com/50?text=User';
            userNameHeader.textContent = 'Usuário';
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/user/${userId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok && data.success && data.user) {
                const user = data.user;
                userNameHeader.textContent = user.nome || 'Usuário';
                userAvatarHeader.src = user.avatarUrl || 'https://via.placeholder.com/50?text=User';

                // Atualiza localStorage com os dados do backend
                localStorage.setItem('userName', user.nome || 'Usuário');
                localStorage.setItem('userPhotoUrl', user.avatarUrl || 'https://via.placeholder.com/50?text=User');
            } else {
                console.warn('Não foi possível carregar informações do usuário do backend, usando localStorage ou placeholders.', data.message);
                // Fallback para localStorage se a API falhar
                userNameHeader.textContent = localStorage.getItem('userName') || 'Usuário';
                userAvatarHeader.src = localStorage.getItem('userPhotoUrl') || 'https://via.placeholder.com/50?text=User';
            }
        } catch (error) {
            console.error('Erro ao buscar informações do usuário para o cabeçalho:', error);
            // Fallback para localStorage em caso de erro de rede
            userNameHeader.textContent = localStorage.getItem('userName') || 'Usuário';
            userAvatarHeader.src = localStorage.getItem('userPhotoUrl') || 'https://via.placeholder.com/50?text=User';
        }
    }

    // --- Logout ---
    logoutButton.addEventListener('click', function() {
        logoutConfirmModal.classList.remove('hidden');
    });

    confirmLogoutYesBtn.addEventListener('click', function() {
        localStorage.removeItem('jwtToken');
        localStorage.removeItem('userName');
        localStorage.removeItem('userPhotoUrl');
        localStorage.removeItem('userId');
        localStorage.removeItem('userType'); // Remover também o tipo de usuário
        window.location.href = 'login.html';
    });

    confirmLogoutNoBtn.addEventListener('click', function() {
        logoutConfirmModal.classList.add('hidden');
    });

    // --- Redirecionar para Perfil ---
    profileButton.addEventListener('click', function() {
        window.location.href = 'perfil.html';
    });

    // --- Funções de Carregamento de Publicações ---
    async function fetchPosts(category = 'todos', type = 'todos') {
        showMessage('Carregando publicações...', 'info');
        try {
            const token = localStorage.getItem('jwtToken');
            let url = `${API_BASE_URL}/posts`;
            if (category !== 'todos' || type !== 'todos') {
                url += `?category=${category}&type=${type}`;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok && data.success) {
                renderPosts(data.posts);
                showMessage('', 'success', postFormMessage); // Limpa a mensagem de carregamento
            } else {
                showMessage(data.message || 'Erro ao carregar publicações.', 'error');
                renderPosts([]);
            }
        } catch (error) {
            console.error('Erro ao buscar publicações:', error);
            showMessage('Erro: Não foi possível carregar as publicações.', 'error');
            renderPosts([]);
        }
    }

    function renderPosts(postsToRender) {
        postsContainer.innerHTML = '';
        const loggedInUserId = localStorage.getItem('userId');

        if (postsToRender.length === 0) {
            postsContainer.innerHTML = '<p style="color:gray">Nenhuma publicação ainda. Seja o primeiro a publicar!</p>';
            return;
        }

        postsToRender.forEach(p => {
            const div = document.createElement('div');
            div.className = 'post';
            div.dataset.postId = p._id;

            // Usa p.userPhotoUrl e p.userName que vêm da publicação no backend
            const userAvatar = p.userId && p.userId.avatarUrl ? `<img src="${p.userId.avatarUrl}" alt="Avatar" class="user-avatar">` : `<i class="fas fa-user-circle user-avatar"></i>`;
            const postImageHtml = p.imageUrl ? `<img src="${p.imageUrl}" alt="Imagem da publicação" class="post-image">` : '';
            const postDate = new Date(p.createdAt).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });

            let deleteButtonHtml = '';
            if (loggedInUserId && p.userId && p.userId.toString() === loggedInUserId) { // Verifica se p.userId existe
                deleteButtonHtml = `
                    <button class="btn-excluir-post" data-post-id="${p._id}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                    <div class="delete-confirmation-box hidden">
                        <p>Confirmar exclusão?</p>
                        <div class="confirmation-buttons">
                            <button class="btn-confirm-yes-delete" data-post-id="${p._id}">Sim</button>
                            <button class="btn-confirm-no-delete">Não</button>
                        </div>
                    </div>
                `;
            }

            div.innerHTML = `
                <div class="post-header">
                    ${userAvatar}
                    <div class="post-meta">
                        <span class="user-name">${p.userId ? p.userId.nome : 'Usuário Desconhecido'}</span>
                    </div>p
                    ${deleteButtonHtml}
                </div>
                <p class="post-content">${p.content}</p>
                ${postImageHtml}
                <div style="margin-top:10px; display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <button title="Funcionalidade em desenvolvimento">Curtir</button>
                        <button title="Funcionalidade em desenvolvimento">💬 Comentar</button>
                    </div>
                </div>
            `;
            postsContainer.appendChild(div);
        });

        // Lógica de exclusão de posts (mantida como estava)
        document.querySelectorAll('.btn-excluir-post').forEach(button => {
            const oldClickListener = button.__deletePostClickListener;
            if (oldClickListener) {
                button.removeEventListener('click', oldClickListener);
            }

            const newClickListener = function(event) {
                event.stopPropagation();

                document.querySelectorAll('.delete-confirmation-box').forEach(box => {
                    if (box !== this.nextElementSibling) {
                        box.classList.add('hidden');
                    }
                });

                const confirmationBox = this.nextElementSibling;
                if (confirmationBox) {
                    confirmationBox.classList.toggle('hidden');
                }
            };
            button.addEventListener('click', newClickListener);
            button.__deletePostClickListener = newClickListener;

            const confirmationBox = button.nextElementSibling;
            if (confirmationBox) {
                const yesButton = confirmationBox.querySelector('.btn-confirm-yes-delete');
                const noButton = confirmationBox.querySelector('.btn-confirm-no-delete');

                const oldYesListener = yesButton.__yesClickListener;
                if (oldYesListener) {
                    yesButton.removeEventListener('click', oldYesListener);
                }
                const oldNoListener = noButton.__noClickListener;
                if (oldNoListener) {
                    noButton.removeEventListener('click', oldNoListener);
                }

                const newYesListener = async function(event) {
                    event.stopPropagation();
                    const postId = this.dataset.postId;
                    await deletePost(postId);
                    confirmationBox.classList.add('hidden');
                };
                const newNoListener = function(event) {
                    event.stopPropagation();
                    confirmationBox.classList.add('hidden');
                };

                yesButton.addEventListener('click', newYesListener);
                noButton.addEventListener('click', newNoListener);

                yesButton.__yesClickListener = newYesListener;
                noButton.__noClickListener = newNoListener;
            }
        });

        document.addEventListener('click', e => {
            if (!e.target.closest('.delete-confirmation-box') && !e.target.closest('.btn-excluir-post')) {
                document.querySelectorAll('.delete-confirmation-box').forEach(box => {
                    box.classList.add('hidden');
                });
            }
        });
    }

    async function deletePost(postId) {
        showMessage('Excluindo publicação...', 'info');
        try {
            const token = localStorage.getItem('jwtToken');
            const response = await fetch(`${API_BASE_URL}/posts/${postId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok && data.success) {
                showMessage(data.message || 'Publicação excluída com sucesso!', 'success');
                document.querySelector(`.post[data-post-id=\"${postId}\"]`).remove();
            } else {
                showMessage(data.message || 'Erro ao excluir publicação.', 'error');
            }
        } catch (error) {
            console.error('Erro ao excluir publicação:', error);
            showMessage('Erro: Não foi possível excluir a publicação.', 'error');
        }
    }

    // --- Filtragem de Feed por Categoria e Tipo ---
    function filtrarFeed(categoria, tipo) {
        fetchPosts(categoria, tipo);
    }

    // --- Criação de Publicação ---
    newPostForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        const content = postContentInput.value.trim();
        const imageFile = postImageInput.files[0];

        if (!content && !imageFile) {
            showMessage('Por favor, escreva algo ou adicione uma imagem para publicar.', 'error', postFormMessage);
            return;
        }

        const formData = new FormData();
        formData.append('content', content);
        if (imageFile) {
            formData.append('image', imageFile);
        }

        // Adiciona userName e userPhotoUrl no FormData
        // Esses dados virão do localStorage, que foi atualizado por loadUserInfo ou login.js
        const userName = localStorage.getItem('userName');
        const userPhotoUrl = localStorage.getItem('userPhotoUrl');
        if (userName) formData.append('userName', userName);
        if (userPhotoUrl) formData.append('userPhotoUrl', userPhotoUrl);


        try {
            const token = localStorage.getItem('jwtToken');
            const response = await fetch(`${API_BASE_URL}/posts`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                    // 'Content-Type': 'multipart/form-data' é automaticamente definido pelo navegador para FormData
                },
                body: formData
            });

            const data = await response.json();

            if (response.ok && data.success) {
                showMessage(data.message || 'Publicação criada com sucesso!', 'success', postFormMessage);
                newPostForm.reset();
                imageFilenameDisplay.textContent = 'Nenhuma imagem selecionada';
                imagePreview.src = '#';
                imagePreview.classList.add('hidden');
                fetchPosts(); // Recarrega o feed para mostrar a nova publicação
            } else {
                showMessage(data.message || 'Erro ao criar publicação.', 'error', postFormMessage);
            }
        } catch (error) {
            console.error('Erro ao criar publicação:', error);
            showMessage('Erro: Não foi possível criar a publicação.', 'error', postFormMessage);
        }
    });

    // --- Event Listener para Adicionar Imagem ---
    postImageInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                imagePreview.src = e.target.result;
                imagePreview.classList.remove('hidden');
            };
            reader.readAsDataURL(this.files[0]);
            imageFilenameDisplay.textContent = this.files[0].name;
        } else {
            imageFilenameDisplay.textContent = 'Nenhuma imagem selecionada';
            imagePreview.src = '#';
            imagePreview.classList.add('hidden');
        }
    });

    // --- Gerar Categorias Dinamicamente e Event Listeners ---
    const categorias = ['Programação', 'Design', 'Marketing', 'Tradução', 'Aulas Particulares', 'Reformas', 'Eventos', 'Consultoria'];

    categorias.forEach(cat => {
        const li = document.createElement('li');
        li.className = 'categoria-item';

        li.innerHTML = `
            <div class="categoria-nome">
                ${cat} <span class="seta">🢇</span>
            </div>
            <div class="opcoes oculto">
                <button onclick="filtrarFeed('${cat}', 'cliente')">👤 Precisa de um Serviço</button>
                <button onclick="filtrarFeed('${cat}', 'trabalhador')">🛠️ Sou Trabalhador</button>
                <button onclick="filtrarFeed('${cat}', 'todos')">👁️ Ver Todos</button>
            </div>
        `;

        li.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON' && e.target.closest('.opcoes')) {
                return;
            }

            document.querySelectorAll('.categoria-item').forEach(item => {
                if (item !== li && item.classList.contains('expandida')) {
                    item.classList.remove('expandida');
                    item.querySelector('.opcoes')?.classList.add('oculto');
                }
            });

            const opcoes = li.querySelector('.opcoes');
            opcoes.classList.toggle('oculto');
            li.classList.toggle('expandida');
        });

        listaCategorias.appendChild(li);
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.categoria-item') &&
            !e.target.closest('#logout-confirm-modal') &&
            !e.target.closest('.delete-confirmation-box') &&
            !e.target.closest('.btn-excluir-post')) {
            document.querySelectorAll('.opcoes').forEach(op => op.classList.add('oculto'));
            document.querySelectorAll('.categoria-item').forEach(item => item.classList.remove('expandida'));
        }
    });

    // --- Inicialização ---
    if (checkAuthAndRedirect()) {
        loadUserInfo();
        fetchPosts();
    }
});