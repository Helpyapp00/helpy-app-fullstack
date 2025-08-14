document.addEventListener('DOMContentLoaded', () => {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('jwtToken');
    const userType = localStorage.getItem('userType');

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
    const inputAtuacao = document.getElementById('inputAtuacao');
    const inputDescricao = document.getElementById('inputDescricao');
    const inputWhatsapp = document.getElementById('inputWhatsapp');
    const inputEmail = document.getElementById('inputEmail');
    const btnAnexarFoto = document.getElementById('btnAnexarFoto');
    const inputFotoServico = document.getElementById('inputFotoServico');

    const formAvaliacao = document.getElementById('formAvaliacao');
    const estrelasAvaliacao = document.querySelectorAll('.estrelas span');
    const notaSelecionada = document.getElementById('notaSelecionada');
    const comentarioAvaliacaoInput = document.getElementById('comentarioAvaliacaoInput');
    const btnEnviarAvaliacao = document.getElementById('btnEnviarAvaliacao');
    const mediaEstrelasDiv = document.getElementById('mediaEstrelas');
    const totalAvaliacoesP = document.getElementById('totalAvaliacoes');

    const userAvatarHeader = document.getElementById('user-avatar-header');
    const userNameHeader = document.getElementById('user-name-header');

    // Elementos do novo Modal de Imagem
    const imageModal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const closeImageModalBtn = document.getElementById('close-image-modal');


    // Função para carregar a info do usuário no header
    const loadUserInfo = () => {
        const storedName = localStorage.getItem('userName');
        const storedPhotoUrl = localStorage.getItem('userPhotoUrl');
        if (storedName) {
            userNameHeader.textContent = storedName;
        }
        if (storedPhotoUrl && storedPhotoUrl !== 'undefined') {
            userAvatarHeader.src = storedPhotoUrl;
        } else {
            userAvatarHeader.src = 'imagens/default-user.png';
        }
    };


    const fetchUserProfile = async () => {
        if (!userId || !token) {
            alert('Você precisa estar logado para acessar esta página.');
            window.location.href = 'index.html';
            return;
        }
        try {
            const response = await fetch(`/api/user/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                if (response.status === 403) {
                    alert('Acesso não autorizado ao perfil. Redirecionando para o login.');
                    localStorage.clear();
                    window.location.href = 'index.html';
                    return;
                }
                throw new Error('Falha ao buscar dados do perfil.');
            }

            const { user } = await response.json();
            if (user.tipo === 'cliente') {
                perfilBox.classList.add('perfil-cliente');
                btnAnexarFoto.style.display = 'none';
                document.querySelector('.portfolio-servicos').style.display = 'none';
                formAvaliacao.classList.remove('oculto');
            } else {
                perfilBox.classList.add('perfil-trabalhador');
                btnAnexarFoto.style.display = 'inline-flex';
            }

            if (fotoPerfil) {
                if (user.avatarUrl) {
                    fotoPerfil.src = user.avatarUrl;
                } else {
                    fotoPerfil.src = 'imagens/default-profile.png';
                }
            }
            if (userAvatarHeader) {
                if (user.avatarUrl) {
                    userAvatarHeader.src = user.avatarUrl;
                } else {
                    userAvatarHeader.src = 'imagens/default-user.png';
                }
            }

            nomePerfil.textContent = user.nome || 'Nome não informado';
            idadePerfil.textContent = user.idade ? `${user.idade} anos` : 'Não informado';
            cidadePerfil.textContent = user.cidade || 'Não informado';
            areaPerfil.textContent = user.atuacao || 'Não informado';
            descricaoPerfil.textContent = user.descricao || 'Nenhuma descrição disponível.';

            if (user.telefone) {
                whatsappPerfil.href = `https://wa.me/55${user.telefone.replace(/\D/g, '')}`;
                whatsappPerfil.innerHTML = `<i class="fab fa-whatsapp"></i> ${user.telefone}`;
            } else {
                whatsappPerfil.textContent = 'Não informado';
                whatsappPerfil.href = '#';
            }
            emailPerfil.innerHTML = `<i class="fas fa-envelope"></i> ${user.email || 'Não informado'}`;
            emailPerfil.href = `mailto:${user.email}`;

            inputNome.value = user.nome || '';
            inputIdade.value = user.idade || '';
            inputCidade.value = user.cidade || '';
            inputAtuacao.value = user.atuacao || '';
            inputDescricao.value = user.descricao || '';
            inputWhatsapp.value = user.telefone || '';
            inputEmail.value = user.email || '';

            // Carregar imagens do portfólio
            if (user.servicosImagens && user.servicosImagens.length > 0) {
                mensagemGaleriaVazia.classList.add('oculto');
                galeriaServicos.innerHTML = user.servicosImagens.map((url, index) => `
                    <div class="servico-imagem-wrapper">
                        <img src="${url}" alt="Imagem de Serviço ${index + 1}" class="servico-imagem" data-index="${index}">
                        <button class="btn-remover-foto" data-index="${index}">&times;</button>
                    </div>
                `).join('');
            } else {
                mensagemGaleriaVazia.classList.remove('oculto');
            }

            // Carregar média de avaliação
            if (user.totalAvaliacoes > 0) {
                renderMediaAvaliacao(user.mediaAvaliacao);
                totalAvaliacoesP.textContent = `${user.totalAvaliacoes} avaliações`;
            } else {
                mediaEstrelasDiv.innerHTML = '<p class="mensagem-vazia">Nenhuma avaliação ainda.</p>';
                totalAvaliacoesP.textContent = '';
            }

            // Salvar a URL correta no localStorage para que o header também funcione
            localStorage.setItem('userName', user.nome || '');
            localStorage.setItem('userPhotoUrl', user.avatarUrl || '');
            loadUserInfo();

        } catch (error) {
            console.error('Erro ao buscar perfil:', error);
            alert('Erro ao carregar os dados do perfil.');
            localStorage.clear();
            window.location.href = 'index.html';
        }
    };

    // Função para renderizar as estrelas da média de avaliação
    const renderMediaAvaliacao = (media) => {
        mediaEstrelasDiv.innerHTML = '';
        const estrelasCheias = Math.floor(media);
        const temMeiaEstrela = media % 1 !== 0;

        for (let i = 0; i < estrelasCheias; i++) {
            mediaEstrelasDiv.innerHTML += '<i class="fas fa-star"></i>';
        }
        if (temMeiaEstrela) {
            mediaEstrelasDiv.innerHTML += '<i class="fas fa-star-half-alt"></i>';
        }
        const estrelasVazias = 5 - estrelasCheias - (temMeiaEstrela ? 1 : 0);
        for (let i = 0; i < estrelasVazias; i++) {
            mediaEstrelasDiv.innerHTML += '<i class="far fa-star"></i>';
        }
    };


    btnEditarPerfil.addEventListener('click', () => {
        // Esconder elementos de visualização
        nomePerfil.classList.add('oculto');
        idadePerfil.classList.add('oculto');
        cidadePerfil.classList.add('oculto');
        areaPerfil.classList.add('oculto');
        descricaoPerfil.classList.add('oculto');
        whatsappPerfil.classList.add('oculto');
        emailPerfil.classList.add('oculto');
        btnEditarPerfil.classList.add('oculto');

        // Mostrar elementos de edição
        inputNome.classList.remove('oculto');
        inputIdade.classList.remove('oculto');
        inputCidade.classList.remove('oculto');
        inputAtuacao.classList.remove('oculto');
        inputDescricao.classList.remove('oculto');
        inputWhatsapp.classList.remove('oculto');
        inputEmail.classList.remove('oculto');
        btnSalvarPerfil.classList.remove('oculto');
        btnCancelarEdicao.classList.remove('oculto');
        labelInputFotoPerfil.classList.remove('oculto');
    });

    btnCancelarEdicao.addEventListener('click', () => {
        // Mostrar elementos de visualização
        nomePerfil.classList.remove('oculto');
        idadePerfil.classList.remove('oculto');
        cidadePerfil.classList.remove('oculto');
        areaPerfil.classList.remove('oculto');
        descricaoPerfil.classList.remove('oculto');
        whatsappPerfil.classList.remove('oculto');
        emailPerfil.classList.remove('oculto');
        btnEditarPerfil.classList.remove('oculto');

        // Esconder elementos de edição
        inputNome.classList.add('oculto');
        inputIdade.classList.add('oculto');
        inputCidade.classList.add('oculto');
        inputAtuacao.classList.add('oculto');
        inputDescricao.classList.add('oculto');
        inputWhatsapp.classList.add('oculto');
        inputEmail.classList.add('oculto');
        btnSalvarPerfil.classList.add('oculto');
        btnCancelarEdicao.classList.add('oculto');
        labelInputFotoPerfil.classList.add('oculto');
    });

    btnSalvarPerfil.addEventListener('click', async () => {
        const formData = new FormData();
        formData.append('nome', inputNome.value);
        formData.append('idade', inputIdade.value);
        formData.append('cidade', inputCidade.value);
        formData.append('atuacao', inputAtuacao.value);
        formData.append('descricao', inputDescricao.value);
        formData.append('telefone', inputWhatsapp.value);
        formData.append('email', inputEmail.value);
        if (inputFotoPerfil.files[0]) {
            formData.append('avatar', inputFotoPerfil.files[0]);
        }

        try {
            const response = await fetch(`/api/user/${userId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Falha ao salvar as alterações do perfil.');
            }

            const data = await response.json();
            alert(data.message);

            if (data.user) {
                localStorage.setItem('userName', data.user.nome || '');
                localStorage.setItem('userPhotoUrl', data.user.avatarUrl || '');
            }

            btnCancelarEdicao.click();
            fetchUserProfile();
        } catch (error) {
            console.error('Erro ao salvar perfil:', error);
            alert('Erro ao salvar as alterações do perfil: ' + error.message);
        }
    });

    btnAnexarFoto.addEventListener('click', () => {
        inputFotoServico.click();
    });

    inputFotoServico.addEventListener('change', async (event) => {
        const files = event.target.files;
        if (files.length === 0) return;

        const formData = new FormData();
        for (const file of files) {
            formData.append('servicoImagens', file);
        }

        try {
            const response = await fetch(`/api/user/${userId}/servicos-imagens`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Falha ao fazer upload das fotos de serviço.');
            }

            const data = await response.json();
            alert('Fotos de serviço adicionadas com sucesso!');
            fetchUserProfile();
        } catch (error) {
            console.error('Erro ao fazer upload de fotos de serviço:', error);
            alert('Erro ao fazer upload de fotos de serviço: ' + error.message);
        }
    });


    // Lógica para remoção de fotos de serviço
    galeriaServicos.addEventListener('click', async (event) => {
        if (event.target.classList.contains('btn-remover-foto')) {
            const imageIndex = event.target.dataset.index;
            if (confirm('Tem certeza que deseja remover esta foto?')) {
                try {
                    const response = await fetch(`/api/user/${userId}/servicos-imagens/${imageIndex}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Falha ao remover a foto.');
                    }

                    alert('Foto removida com sucesso!');
                    fetchUserProfile();
                } catch (error) {
                    console.error('Erro ao remover foto:', error);
                    alert('Erro ao remover a foto: ' + error.message);
                }
            }
        }
    });


    // Lógica para avaliação com estrelas
    estrelasAvaliacao.forEach(star => {
        star.addEventListener('click', () => {
            const value = star.dataset.value;
            estrelasAvaliacao.forEach(s => {
                if (parseInt(s.dataset.value) <= parseInt(value)) {
                    s.innerHTML = '<i class="fas fa-star"></i>';
                } else {
                    s.innerHTML = '<i class="far fa-star"></i>';
                }
            });
            notaSelecionada.textContent = `Você selecionou ${value} estrela${value > 1 ? 's' : ''}.`;
            comentarioAvaliacaoInput.focus();
        });
    });

    btnEnviarAvaliacao.addEventListener('click', async (e) => {
        e.preventDefault();
        const estrelas = document.querySelectorAll('.estrelas span i.fas').length;
        const comentario = comentarioAvaliacaoInput.value;

        if (estrelas === 0) {
            alert('Por favor, selecione pelo menos uma estrela para avaliar.');
            return;
        }

        try {
            const response = await fetch(`/api/user/${userId}/avaliar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ estrelas, comentario })
            });

            const data = await response.json();
            if (response.ok) {
                alert(data.message);
                formAvaliacao.reset();
                notaSelecionada.textContent = '';
                estrelasAvaliacao.forEach(star => star.innerHTML = '<i class="far fa-star"></i>');
                fetchUserProfile();
            } else {
                alert(data.message || 'Erro ao enviar avaliação.');
            }
        } catch (error) {
            console.error('Erro ao enviar avaliação:', error);
            alert('Erro interno do servidor ao enviar avaliação.');
        }
    });

    
    // Lógica do Modal de visualização de Imagem
    fotoPerfil.addEventListener('click', () => {
        modalImage.src = fotoPerfil.src;
        imageModal.classList.add('visible');
    });

    closeImageModalBtn.addEventListener('click', () => {
        imageModal.classList.remove('visible');
    });

    // Opcional: Fechar o modal ao clicar fora da imagem
    imageModal.addEventListener('click', (e) => {
        if (e.target.id === 'image-modal') {
            imageModal.classList.remove('visible');
        }
    });

    fetchUserProfile();
    loadUserInfo();
});