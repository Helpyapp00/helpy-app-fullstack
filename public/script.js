document.addEventListener('DOMContentLoaded', () => {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('jwtToken');
    const userType = localStorage.getItem('userType');
    
    // Elementos do DOM
    const perfilBox = document.querySelector('.perfil-box');
    const fotoPerfil = document.getElementById('fotoPerfil');
    const nomePerfil = document.getElementById('nomePerfil');
    const idadePerfil = document.getElementById('idadePerfil');
    const cidadePerfil = document.getElementById('cidadePerfil');
    const areaPerfil = document.getElementById('areaPerfil');
    const descricaoPerfil = document.getElementById('descricaoPerfil');
    const whatsappPerfil = document.getElementById('whatsappPerfil');
    const emailPerfil = document.getElementById('emailPerfil');
    const galeriaServicos = document.getElementById('galeriaServicos');
    const mensagemGaleriaVazia = document.getElementById('mensagemGaleriaVazia');
    
    const btnEditarPerfil = document.getElementById('btnEditarPerfil');
    const btnSalvarPerfil = document.getElementById('btnSalvarPerfil');
    const btnCancelarEdicao = document.getElementById('btnCancelarEdicao');
    const labelInputFotoPerfil = document.getElementById('labelInputFotoPerfil');
    const inputFotoPerfil = document.getElementById('inputFotoPerfil');
    const inputNome = document.getElementById('inputNome');
    const inputIdade = document.getElementById('inputIdade');
    const inputCidade = document.getElementById('inputCidade');
    const inputArea = document.getElementById('inputArea');
    const inputDescricao = document.getElementById('inputDescricao');
    const inputTelefone = document.getElementById('inputTelefone');
    
    const imageModal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const closeImageModalBtn = document.getElementById('close-image-modal');
    
    const btnVoltarFeed = document.getElementById('btnVoltarFeed');
    const logoutButton = document.getElementById('logout-button');
    const logoutConfirmModal = document.getElementById('logout-confirm-modal');
    const confirmLogoutYesBtn = document.getElementById('confirm-logout-yes');
    const confirmLogoutNoBtn = document.getElementById('confirm-logout-no');

    // Funções de feedback
    function showMessage(message, type) {
        const messageElement = document.getElementById('perfil-message');
        if (messageElement) {
            messageElement.textContent = message;
            messageElement.className = `form-message ${type}`;
            messageElement.classList.remove('hidden');
            setTimeout(() => {
                messageElement.classList.add('hidden');
            }, 5000);
        }
    }
    
    // Funções de carregamento de dados
    async function fetchPerfil(id, token) {
        if (!id || !token) {
            showMessage('Para ver este perfil, você precisa estar logado.', 'info');
            return;
        }

        try {
            const response = await fetch(`/api/user/${id}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erro ao buscar dados do perfil.');
            }

            const userData = await response.json();
            renderPerfil(userData.user);
        } catch (error) {
            console.error('Erro ao buscar perfil:', error);
            showMessage(`Erro: ${error.message || 'Não foi possível carregar o perfil.'}`, 'error');
            // Redireciona para o login se o token for inválido
            if (error.message.includes('Token')) {
                localStorage.clear();
                window.location.href = 'login.html';
            }
        }
    }

    async function fetchServicos(id) {
        try {
            const response = await fetch(`/api/servicos/${id}`);
            if (!response.ok) {
                throw new Error('Falha ao buscar os serviços.');
            }
            const servicos = await response.json();
            renderServicos(servicos.servicos);
        } catch (error) {
            console.error('Erro ao buscar serviços:', error);
            // Mensagem de erro não crítica
        }
    }

    // Funções de Renderização
    function renderPerfil(user) {
        if (!user) {
            perfilBox.innerHTML = '<p class="text-center text-gray-500 mt-8">Nenhum perfil encontrado.</p>';
            return;
        }

        // Preenche os campos de visualização
        fotoPerfil.src = user.foto || 'https://via.placeholder.com/150?text=User';
        nomePerfil.textContent = user.nome;
        idadePerfil.textContent = `Idade: ${user.idade || 'Não informado'}`;
        cidadePerfil.textContent = `Cidade: ${user.cidade || 'Não informado'}`;
        descricaoPerfil.textContent = user.descricao || 'Nenhuma descrição disponível.';

        if (user.tipo === 'trabalhador') {
            areaPerfil.textContent = `Área de Atuação: ${user.atuacao || 'Não informada'}`;
            areaPerfil.style.display = 'block';
            if (btnEditarPerfil) {
                btnEditarPerfil.style.display = 'block';
            }
        } else {
            areaPerfil.style.display = 'none';
        }

        whatsappPerfil.textContent = `Telefone: ${user.telefone || 'Não informado'}`;
        emailPerfil.textContent = `Email: ${user.email || 'Não informado'}`;
    }

    function renderServicos(servicos) {
        galeriaServicos.innerHTML = '';
        if (servicos.length === 0) {
            mensagemGaleriaVazia.style.display = 'block';
            return;
        } else {
            mensagemGaleriaVazia.style.display = 'none';
        }

        servicos.forEach(servico => {
            const card = document.createElement('div');
            card.className = 'servico-card bg-gray-100 p-4 rounded-lg shadow-md';
            card.innerHTML = `
                <img src="${servico.imagem || 'https://via.placeholder.com/300?text=Serviço'}" alt="${servico.titulo}" class="w-full h-auto rounded-lg mb-2 object-cover">
                <h4 class="font-bold text-lg mb-1">${servico.titulo}</h4>
                <p class="text-sm text-gray-700">${servico.descricao}</p>
            `;
            galeriaServicos.appendChild(card);
        });
    }

    // Lógica para o Modal da Imagem
    if (fotoPerfil && imageModal && modalImage) {
        fotoPerfil.style.cursor = 'pointer';
        fotoPerfil.addEventListener('click', () => {
            if (fotoPerfil.src && imageModal && modalImage) {
                modalImage.src = fotoPerfil.src;
                imageModal.classList.add('visible');
            }
        });
    }
    
    if (closeImageModalBtn) {
        closeImageModalBtn.addEventListener('click', () => {
            imageModal.classList.remove('visible');
        });
    }
    
    if (imageModal) {
        imageModal.addEventListener('click', (e) => {
            if (e.target.id === 'image-modal') {
                imageModal.classList.remove('visible');
            }
        });
    }

    // Lógica para o botão Voltar ao Feed
    if (btnVoltarFeed) {
        btnVoltarFeed.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    // Lógica para o botão de Logout
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            logoutConfirmModal.classList.add('visible');
        });
    }
    
    if (confirmLogoutYesBtn) {
        confirmLogoutYesBtn.addEventListener('click', () => {
            localStorage.clear();
            window.location.href = 'index.html';
        });
    }
    
    if (confirmLogoutNoBtn) {
        confirmLogoutNoBtn.addEventListener('click', () => {
            logoutConfirmModal.classList.remove('visible');
        });
    }
    
    // Lógica de edição
    const toggleEditMode = (isEditing) => {
        const elements = [
            nomePerfil, idadePerfil, cidadePerfil, areaPerfil, descricaoPerfil,
            whatsappPerfil, emailPerfil
        ];
        elements.forEach(el => el.classList.toggle('hidden', isEditing));

        const inputElements = [
            inputNome, inputIdade, inputCidade, inputArea, inputDescricao,
            inputTelefone
        ];
        inputElements.forEach(el => el.classList.toggle('hidden', !isEditing));
        
        // A foto de perfil também
        fotoPerfil.classList.toggle('hidden', isEditing);
        labelInputFotoPerfil.classList.toggle('hidden', !isEditing);

        btnEditarPerfil.classList.toggle('hidden', isEditing);
        btnSalvarPerfil.classList.toggle('hidden', !isEditing);
        btnCancelarEdicao.classList.toggle('hidden', !isEditing);
    };

    if (btnEditarPerfil) {
        btnEditarPerfil.addEventListener('click', () => {
            toggleEditMode(true);
            // Preenche os campos de input com os valores atuais
            inputNome.value = nomePerfil.textContent.trim();
            inputIdade.value = idadePerfil.textContent.replace('Idade: ', '').trim();
            inputCidade.value = cidadePerfil.textContent.replace('Cidade: ', '').trim();
            inputArea.value = areaPerfil.textContent.replace('Área de Atuação: ', '').trim();
            inputDescricao.value = descricaoPerfil.textContent.trim();
            inputTelefone.value = whatsappPerfil.textContent.replace('Telefone: ', '').trim();
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
            formData.append('descricao', inputDescricao.value);
            formData.append('telefone', inputTelefone.value);

            // Adiciona a área de atuação apenas se for trabalhador
            if (userType === 'trabalhador') {
                formData.append('atuacao', inputArea.value);
            }

            // Adiciona a foto se uma nova for selecionada
            if (inputFotoPerfil.files && inputFotoPerfil.files[0]) {
                formData.append('foto', inputFotoPerfil.files[0]);
            }
            
            try {
                const response = await fetch(`/api/user/${userId}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData,
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Falha ao atualizar o perfil.');
                }
                
                const data = await response.json();
                showMessage('Perfil atualizado com sucesso!', 'success');
                // Atualiza o localStorage com o novo nome e URL da foto
                localStorage.setItem('userName', data.user.nome);
                if (data.user.foto) {
                    localStorage.setItem('userPhotoUrl', data.user.foto);
                }
                toggleEditMode(false);
                fetchPerfil(userId, token); // Recarrega os dados do perfil
            } catch (error) {
                console.error('Erro ao salvar o perfil:', error);
                showMessage(`Erro: ${error.message}`, 'error');
            }
        });
    }

    // Carregamento inicial
    if (userId && token) {
        fetchPerfil(userId, token);
        fetchServicos(userId);
    } else {
        // Redireciona para o login se não houver token
        window.location.href = 'login.html';
    }
});