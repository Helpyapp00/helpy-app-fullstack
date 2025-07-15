document.addEventListener('DOMContentLoaded', async function() {
    // --- Configurações Iniciais ---
    const API_BASE_URL = 'https://helpy-app-fullstack.vercel.app/api/';

    // Variáveis de estado globais (obtidas do localStorage)
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('jwtToken');
    const userType = localStorage.getItem('userType'); // Pega o tipo de usuário logado

    console.log('perfil.js carregado.');
    console.log('Token JWT no localStorage ao carregar perfil.js:', token);
    console.log('User ID no localStorage ao carregar perfil.js:', userId);
    console.log('User Type no localStorage ao carregar perfil.js:', userType);

    // Elementos de exibição do perfil
    const fotoPerfil = document.getElementById('fotoPerfil');
    const nomePerfil = document.getElementById('nomePerfil');
    const idadePerfil = document.getElementById('idadePerfil');
    const cidadePerfil = document.getElementById('cidadePerfil');
    const areaPerfil = document.getElementById('areaPerfil'); // Corresponde a 'atuacao' no backend
    
    // Elementos do cabeçalho
    const userAvatarHeader = document.getElementById('user-avatar-header');
    const userNameHeader = document.getElementById('userName-header');

    const backToFeedButton = document.getElementById('back-to-feed-button');
    const logoutButton = document.getElementById('logout-button');


    //Corresponde a 'atuacao' no backend
    const descricaoPerfil = document.getElementById('descricaoPerfil');
    const whatsappPerfil = document.getElementById('whatsappPerfil'); // Corresponde a 'telefone' no backend
    const emailPerfil = document.getElementById('emailPerfil');
    const mediaEstrelasDisplay = document.getElementById('mediaEstrelas'); // Display das estrelas da média de avaliação
    const totalAvaliacoes = document.getElementById('totalAvaliacoes');
    const galeriaServicos = document.getElementById('galeriaServicos');
    const mensagemGaleriaVazia = document.getElementById('mensagemGaleriaVazia');

    // Elementos de input para edição
    const inputFotoPerfil = document.getElementById('inputFotoPerfil');
    const labelInputFotoPerfil = document.getElementById('labelInputFotoPerfil');
    const inputNome = document.getElementById('inputNome');
    const inputIdade = document.getElementById('inputIdade');
    const inputCidade = document.getElementById('inputCidade');
    const inputAtuacao = document.getElementById('inputAtuacao');
    const inputDescricao = document.getElementById('inputDescricao');
    const inputWhatsapp = document.getElementById('inputWhatsapp');
    const inputEmail = document.getElementById('inputEmail');

    // Botões de ação do perfil
    const btnEditarPerfil = document.getElementById('btnEditarPerfil');
    const btnSalvarPerfil = document.getElementById('btnSalvarPerfil');
    const btnCancelarEdicao = document.getElementById('btnCancelarEdicao');

    // Elementos de avaliação (para avaliador)
    const estrelasAvaliacaoClickable = document.querySelectorAll('.estrelas span'); // Estrelas clicáveis para dar nota
    const notaSelecionadaDisplay = document.getElementById('notaSelecionada');
    const formAvaliacao = document.getElementById('formAvaliacao');
    const comentarioAvaliacaoInput = document.getElementById('comentarioAvaliacaoInput');
    const formAvaliacaoMessage = document.getElementById('form-avaliacao-message');

    // Portfólio de serviços
    const btnAnexarFoto = document.getElementById('btnAnexarFoto');
    const inputFotoServico = document.getElementById('inputFotoServico');

    // Modal de Logout
    const logoutConfirmModal = document.getElementById('logout-confirm-modal');
    const confirmLogoutYesBtn = document.getElementById('confirm-logout-yes');
    const confirmLogoutNoBtn = document.getElementById('confirm-logout-no');

    // --- Variáveis de Estado Internas ---
    let currentRating = 0; // Para a avaliação de estrelas (quando o usuário avalia)
    let userProfileData = null; // Para armazenar os dados do perfil carregados do backend (importante para edição)


    // --- Funções Auxiliares ---

    /**
     * Exibe uma mensagem em um elemento HTML.
     * @param {string} message - A mensagem a ser exibida.
     * @param {'success'|'error'|'info'} type - O tipo da mensagem (para estilos CSS).
     * @param {HTMLElement} element - O elemento HTML onde a mensagem será exibida.
     */
    function showMessage(message, type, element) {
        if (!element) {
            console.warn('Elemento da mensagem não encontrado.');
            return;
        }
        element.textContent = message;
        element.className = `form-message ${type}`;
        element.classList.remove('hidden');
        // Esconde a mensagem após 5 segundos, a menos que seja 'info'
        if (type !== 'info') {
            setTimeout(() => {
                element.classList.add('hidden');
            }, 5000);
        }
    }

    /**
     * Decodifica um token JWT e extrai o payload.
     * @param {string} token - O token JWT a ser decodificado.
     * @returns {object|null} O payload decodificado ou null se houver erro.
     */
    function decodeJwtToken(token) {
        if (!token) return null;
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            console.error('Erro ao decodificar token JWT:', e);
            return null;
        }
    }

    /**
     * Verifica a autenticação e redireciona para a página de login se o token for inválido ou ausente.
     * @returns {boolean} True se o token for válido e não expirado, false caso contrário.
     */
    function checkAuthAndRedirect() {
        if (!token) { // Usando a variável global `token`
            console.warn('Token JWT não encontrado. Redirecionando para login.');
            window.location.href = 'login.html';
            return false;
        }

        const decodedToken = decodeJwtToken(token);
        // Verifica se o token existe e não está expirado
        if (!decodedToken || decodedToken.exp * 1000 < Date.now()) {
            console.warn('Token JWT expirado ou inválido. Redirecionando para login.');
            localStorage.clear(); // Limpa todo o localStorage para garantir
            window.location.href = 'login.html';
            return false;
        }
        // Garante que userId está no localStorage, se não, tenta pegar do token
        if (!userId && decodedToken.userId) {
            localStorage.setItem('userId', decodedToken.userId);
        }
        return true; // Token válido
    }

    /**
     * Renderiza as estrelas de avaliação média de um perfil.
     * @param {number} rating - A nota média (0-5).
     * @param {HTMLElement} element - O elemento HTML onde as estrelas serão renderizadas.
     */
    function renderAverageStars(rating, element) {
        if (!element) return;
        element.innerHTML = ''; // Limpa estrelas existentes
        for (let i = 1; i <= 5; i++) {
            const star = document.createElement('i');
            star.classList.add('fas', 'fa-star'); // fas para preenchida, far para vazia (ajuste com seu CSS)
            if (i <= rating) {
                star.style.color = '#FFD700'; // Estrela preenchida (cor dourada)
            } else {
                star.style.color = '#d3d3d3'; // Estrela vazia (cinza claro)
            }
            element.appendChild(star);
        }
    }

    /**
     * Atualiza o estado visual das estrelas clicáveis no formulário de avaliação.
     * @param {number} rating - A nota selecionada.
     */
    function updateStarRating(rating) {
        currentRating = rating;
        estrelasAvaliacaoClickable.forEach(starSpan => {
            const starValue = parseInt(starSpan.dataset.value);
            const starIcon = starSpan.querySelector('i');
            if (starIcon) {
                starIcon.className = `fa-star ${starValue <= rating ? 'fas' : 'far'}`;
            }
        });
        if (notaSelecionadaDisplay) {
            notaSelecionadaDisplay.textContent = rating > 0 ? `Sua avaliação: ${rating} estrelas` : '';
        }
    }

    /**
     * Carrega e exibe as informações básicas do usuário no cabeçalho.
     */
    function loadUserInfo() {
        const userName = localStorage.getItem('userName');
        const userPhotoUrl = localStorage.getItem('userPhotoUrl');

        if (userNameHeader) {
            userNameHeader.textContent = userName || 'Usuário';
        }
        if (userAvatarHeader) {
            // Removendo via.placeholder.com e usando fallback local
            userAvatarHeader.src = userPhotoUrl || 'imagens/default-user.png';
        }
    }

    /**
     * Renderiza as imagens do portfólio de serviços e adiciona botões de remover no modo de edição.
     * @param {string[]} imageUrls - Array de URLs das imagens de serviço.
     */
    function renderGaleriaServicos(imageUrls) {
        if (!galeriaServicos) return;
        galeriaServicos.innerHTML = ''; // Limpa a galeria existente

        if (imageUrls && imageUrls.length > 0) {
            imageUrls.forEach((url, index) => {
                const wrapper = document.createElement('div');
                wrapper.classList.add('servico-imagem-wrapper');

                const img = document.createElement('img');
                img.src = url;
                img.alt = `Serviço ${index + 1}`;
                img.classList.add('servico-imagem');

                // Adiciona botão de remover imagem no modo de edição
                const removeBtn = document.createElement('button');
                removeBtn.classList.add('btn-remover-foto', 'oculto'); // Oculto por padrão
                removeBtn.innerHTML = '<i class="fas fa-times-circle"></i>';
                removeBtn.title = 'Remover Imagem';
                // Usa um wrapper para passar o índice correto para a função removerFotoServico
                removeBtn.addEventListener('click', () => removerFotoServico(index));
                
                wrapper.appendChild(img);
                wrapper.appendChild(removeBtn);
                galeriaServicos.appendChild(wrapper);
            });
            mensagemGaleriaVazia.style.display = 'none';
        } else {
            mensagemGaleriaVazia.style.display = 'block';
        }
        // Garante que os botões de remover foto estejam visíveis se estiver no modo de edição
        if (btnSalvarPerfil && !btnSalvarPerfil.classList.contains('oculto')) {
            document.querySelectorAll('.btn-remover-foto').forEach(btn => btn.classList.remove('oculto'));
        }
    }


    // --- Funções Principais de Perfil ---

    /**
     * Carrega os dados completos do perfil do backend e preenche a UI.
     */
    async function fetchUserProfile() {
        if (!userId || !token) {
            console.error('ID do usuário ou Token não encontrado. Não é possível buscar o perfil. Redirecionando...');
            checkAuthAndRedirect(); // Tenta redirecionar
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
            console.log('Dados brutos do perfil recebidos do backend:', data); // DEBUG: MUITO IMPORTANTE!

            if (!response.ok) {
                console.error(`Erro ao buscar perfil: ${response.status} - ${data.message || 'Erro desconhecido'}`);
                showMessage(data.message || 'Erro ao carregar perfil.', 'error', document.querySelector('.perfil-box'));
                return;
            }

            // ATENÇÃO: Assumimos que o backend retorna os dados do usuário DENTRO de uma propriedade 'user'.
            // Se o seu backend retornar o objeto de usuário diretamente, use `const user = data;`
            const user = data.user;
            if (!user) {
                console.error('Dados de usuário ausentes na resposta do backend (propriedade "user" não encontrada).');
                showMessage('Erro: Dados do usuário incompletos.', 'error', document.querySelector('.perfil-box'));
                return;
            }

            userProfileData = user; // Armazena os dados para uso no modo de edição e outras funções

            // Preencher os elementos de exibição do HTML com os dados do perfil
            if (nomePerfil) nomePerfil.textContent = user.nome || 'Não informado';
            if (idadePerfil) idadePerfil.textContent = user.idade ? `${user.idade} anos` : 'Não informado';
            if (cidadePerfil) cidadePerfil.textContent = user.cidade || 'Não informado';
            if (areaPerfil) areaPerfil.textContent = user.atuacao || 'Não informado';
            if (descricaoPerfil) descricaoPerfil.textContent = user.descricao || 'Nenhuma descrição fornecida.';

            // Lidar com informações de contato
            if (whatsappPerfil) {
                whatsappPerfil.innerHTML = user.telefone ?
                    `<i class="fab fa-whatsapp"></i> <a href="https://wa.me/55${user.telefone.replace(/\D/g,'')}" target="_blank">${user.telefone}</a>` : // Adicionado 55 para DDI Brasil
                    '<i class="fab fa-whatsapp"></i> Não informado';
            }
            if (emailPerfil) {
                emailPerfil.innerHTML = user.email ?
                    `<i class="fas fa-envelope"></i> <a href="mailto:${user.email}">${user.email}</a>` :
                    '<i class="fas fa-envelope"></i> Não informado';
            }

            // Exibir foto de perfil
            if (fotoPerfil) { // Verifica se o elemento existe
                // CORREÇÃO: Usar 'user.fotoPerfilUrl' ou 'user.fotoPerfil' conforme o backend retorna.
                // Assumindo que 'fotoPerfilUrl' é o campo que o backend usa para a URL pública da foto de perfil.
                if (user.fotoPerfilUrl) { 
                    fotoPerfil.src = user.fotoPerfilUrl;
                } else {
                    fotoPerfil.src = 'imagens/default-profile.png'; // Fallback para a imagem padrão local
                }
            }
            // CORREÇÃO: Usar 'user.fotoPerfilUrl' para o userAvatarHeader também
            if (userAvatarHeader) { 
                if (user.fotoPerfilUrl) { 
                    userAvatarHeader.src = user.fotoPerfilUrl;
                } else {
                    userAvatarHeader.src = 'imagens/default-user.png'; // Fallback para a imagem padrão local
                }
            }

            // Atualizar cabeçalho (já é feito por loadUserInfo, mas reconfirmamos)
            // Também salva no localStorage para que o header do index.html também seja atualizado.
            localStorage.setItem('userName', user.nome || '');
            localStorage.setItem('userPhotoUrl', user.fotoPerfilUrl || ''); // Certifique-se de salvar a URL correta aqui
            loadUserInfo(); 

            // Renderizar avaliações
            if (user.mediaAvaliacao !== undefined && user.totalAvaliacoes !== undefined) {
                renderAverageStars(user.mediaAvaliacao, mediaEstrelasDisplay);
                if (totalAvaliacoes) totalAvaliacoes.textContent = `(${user.totalAvaliacoes} avaliações)`;
            } else {
                if (mediaEstrelasDisplay) mediaEstrelasDisplay.innerHTML = '';
                if (totalAvaliacoes) totalAvaliacoes.textContent = '(0 avaliações)';
            }

            // Renderizar galeria de serviços
            renderGaleriaServicos(user.servicosImagens);
            
            // Gerenciar visibilidade do formulário de avaliação e botão de anexar fotos
            const isViewingOwnProfile = (user._id === userId); // user._id é o ID do perfil sendo visualizado, userId é o ID do usuário logado

            if (formAvaliacao) {
                if (isViewingOwnProfile || userType === 'trabalhador') { // Trabalhadores não podem avaliar a si mesmos, nem clientes podem ver formulário de avaliação no perfil de cliente.
                    formAvaliacao.style.display = 'none';
                } else { // Se o usuário logado é um cliente visitando o perfil de um trabalhador
                    formAvaliacao.style.display = 'block';
                }
            }

            if (btnAnexarFoto) {
                if (userType === 'trabalhador' && isViewingOwnProfile) { // Apenas trabalhador pode anexar fotos no próprio perfil
                    btnAnexarFoto.classList.remove('oculto');
                } else {
                    btnAnexarFoto.classList.add('oculto');
                }
            }

        } catch (error) {
            console.error('Erro ao buscar ou processar dados do perfil:', error);
            showMessage('Erro: Não foi possível carregar o perfil. Verifique sua conexão ou tente novamente.', 'error', document.querySelector('.perfil-box'));
        }
    }

    /**
     * Alterna entre o modo de exibição e edição do perfil.
     * @param {boolean} enable - True para habilitar o modo de edição, false para desabilitar.
     */
    function toggleEditMode(enable) {
        const displayElements = [nomePerfil, idadePerfil, cidadePerfil, areaPerfil, descricaoPerfil, whatsappPerfil, emailPerfil];
        const inputElements = [inputNome, inputIdade, inputCidade, inputAtuacao, inputDescricao, inputWhatsapp, inputEmail];

        if (enable) { // Entrar no modo de edição
            displayElements.forEach(el => el && el.classList.add('oculto'));
            inputElements.forEach(el => el && el.classList.remove('oculto'));

            // Preencher inputs com os dados atuais do perfil (se houver dados carregados)
            if (userProfileData) {
                if (inputNome) inputNome.value = userProfileData.nome || '';
                if (inputIdade) inputIdade.value = userProfileData.idade || '';
                if (inputCidade) inputCidade.value = userProfileData.cidade || '';
                if (inputAtuacao) inputAtuacao.value = userProfileData.atuacao || '';
                if (inputDescricao) inputDescricao.value = userProfileData.descricao || '';
                if (inputWhatsapp) inputWhatsapp.value = userProfileData.telefone || '';
                if (inputEmail) inputEmail.value = userProfileData.email || '';
            }

            // Mostrar input de foto e label
            if (fotoPerfil) fotoPerfil.classList.add('oculto');
            if (inputFotoPerfil) inputFotoPerfil.classList.remove('oculto');
            if (labelInputFotoPerfil) labelInputFotoPerfil.classList.remove('oculto');

            // Trocar botões
            if (btnEditarPerfil) btnEditarPerfil.classList.add('oculto');
            if (btnSalvarPerfil) btnSalvarPerfil.classList.remove('oculto');
            if (btnCancelarEdicao) btnCancelarEdicao.classList.remove('oculto');

            // Mostrar botões de remover foto de serviço
            if (userType === 'trabalhador' && userProfileData && userProfileData._id === userId) {
                document.querySelectorAll('.btn-remover-foto').forEach(btn => btn.classList.remove('oculto'));
                if (btnAnexarFoto) btnAnexarFoto.classList.remove('oculto');
            }

        } else { // Sair do modo de edição
            displayElements.forEach(el => el && el.classList.remove('oculto'));
            inputElements.forEach(el => el && el.classList.add('oculto'));

            // Esconder input de foto e label, mostrar foto do perfil
            if (inputFotoPerfil) inputFotoPerfil.classList.add('oculto');
            if (labelInputFotoPerfil) labelInputFotoPerfil.classList.add('oculto');
            if (fotoPerfil) fotoPerfil.classList.remove('oculto');

            // Trocar botões
            if (btnEditarPerfil) btnEditarPerfil.classList.remove('oculto');
            if (btnSalvarPerfil) btnSalvarPerfil.classList.add('oculto');
            if (btnCancelarEdicao) btnCancelarEdicao.classList.add('oculto');

            // Esconder botões de remover foto de serviço
            document.querySelectorAll('.btn-remover-foto').forEach(btn => btn.classList.add('oculto'));
            if (btnAnexarFoto) btnAnexarFoto.classList.add('oculto');
        }
    }

    /**
     * Salva as alterações do perfil enviando os dados para o backend.
     */
    async function saveProfileChanges() {
        const formData = new FormData();
        // Adiciona campos de texto se os elementos existirem
        if (inputNome) formData.append('nome', inputNome.value);
        if (inputIdade) formData.append('idade', inputIdade.value);
        if (inputCidade) formData.append('cidade', inputCidade.value);
        if (inputAtuacao) formData.append('atuacao', inputAtuacao.value);
        if (inputDescricao) formData.append('descricao', inputDescricao.value);
        if (inputWhatsapp) formData.append('telefone', inputWhatsapp.value); // Backend espera 'telefone' para WhatsApp
        if (inputEmail) formData.append('email', inputEmail.value);

        // Adiciona nova foto de perfil, se selecionada
        if (inputFotoPerfil && inputFotoPerfil.files && inputFotoPerfil.files[0]) {
            formData.append('fotoPerfil', inputFotoPerfil.files[0]);
        }

        try {
            const response = await fetch(`${API_BASE_URL}/user/${userId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                    // Não defina 'Content-Type': 'multipart/form-data', o navegador faz isso automaticamente com FormData
                },
                body: formData
            });

            const data = await response.json();

            if (response.ok && data.success) {
                showMessage('Perfil atualizado com sucesso!', 'success', document.querySelector('.perfil-box .form-message')); // Use a função showMessage
                // Atualiza o localStorage com os novos dados
                if (data.user) {
                    localStorage.setItem('userName', data.user.nome || '');
                    localStorage.setItem('userPhotoUrl', data.user.fotoPerfilUrl || '');
                }
                await fetchUserProfile(); // Recarrega o perfil para exibir os dados atualizados
                toggleEditMode(false); // Sai do modo de edição
            } else {
                showMessage(data.message || 'Erro ao salvar alterações no perfil.', 'error', document.querySelector('.perfil-box .form-message'));
            }
        } catch (error) {
            console.error('Erro ao salvar perfil:', error);
            showMessage('Erro ao salvar alterações. Tente novamente mais tarde.', 'error', document.querySelector('.perfil-box .form-message'));
        }
    }

    /**
     * Adiciona uma ou mais fotos ao portfólio de serviços.
     * @param {Event} event - O evento de mudança do input de arquivo.
     */
    async function adicionarFotoServico(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append('servicoImagens', files[i]); // 'servicoImagens' deve corresponder ao nome do campo esperado pelo backend
        }

        try {
            const response = await fetch(`${API_BASE_URL}/user/${userId}/servicos-imagens`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();
            if (response.ok && data.success) {
                showMessage('Foto(s) de serviço adicionada(s) com sucesso!', 'success', document.querySelector('.portfolio-servicos .form-message') || galeriaServicos.closest('.container').querySelector('.form-message'));
                fetchUserProfile(); // Recarrega o perfil para mostrar as novas fotos
            } else {
                showMessage(data.message || 'Erro ao adicionar foto(s) de serviço.', 'error', document.querySelector('.portfolio-servicos .form-message') || galeriaServicos.closest('.container').querySelector('.form-message'));
            }
        } catch (error) {
            console.error('Erro ao adicionar foto de serviço:', error);
            showMessage('Erro ao adicionar foto(s) de serviço. Tente novamente mais tarde.', 'error', document.querySelector('.portfolio-servicos .form-message') || galeriaServicos.closest('.container').querySelector('.form-message'));
        }
    }

    /**
     * Remove uma foto específica do portfólio de serviços.
     * @param {number} imageIndex - O índice da imagem a ser removida.
     */
    async function removerFotoServico(imageIndex) {
        if (!confirm('Tem certeza que deseja remover esta foto?')) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/user/${userId}/servicos-imagens/${imageIndex}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            if (response.ok && data.success) {
                showMessage('Foto de serviço removida com sucesso!', 'success', document.querySelector('.portfolio-servicos .form-message') || galeriaServicos.closest('.container').querySelector('.form-message'));
                fetchUserProfile(); // Recarrega o perfil para atualizar a galeria
            } else {
                showMessage(data.message || 'Erro ao remover foto de serviço.', 'error', document.querySelector('.portfolio-servicos .form-message') || galeriaServicos.closest('.container').querySelector('.form-message'));
            }
        } catch (error) {
            console.error('Erro ao remover foto de serviço:', error);
            showMessage('Erro ao remover foto de serviço. Tente novamente mais tarde.', 'error', document.querySelector('.portfolio-servicos .form-message') || galeriaServicos.closest('.container').querySelector('.form-message'));
        }
    }

    /**
     * Envia uma avaliação para um trabalhador.
     * @param {Event} event - O evento de submit do formulário.
     */
    async function submitAvaliacao(event) {
        event.preventDefault();

        if (!currentRating || currentRating === 0) {
            showMessage('Por favor, selecione uma nota para a avaliação.', 'error', formAvaliacaoMessage);
            return;
        }

        const comentario = comentarioAvaliacaoInput.value.trim();
        const avaliadorId = localStorage.getItem('userId'); // Quem está avaliando
        const trabalhadorId = userProfileData ? userProfileData._id : null; // O ID do perfil que está sendo avaliado

        if (!trabalhadorId) {
            showMessage('Erro: Não foi possível identificar o trabalhador a ser avaliado.', 'error', formAvaliacaoMessage);
            return;
        }
        if (!avaliadorId) {
            showMessage('Erro: ID do avaliador não encontrado. Faça login novamente.', 'error', formAvaliacaoMessage);
            return;
        }

        showMessage('Enviando avaliação...', 'info', formAvaliacaoMessage);
        try {
            const response = await fetch(`${API_BASE_URL}/user/${trabalhadorId}/avaliar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ estrelas: currentRating, comentario: comentario, avaliadorId: avaliadorId })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                showMessage('Avaliação enviada com sucesso!', 'success', formAvaliacaoMessage);
                comentarioAvaliacaoInput.value = '';
                updateStarRating(0); // Reseta as estrelas visuais
                if (notaSelecionadaDisplay) notaSelecionadaDisplay.textContent = ''; // Limpa o texto da nota selecionada
                fetchUserProfile(); // Recarrega o perfil para atualizar a média de avaliações
            } else {
                showMessage(data.message || 'Erro ao enviar avaliação.', 'error', formAvaliacaoMessage);
            }
        } catch (error) {
            console.error('Erro ao enviar avaliação:', error);
            showMessage('Erro: Não foi possível enviar a avaliação.', 'error', formAvaliacaoMessage);
        }
    }


    // --- Event Listeners ---

    if (backToFeedButton) {
        backToFeedButton.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    // Modal de Logout
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            if (logoutConfirmModal) logoutConfirmModal.classList.remove('hidden');
        });
    }
    if (confirmLogoutYesBtn) {
        confirmLogoutYesBtn.addEventListener('click', () => {
            localStorage.clear(); // Limpa todo o localStorage
            window.location.href = 'login.html';
        });
    }
    if (confirmLogoutNoBtn) {
        confirmLogoutNoBtn.addEventListener('click', () => {
            if (logoutConfirmModal) logoutConfirmModal.classList.add('hidden');
        });
    }

    // Botões de ação do perfil (Editar, Salvar, Cancelar)
    if (btnEditarPerfil) {
        btnEditarPerfil.addEventListener('click', () => toggleEditMode(true));
    }
    if (btnSalvarPerfil) {
        btnSalvarPerfil.addEventListener('click', saveProfileChanges);
    }
    if (btnCancelarEdicao) {
        btnCancelarEdicao.addEventListener('click', () => {
            toggleEditMode(false);
            fetchUserProfile(); // Recarrega o perfil para descartar quaisquer edições não salvas
        });
    }

    // Pré-visualização da imagem de perfil ao selecionar um arquivo
    if (inputFotoPerfil) {
        inputFotoPerfil.addEventListener('change', function() {
            if (this.files && this.files[0] && fotoPerfil) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    fotoPerfil.src = e.target.result;
                };
                reader.readAsDataURL(this.files[0]);
            }
        });
    }

    // Lógica de avaliação de estrelas (clicável para avaliar)
    estrelasAvaliacaoClickable.forEach(starSpan => {
        starSpan.addEventListener('click', function() {
            const rating = parseInt(this.dataset.value);
            updateStarRating(rating);
        });
    });

    // Envio do formulário de avaliação
    if (formAvaliacao) {
        formAvaliacao.addEventListener('submit', submitAvaliacao);
    }

    // Adicionar foto de serviço (clique no botão para abrir o input de arquivo)
    if (btnAnexarFoto) {
        btnAnexarFoto.addEventListener('click', () => {
            if (inputFotoServico) inputFotoServico.click();
        });
    }
    // Lidar com a seleção de arquivos para adicionar fotos de serviço
    if (inputFotoServico) {
        inputFotoServico.addEventListener('change', adicionarFotoServico);
    }


    // --- Inicialização da Página ---

    // Garante que o modo de exibição esteja ativo ao carregar a página (inputs escondidos)
    toggleEditMode(false);

    // Carrega informações básicas do usuário no cabeçalho
    loadUserInfo();

    // Verifica a autenticação e carrega os dados completos do perfil
    if (checkAuthAndRedirect()) {
        fetchUserProfile();
    }
});