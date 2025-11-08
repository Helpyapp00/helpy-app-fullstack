document.addEventListener('DOMContentLoaded', function() {
    const formCadastro = document.getElementById('form-cadastro');
    const nomeInput = document.getElementById('nome');
    const fotoInput = document.getElementById('foto');
    const fotoPreview = document.getElementById('foto-preview');
    const fotoPreviewContainer = document.querySelector('.foto-preview-container');
    const idadeInput = document.getElementById('idade');
    
    // 🛑 ATUALIZAÇÃO: Seletores de localização
    const cidadeInput = document.getElementById('cidade');
    const estadoInput = document.getElementById('estado'); 
    
    const atuacaoInput = document.getElementById('atuacao');
    const atuacaoGroup = document.getElementById('atuacao-group');
    const tipoSelect = document.getElementById('tipo');
    const descricaoTextarea = document.getElementById('descricao');
    const telefoneInput = document.getElementById('telefone');
    const emailInput = document.getElementById('email');
    const senhaInput = document.getElementById('senha');
    const confirmarSenhaInput = document.getElementById('confirmar-senha');
    const formMessage = document.getElementById('form-message');

    // --- Funções de Feedback ---
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

    // --- Lógica da Pré-visualização da Foto ---
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
            fotoPreview.src = 'imagens/default-user.png';
            fotoPreviewContainer.classList.remove('has-image');
        }
    });

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
    tipoSelect.addEventListener('change', toggleAtuacaoField);
    toggleAtuacaoField(); 

    // --- Lógica de Formatação de Telefone ---
    telefoneInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, ''); 
        value = value.substring(0, 11); 
        let formattedValue = '';
        if (value.length > 0) {
            formattedValue = '(' + value.substring(0, 2);
        }
        if (value.length > 2) {
            const part1Length = (value.length <= 10) ? 4 : 5; 
            formattedValue += ') ' + value.substring(2, 2 + part1Length);
        }
        if (value.length > 6) { 
            formattedValue += '-' + value.substring(2 + (value.length <= 10 ? 4 : 5));
        }
        e.target.value = formattedValue;
    });

    // --- Submissão do Formulário ---
    formCadastro.addEventListener('submit', async function(event) {
        event.preventDefault(); 

        if (senhaInput.value !== confirmarSenhaInput.value) {
            showMessage('As senhas não coincidem.', 'error');
            return;
        }

        showMessage('Enviando dados...', 'info'); 

        // 🛑 ATUALIZAÇÃO: O FormData agora pega 'cidade' e 'estado'
        const formData = new FormData(formCadastro);

        try {
            const response = await fetch('/api/cadastro', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok && data.success) {
                showMessage(data.message || 'Cadastro realizado com sucesso! Redirecionando...', 'success');
                // Loga o usuário e redireciona
                localStorage.setItem('jwtToken', data.token);
                localStorage.setItem('userId', data.userId);
                localStorage.setItem('userType', data.userType);
                localStorage.setItem('userName', data.userName);
                localStorage.setItem('userPhotoUrl', data.userPhotoUrl);
                
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);

            } else {
                throw new Error(data.message || 'Houve um erro no cadastro.');
            }

        } catch (error) {
            console.error('Erro ao enviar o formulário:', error);
            showMessage(`Erro: ${error.message}`, 'error');
        }
    });
});

