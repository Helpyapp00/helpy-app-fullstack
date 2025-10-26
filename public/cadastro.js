document.addEventListener('DOMContentLoaded', function() {
    const formCadastro = document.getElementById('form-cadastro');
    const fotoInput = document.getElementById('foto'); // O input 'fotoPerfil' no HTML é 'foto'
    const fotoPreview = document.getElementById('foto-preview');
    const fotoPreviewContainer = document.querySelector('.foto-preview-container');
    const atuacaoInput = document.getElementById('atuacao');
    const atuacaoGroup = document.getElementById('atuacao-group');
    const tipoSelect = document.getElementById('tipo');
    const telefoneInput = document.getElementById('telefone');
    const senhaInput = document.getElementById('senha');
    const confirmarSenhaInput = document.getElementById('confirmar-senha');
    const emailInput = document.getElementById('email');
    const formMessage = document.getElementById('form-message');

    // --- Funções de Validação e Feedback ---
    function showMessage(message, type) {
        formMessage.textContent = message;
        formMessage.className = `form-message ${type}`; 
        formMessage.classList.remove('hidden');
        if (type !== 'info') { 
            setTimeout(() => {
                formMessage.classList.add('hidden');
            }, 5000); 
        }
    }

    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(String(email).toLowerCase());
    }

    function validatePassword(password) {
        const re = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
        return re.test(password);
    }

    // --- Lógica da Pré-visualização da Foto ---
    if (fotoInput) {
        fotoInput.addEventListener('change', function(event) {
            const file = event.target.files[0]; 
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    fotoPreview.src = e.target.result;
                    fotoPreviewContainer.classList.add('has-image'); 
                };
                reader.readAsDataURL(file);
            } else {
                fotoPreview.src = '';
                fotoPreviewContainer.classList.remove('has-image'); 
            }
        });
    }

    // --- Lógica do Campo de Atuação Condicional ---
    function toggleAtuacaoField() {
        if (tipoSelect.value === 'trabalhador') {
            atuacaoGroup.style.display = 'flex'; 
            atuacaoInput.setAttribute('required', 'true');
        } else {
            atuacaoGroup.style.display = 'none';
            atuacaoInput.removeAttribute('required');
            atuacaoInput.value = ''; 
        }
    }
    if (tipoSelect) {
        tipoSelect.addEventListener('change', toggleAtuacaoField);
        toggleAtuacaoField(); 
    }

    // --- Lógica de Formatação de Telefone (Máscara Simples) ---
    if (telefoneInput) {
        telefoneInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, ''); 
            let formattedValue = '';
            if (value.length > 0) {
                formattedValue = '(' + value.substring(0, 2);
            }
            if (value.length > 2) {
                const part1Length = (value.length <= 10) ? 4 : 5; 
                formattedValue += ') ' + value.substring(2, 2 + part1Length);
            }
            if (value.length > 6 && value.length <= 11) { 
                formattedValue += '-' + value.substring(2 + (value.length <= 10 ? 4 : 5), 11);
            }
            e.target.value = formattedValue;
        });
    }

    // --- Submissão do Formulário para o Backend ---
    if (formCadastro) {
        formCadastro.addEventListener('submit', async function(event) {
            event.preventDefault(); 

            // 1. Validações client-side
            if (senhaInput.value !== confirmarSenhaInput.value) {
                showMessage('As senhas não coincidem. Por favor, verifique.', 'error');
                confirmarSenhaInput.focus();
                return;
            }
            if (!validatePassword(senhaInput.value)) {
                showMessage('A senha deve ter pelo menos 8 caracteres, incluindo letras e números.', 'error');
                senhaInput.focus();
                return;
            }
            if (!validateEmail(emailInput.value)) {
                showMessage('Por favor, insira um email válido.', 'error');
                emailInput.focus();
                return;
            }
            
            // 🛑 CORREÇÃO: FormData pega o formulário inteiro
            // O input de foto no HTML tem name="fotoPerfil"
            const formData = new FormData(formCadastro);

            // 🛑 CORREÇÃO: A Rota correta no server.js é /api/cadastro
            const backendApiUrl = '/api/cadastro'; 

            showMessage('Enviando dados...', 'info'); 

            try {
                const response = await fetch(backendApiUrl, {
                    method: 'POST',
                    body: formData // Envia como FormData (necessário para arquivos)
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Erro desconhecido no servidor.');
                }

                if (data.success) { 
                    showMessage(data.message || 'Cadastro realizado com sucesso!', 'success');
                    
                    // 🛑 NOVO: Faz o login automático após o cadastro
                    localStorage.setItem('jwtToken', data.token);
                    localStorage.setItem('userId', data.userId);
                    localStorage.setItem('userType', data.userType);
                    localStorage.setItem('userName', data.userName || 'Usuário');
                    localStorage.setItem('userPhotoUrl', data.userPhotoUrl || 'imagens/default-user.png');
                    
                    // Redireciona para o feed
                    window.location.href = 'index.html';

                } else { 
                    showMessage(data.message || 'Houve um erro no cadastro.', 'error');
                }

            } catch (error) {
                console.error('Erro ao enviar o formulário:', error);
                showMessage(`Erro: ${error.message || 'Não foi possível conectar ao servidor.'}`, 'error');
            }
        });
    }
});

