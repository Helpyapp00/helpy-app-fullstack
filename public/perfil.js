document.addEventListener('DOMContentLoaded', async function() {
    // --- Elementos do DOM ---
    const API_BASE_URL = 'http://localhost:3000/api';

    console.log('perfil.js carregado.');
    console.log('Token JWT no localStorage ao carregar perfil.js:', localStorage.getItem('jwtToken'));

    console.log('perfil.js carregado. Tentando acessar localStorage...');
    console.log('localStorage.length:', localStorage.length);
    console.log('Token JWT no localStorage (antes de checkAuthAndRedirect):', localStorage.getItem('jwtToken'));
    console.log('User ID no localStorage (antes de checkAuthAndRedirect):', localStorage.getItem('userId'));


    // Elementos de exibição do perfil
    const fotoPerfil = document.getElementById('fotoPerfil');
    const nomePerfil = document.getElementById('nomePerfil');
    const idadePerfil = document.getElementById('idadePerfil');
    const cidadePerfil = document.getElementById('cidadePerfil');
    const areaPerfil = document.getElementById('areaPerfil'); // 'atuacao' no backend
    const descricaoPerfil = document.getElementById('descricaoPerfil');
    const whatsappPerfil = document.getElementById('whatsappPerfil'); // 'telefone' no backend
    const emailPerfil = document.getElementById('emailPerfil');
    const mediaEstrelas = document.getElementById('mediaEstrelas');
    const totalAvaliacoes = document.getElementById('totalAvaliacoes');
    const galeriaServicos = document.getElementById('galeriaServicos');
    const mensagemGaleriaVazia = document.getElementById('mensagemGaleriaVazia');

    // Elementos do cabeçalho (para consistência, já que perfil.html tem um header similar ao index.html)
    const userAvatarHeader = document.getElementById('user-avatar-header');
    const userNameHeader = document.getElementById('userName-header');

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
    
    // Elementos de avaliação
    const estrelasAvaliacao = document.querySelectorAll('.estrelas span');
    const notaSelecionadaDisplay = document.getElementById('notaSelecionada');
    const formAvaliacao = document.getElementById('formAvaliacao');
    const comentarioAvaliacaoInput = document.getElementById('comentarioAvaliacaoInput');
    const btnEnviarAvaliacao = document.getElementById('btnEnviarAvaliacao');
    const formAvaliacaoMessage = document.getElementById('form-avaliacao-message');

    // Portfólio de serviços
    const btnAnexarFoto = document.getElementById('btnAnexarFoto');
    const inputFotoServico = document.getElementById('inputFotoServico');


    let currentRating = 0; // Para a avaliação de estrelas
    let userProfileData = null; // Para armazenar os dados do perfil carregados
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('jwtToken');
    const userType = localStorage.getItem('userType'); // Pega o tipo de usuário


    // --- Funções Auxiliares ---

    // Função para exibir mensagens
    function showMessage(message, type, element) {
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

function checkAuthAndRedirect() {
        const token = localStorage.getItem('jwtToken');
        const userId = localStorage.getItem('userId');

        console.log('DEBUG: Dentro de checkAuthAndRedirect - Token:', token);
        console.log('DEBUG: Dentro de checkAuthAndRedirect - UserId:', userId);

        if (!token || !userId) {
            console.error('Token JWT ou User ID não encontrado. Redirecionando para login.');
            alert('Você precisa estar logado para acessar esta página.');
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    // Função para renderizar estrelas
    function renderStars(container, rating) {
        container.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const starClass = i <= rating ? 'fas' : 'far'; // fas para preenchida, far para vazia
            const starElement = document.createElement('i');
            starElement.className = `fa-star ${starClass}`;
            container.appendChild(starElement);
        }
    }

    // Função para atualizar as estrelas clicáveis
    function updateStarRating(rating) {
        currentRating = rating;
        estrelasAvaliacao.forEach(starSpan => {
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

    // Função para carregar informações do usuário
    async function loadUserInfo() {
        const userName = localStorage.getItem('userName');
        const userPhotoUrl = localStorage.getItem('userPhotoUrl');
        const userType = localStorage.getItem('userType');

        console.log('loadUserInfo - UserName:', userName); // Debug
        console.log('loadUserInfo - UserPhotoUrl:', userPhotoUrl); // Debug

        if (userName && userNameHeader) {
            userNameHeader.textContent = userName;
        }
        if (userPhotoUrl && userAvatarHeader) {
            userAvatarHeader.src = userPhotoUrl;
        }
    }

    // Função para carregar dados do perfil do backend
    async function fetchUserProfile() {
        try {
            const response = await fetch(`${API_BASE_URL}/user/${userId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Falha ao carregar perfil.');
            }

            userProfileData = await response.json(); // Armazena os dados do perfil
            console.log('Dados do perfil carregados:', userProfileData);

            // Atualiza os elementos de exibição
            fotoPerfil.src = userProfileData.fotoPerfilUrl || 'https://via.placeholder.com/130?text=Perfil';
            nomePerfil.textContent = userProfileData.nome || 'Nome não definido';
            idadePerfil.textContent = (userProfileData.idade ? `${userProfileData.idade} anos` : 'Não definida');
            cidadePerfil.textContent = userProfileData.cidade || 'Não definida';
            areaPerfil.textContent = userProfileData.atuacao || 'Não definida';
            descricaoPerfil.textContent = userProfileData.descricao || 'Nenhuma descrição fornecida.';
            whatsappPerfil.href = `https://wa.me/${userProfileData.telefone || ''}`;
            whatsappPerfil.textContent = userProfileData.telefone || 'Não fornecido';
            emailPerfil.href = `mailto:${userProfileData.email || ''}`;
            emailPerfil.textContent = userProfileData.email || 'Não fornecido';

            // Renderiza a média de avaliação
            if (userProfileData.mediaAvaliacao !== undefined && userProfileData.mediaAvaliacao !== null) {
                renderStars(mediaEstrelas, userProfileData.mediaAvaliacao);
                totalAvaliacoes.textContent = `(${userProfileData.totalAvaliacoes || 0} avaliações)`;
            } else {
                mediaEstrelas.innerHTML = '<p>Ainda sem avaliações.</p>';
                totalAvaliacoes.textContent = '';
            }

            // Exibe ou oculta a seção de avaliação baseada no tipo de usuário
            if (userType === 'cliente' && userId !== userProfileData._id) { // Cliente vendo perfil de trabalhador
                formAvaliacao.classList.remove('oculto');
                document.querySelector('.avaliacao h3').textContent = 'Avalie este profissional';
            } else if (userType === 'trabalhador' && userId === userProfileData._id) { // Trabalhador vendo seu próprio perfil
                formAvaliacao.classList.add('oculto'); // Esconde o formulário de avaliação do próprio perfil
                document.querySelector('.avaliacao h3').textContent = 'Minhas Avaliações';
            } else { // Cliente vendo seu próprio perfil, ou outro caso
                formAvaliacao.classList.add('oculto');
                document.querySelector('.avaliacao h3').textContent = 'Avaliações';
            }

            // Renderizar galeria de serviços
            renderizarGaleriaServicos(userProfileData.servicosImagens);

        } catch (error) {
            console.error('Erro ao carregar perfil:', error);
            // Redireciona para o feed se o perfil não puder ser carregado (ex: perfil não encontrado ou erro de auth)
            alert('Não foi possível carregar o perfil. Você pode ser redirecionado para o feed.');
            window.location.href = 'index.html';
        }
    }

    // Função para renderizar a galeria de serviços
    function renderizarGaleriaServicos(imagens) {
        galeriaServicos.innerHTML = ''; // Limpa a galeria existente
        if (imagens && imagens.length > 0) {
            mensagemGaleriaVazia.classList.add('oculto');
            imagens.forEach((imageUrl, index) => {
                const wrapper = document.createElement('div');
                wrapper.classList.add('servico-imagem-wrapper');

                const img = document.createElement('img');
                img.src = imageUrl;
                img.alt = `Serviço ${index + 1}`;
                img.classList.add('servico-imagem');

                // Botão de remover (apenas em modo de edição, ou se o usuário for o dono do perfil)
                const btnRemover = document.createElement('button');
                btnRemover.classList.add('btn-remover-foto', 'oculto'); // Oculto por padrão, só aparece em modo de edição
                btnRemover.innerHTML = '<i class="fas fa-times"></i>';
                btnRemover.addEventListener('click', () => removerFotoServico(index)); // Passa o índice para remover

                wrapper.appendChild(img);
                wrapper.appendChild(btnRemover);
                galeriaServicos.appendChild(wrapper);
            });
        } else {
            mensagemGaleriaVazia.classList.remove('oculto');
        }
    }


    // --- Funções de Edição de Perfil ---

    // Função para alternar entre modo de exibição e edição
    function toggleEditMode(enable) {
        const displayElements = [nomePerfil, idadePerfil, cidadePerfil, areaPerfil, descricaoPerfil, whatsappPerfil, emailPerfil];
        const inputElements = [inputNome, inputIdade, inputCidade, inputAtuacao, inputDescricao, inputWhatsapp, inputEmail];

        if (enable) { // Entrar no modo de edição
            // Ocultar elementos de exibição
            displayElements.forEach(el => el.classList.add('oculto'));
            // Mostrar elementos de input
            inputElements.forEach(el => el.classList.remove('oculto'));

            // Preencher inputs com os dados atuais do perfil
            if (userProfileData) {
                inputNome.value = userProfileData.nome || '';
                inputIdade.value = userProfileData.idade || '';
                inputCidade.value = userProfileData.cidade || '';
                inputAtuacao.value = userProfileData.atuacao || '';
                inputDescricao.value = userProfileData.descricao || '';
                inputWhatsapp.value = userProfileData.telefone || '';
                inputEmail.value = userProfileData.email || '';
            }

            // Mostrar input de foto e label
            fotoPerfil.classList.add('oculto');
            inputFotoPerfil.classList.remove('oculto');
            labelInputFotoPerfil.classList.remove('oculto');

            // Trocar botões
            btnEditarPerfil.classList.add('oculto');
            btnSalvarPerfil.classList.remove('oculto');
            btnCancelarEdicao.classList.remove('oculto');

            // Mostrar botões de remover foto de serviço
            document.querySelectorAll('.btn-remover-foto').forEach(btn => btn.classList.remove('oculto'));
            btnAnexarFoto.classList.remove('oculto'); // Mostrar botão de anexar fotos
        } else { // Sair do modo de edição
            // Mostrar elementos de exibição
            displayElements.forEach(el => el.classList.remove('oculto'));
            // Ocultar elementos de input
            inputElements.forEach(el => el.classList.add('oculto'));

            // Esconder input de foto e label, mostrar foto do perfil
            inputFotoPerfil.classList.add('oculto');
            labelInputFotoPerfil.classList.add('oculto');
            fotoPerfil.classList.remove('oculto');

            // Trocar botões
            btnEditarPerfil.classList.remove('oculto');
            btnSalvarPerfil.classList.add('oculto');
            btnCancelarEdicao.classList.add('oculto');

            // Esconder botões de remover foto de serviço
            document.querySelectorAll('.btn-remover-foto').forEach(btn => btn.classList.add('oculto'));
            btnAnexarFoto.classList.add('oculto'); // Esconder botão de anexar fotos
        }
    }

    // Função para salvar as alterações do perfil
    async function saveProfileChanges() {
        const formData = new FormData();
        // Adiciona campos de texto
        formData.append('nome', inputNome.value);
        formData.append('idade', inputIdade.value);
        formData.append('cidade', inputCidade.value);
        formData.append('atuacao', inputAtuacao.value);
        formData.append('descricao', inputDescricao.value);
        formData.append('telefone', inputWhatsapp.value); // Backend espera 'telefone' para WhatsApp
        formData.append('email', inputEmail.value);

        // Adiciona nova foto de perfil, se selecionada
        if (inputFotoPerfil.files && inputFotoPerfil.files[0]) {
            formData.append('fotoPerfil', inputFotoPerfil.files[0]);
        }

        try {
            const response = await fetch(`${API_BASE_URL}/user/${userId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                    // 'Content-Type': 'multipart/form-data' NÃO defina isso, o navegador faz por você com FormData
                },
                body: formData
            });

            const data = await response.json();

            if (response.ok && data.success) {
                alert('Perfil atualizado com sucesso!');
                // Atualiza o localStorage com os novos dados
                localStorage.setItem('userName', data.user.nome);
                localStorage.setItem('userPhotoUrl', data.user.fotoPerfilUrl);
                // Recarrega o perfil para exibir os dados atualizados
                await fetchUserProfile();
                loadUserInfo(); // Atualiza o cabeçalho
                toggleEditMode(false); // Sai do modo de edição
            } else {
                alert(data.message || 'Erro ao salvar alterações no perfil.');
            }
        } catch (error) {
            console.error('Erro ao salvar perfil:', error);
            alert('Erro ao salvar alterações. Tente novamente mais tarde.');
        }
    }

    // Função para adicionar foto de serviço
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
                alert('Foto(s) de serviço adicionada(s) com sucesso!');
                fetchUserProfile(); // Recarrega o perfil para mostrar as novas fotos
            } else {
                alert(data.message || 'Erro ao adicionar foto(s) de serviço.');
            }
        } catch (error) {
            console.error('Erro ao adicionar foto de serviço:', error);
            alert('Erro ao adicionar foto(s) de serviço. Tente novamente mais tarde.');
        }
    }

    // Função para remover foto de serviço
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
                alert('Foto de serviço removida com sucesso!');
                fetchUserProfile(); // Recarrega o perfil para atualizar a galeria
            } else {
                alert(data.message || 'Erro ao remover foto de serviço.');
            }
        } catch (error) {
            console.error('Erro ao remover foto de serviço:', error);
            alert('Erro ao remover foto de serviço. Tente novamente mais tarde.');
        }
    }


    // --- Event Listeners ---

    // Botão de voltar ao feed
    document.getElementById('back-to-feed-button').addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    // Logout
    const logoutButton = document.getElementById('logout-button');
    const logoutConfirmModal = document.getElementById('logout-confirm-modal');
    const confirmLogoutYesBtn = document.getElementById('confirm-logout-yes');
    const confirmLogoutNoBtn = document.getElementById('confirm-logout-no');

    logoutButton.addEventListener('click', () => {
        logoutConfirmModal.classList.remove('hidden');
    });

    confirmLogoutYesBtn.addEventListener('click', () => {
        localStorage.removeItem('jwtToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('userType');
        localStorage.removeItem('userName');
        localStorage.removeItem('userPhotoUrl');
        window.location.href = 'login.html';
    });

    confirmLogoutNoBtn.addEventListener('click', () => {
        logoutConfirmModal.classList.add('hidden');
    });

    // Event listeners para os botões de ação do perfil
    btnEditarPerfil.addEventListener('click', () => toggleEditMode(true));
    btnSalvarPerfil.addEventListener('click', saveProfileChanges);
    btnCancelarEdicao.addEventListener('click', () => {
        toggleEditMode(false);
        // Opcional: recarregar o perfil para descartar quaisquer edições não salvas
        fetchUserProfile();
    });

    // Pré-visualização da imagem de perfil (opcional)
    inputFotoPerfil.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                fotoPerfil.src = e.target.result;
            };
            reader.readAsDataURL(this.files[0]);
        }
    });

    // Lógica de avaliação de estrelas
    estrelasAvaliacao.forEach(starSpan => {
        starSpan.addEventListener('click', function() {
            const rating = parseInt(this.dataset.value);
            updateStarRating(rating);
        });
    });

    // Envio do formulário de avaliação
    if (formAvaliacao) { // Garante que o formulário existe (apenas para trabalhadores)
        formAvaliacao.addEventListener('submit', async function(event) {
            event.preventDefault();

            if (!currentRating || currentRating === 0) {
                showMessage('Por favor, selecione uma nota para a avaliação.', 'error', formAvaliacaoMessage);
                return;
            }

            const comentario = comentarioAvaliacaoInput.value.trim();
            const avaliadorId = localStorage.getItem('userId');
            const trabalhadorId = userProfileData._id; // O ID do perfil que está sendo avaliado

            if (!comentario) {
                showMessage('Por favor, digite um comentário para a avaliação.', 'error', formAvaliacaoMessage);
                return;
            }

            showMessage('Enviando avaliação...', 'info', formAvaliacaoMessage);
            try {
                // A rota de avaliação agora deve receber o ID do trabalhador a ser avaliado
                const response = await fetch(`${API_BASE_URL}/user/${trabalhadorId}/avaliar`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ estrelas: currentRating, comentario: comentario, avaliadorId: avaliadorId }) // Backend espera 'estrelas', 'comentario' e 'avaliadorId'
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
        });
    }

    // Adicionar foto de serviço
    btnAnexarFoto.addEventListener('click', () => {
        inputFotoServico.click(); // Simula o clique no input file
    });

    inputFotoServico.addEventListener('change', adicionarFotoServico);

    // --- Inicialização ---
    // Carrega informações do usuário no header
    loadUserInfo();
    if (checkAuthAndRedirect()) {
        fetchUserProfile(); // Carrega os dados do perfil principal
    }
});