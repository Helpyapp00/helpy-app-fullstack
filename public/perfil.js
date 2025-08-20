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
    
    // Elementos do Modal de Imagem
    const imageModal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const closeImageModalBtn = document.getElementById('close-image-modal');
    
    // Elementos do Modal de Confirmação de Logout
    const logoutButton = document.getElementById('logout-button');
    const logoutConfirmModal = document.getElementById('logout-confirm-modal');
    const confirmLogoutYesBtn = document.getElementById('confirm-logout-yes');
    const confirmLogoutNoBtn = document.getElementById('confirm-logout-no');
    
    // Botão Voltar ao Feed
    const btnVoltarFeed = document.getElementById('back-to-feed-button');

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
    
            // Renderizar portfólio de serviços
            renderPortfolio(user.servicosImagens); // Altere user.servicos para user.servicosImagens
    
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
    
    // Função para renderizar o portfólio
    const renderPortfolio = (servicos) => {
        if (!servicos || servicos.length === 0) {
            mensagemGaleriaVazia.classList.remove('oculto');
            galeriaServicos.innerHTML = '';
        } else {
            mensagemGaleriaVazia.classList.add('oculto');
            
            const htmlContent = servicos.map(servico => {
                const imageUrl = typeof servico === 'string' ? servico : (servico.url || servico.imageUrl || servico.photoUrl || servico);
                const servicoId = typeof servico === 'object' ? servico._id : '';

                const btnRemover = userType === 'trabalhador' ? `<button class="btn-remover-foto" data-id="${servicoId}">&times;</button>` : '';

                return `
                    <div class="servico-item" data-id="${servicoId}">
                        <img src="${imageUrl}" alt="Imagem de Serviço" class="foto-servico">
                        ${btnRemover}
                    </div>
                `;
            }).join('');

            galeriaServicos.innerHTML = htmlContent;

            // Adiciona event listeners para as novas imagens
        document.querySelectorAll('.foto-servico').forEach(img => {
        img.addEventListener('click', async () => {
            const item = img.closest('.servico-item');
            const servicoId = item.dataset.id;

            // Oculta a área de informações por padrão
            const infoArea = document.getElementById('modal-info-area');
            infoArea.style.display = 'none';

            modalImage.src = img.src;
            imageModal.classList.add('visible');

            if (servicoId) {
                try {
                    const response = await fetch(`/api/servico/${servicoId}`);
                    if (response.ok) {
                        const servico = await response.json();
                        document.getElementById('servico-titulo-modal').textContent = servico.titulo || 'Título do Serviço';
                        document.getElementById('servico-descricao-modal').textContent = servico.descricao || 'Detalhes do serviço...';
                        
                        // Adicione a lógica para preencher as avaliações aqui
                        const avaliacoesLista = document.getElementById('avaliacoes-lista');
                        if (servico.avaliacoes && servico.avaliacoes.length > 0) {
                            avaliacoesLista.innerHTML = servico.avaliacoes.map(avaliacao => `
                                <div class="avaliacao-item">
                                    <p class="avaliacao-comentario">${avaliacao.comentario}</p>
                                    <div class="estrelas-avaliacao-item">
                                        ${'<i class="fas fa-star"></i>'.repeat(avaliacao.estrelas)}
                                        ${'<i class="far fa-star"></i>'.repeat(5 - avaliacao.estrelas)}
                                    </div>
                                </div>
                            `).join('');
                        } else {
                            avaliacoesLista.innerHTML = '<p class="mensagem-vazia">Nenhuma avaliação ainda.</p>';
                        }
                        infoArea.style.display = 'block'; // Mostra a área de informações
                    }
                } catch (error) {
                    console.error('Erro ao buscar detalhes do serviço:', error);
                }
            }
        });
    });
            
            document.querySelectorAll('.btn-remover-foto').forEach(btn => {
                btn.addEventListener('click', async (event) => {
                    const item = event.target.closest('.servico-item');
                    const servicoId = item.dataset.id;
                    if (confirm('Tem certeza que deseja remover este serviço?')) {
                        try {
                            const response = await fetch(`/api/user/${userId}/servicos/${servicoId}`, {
                                method: 'DELETE',
                                headers: {
                                    'Authorization': `Bearer ${token}`
                                }
                            });
                            if (!response.ok) {
                                const errorData = await response.json();
                                throw new Error(errorData.message || 'Falha ao remover o serviço.');
                            }
                            alert('Serviço removido com sucesso!');
                            fetchUserProfile();
                        } catch (error) {
                            console.error('Erro ao remover serviço:', error);
                            alert('Erro ao remover o serviço: ' + error.message);
                        }
                    }
                });
            });
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
    
    // Event Listeners
    btnEditarPerfil.addEventListener('click', () => {
        nomePerfil.classList.add('oculto');
        idadePerfil.classList.add('oculto');
        cidadePerfil.classList.add('oculto');
        areaPerfil.classList.add('oculto');
        descricaoPerfil.classList.add('oculto');
        whatsappPerfil.classList.add('oculto');
        emailPerfil.classList.add('oculto');
        btnEditarPerfil.classList.add('oculto');
    
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
        nomePerfil.classList.remove('oculto');
        idadePerfil.classList.remove('oculto');
        cidadePerfil.classList.remove('oculto');
        areaPerfil.classList.remove('oculto');
        descricaoPerfil.classList.remove('oculto');
        whatsappPerfil.classList.remove('oculto');
        emailPerfil.classList.remove('oculto');
        btnEditarPerfil.classList.remove('oculto');
    
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
            formData.append('servicos', file);
        }
    
        try {
            const response = await fetch(`/api/user/${userId}/servicos`, {
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
    if (fotoPerfil) {
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
    
    fetchUserProfile();
    loadUserInfo();
});