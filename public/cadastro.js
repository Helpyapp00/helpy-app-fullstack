document.addEventListener('DOMContentLoaded', function() {
    // Elementos das etapas
    const etapaVerificacaoEmail = document.getElementById('etapa-verificacao-email');
    const etapaValidarCodigo = document.getElementById('etapa-validar-codigo');
    const formCadastro = document.getElementById('form-cadastro');
    
    // Elementos da etapa 1 - Verificação de Email
    const emailVerificacaoInput = document.getElementById('email-verificacao');
    const btnSolicitarCodigo = document.getElementById('btn-solicitar-codigo');
    
    // Elementos da etapa 2 - Validar Código
    const codigoVerificacaoInput = document.getElementById('codigo-verificacao');
    const btnValidarCodigo = document.getElementById('btn-validar-codigo');
    const btnVoltarEmail = document.getElementById('btn-voltar-email');
    const linkReenviarCodigo = document.getElementById('link-reenviar-codigo');
    const emailExibido = document.getElementById('email-exibido');
    
    // Variável para armazenar o email verificado
    let emailVerificado = null;
    
    // Elementos do formulário de cadastro
    const nomeInput = document.getElementById('nome');
    const fotoInput = document.getElementById('foto');
    const fotoPreview = document.getElementById('foto-preview');
    const fotoPreviewContainer = document.querySelector('.foto-preview-container');
    const idadeInput = document.getElementById('idade');
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

    // --- Função para mostrar etapa ---
    function mostrarEtapa(etapa) {
        etapaVerificacaoEmail.style.display = 'none';
        etapaValidarCodigo.style.display = 'none';
        formCadastro.style.display = 'none';
        
        if (etapa === 'email') {
            etapaVerificacaoEmail.style.display = 'block';
        } else if (etapa === 'codigo') {
            etapaValidarCodigo.style.display = 'block';
        } else if (etapa === 'cadastro') {
            formCadastro.style.display = 'block';
        }
    }

    // --- Etapa 1: Solicitar Código de Verificação ---
    btnSolicitarCodigo.addEventListener('click', async function() {
        const email = emailVerificacaoInput.value.trim();
        
        if (!email) {
            showMessage('Por favor, informe seu email.', 'error');
            return;
        }

        if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            showMessage('Por favor, informe um email válido.', 'error');
            return;
        }

        showMessage('Enviando código de verificação...', 'info');
        btnSolicitarCodigo.disabled = true;
        btnSolicitarCodigo.textContent = 'Enviando...';

        try {
            const response = await fetch('/api/verificar-email/solicitar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                emailVerificado = data.email;
                emailExibido.textContent = emailVerificado;
                mostrarEtapa('codigo');
                showMessage('Código enviado! Verifique sua caixa de entrada.', 'success');
                codigoVerificacaoInput.focus();
            } else {
                throw new Error(data.message || 'Erro ao enviar código de verificação.');
            }
        } catch (error) {
            console.error('Erro ao solicitar código:', error);
            showMessage(`Erro: ${error.message}`, 'error');
        } finally {
            btnSolicitarCodigo.disabled = false;
            btnSolicitarCodigo.textContent = 'Enviar Código de Verificação';
        }
    });

    // --- Etapa 2: Validar Código ---
    btnValidarCodigo.addEventListener('click', async function() {
        const codigo = codigoVerificacaoInput.value.trim();
        
        if (!codigo || codigo.length !== 6) {
            showMessage('Por favor, informe o código de 6 dígitos.', 'error');
            return;
        }

        if (!emailVerificado) {
            showMessage('Erro: Email não encontrado. Por favor, comece novamente.', 'error');
            mostrarEtapa('email');
            return;
        }

        showMessage('Validando código...', 'info');
        btnValidarCodigo.disabled = true;
        btnValidarCodigo.textContent = 'Validando...';

        try {
            const response = await fetch('/api/verificar-email/validar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    email: emailVerificado,
                    codigo: codigo 
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Email verificado com sucesso! Mostra formulário de cadastro
                emailInput.value = emailVerificado;
                mostrarEtapa('cadastro');
                showMessage('Email verificado com sucesso! Complete seus dados.', 'success');
            } else {
                throw new Error(data.message || 'Código inválido.');
            }
        } catch (error) {
            console.error('Erro ao validar código:', error);
            showMessage(`Erro: ${error.message}`, 'error');
        } finally {
            btnValidarCodigo.disabled = false;
            btnValidarCodigo.textContent = 'Validar Código';
        }
    });

    // --- Voltar para etapa de email ---
    btnVoltarEmail.addEventListener('click', function() {
        mostrarEtapa('email');
        codigoVerificacaoInput.value = '';
    });

    // --- Reenviar código ---
    linkReenviarCodigo.addEventListener('click', async function(e) {
        e.preventDefault();
        if (emailVerificado) {
            btnSolicitarCodigo.click();
        }
    });

    // --- Formatação do código (apenas números) ---
    codigoVerificacaoInput.addEventListener('input', function(e) {
        e.target.value = e.target.value.replace(/\D/g, '').substring(0, 6);
    });

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

    // --- Submissão do Formulário de Cadastro ---
    formCadastro.addEventListener('submit', async function(event) {
        event.preventDefault(); 

        if (senhaInput.value !== confirmarSenhaInput.value) {
            showMessage('As senhas não coincidem.', 'error');
            return;
        }

        if (!emailVerificado) {
            showMessage('Erro: Email não verificado. Por favor, comece novamente.', 'error');
            mostrarEtapa('email');
            return;
        }

        showMessage('Enviando dados...', 'info'); 

        const formData = new FormData(formCadastro);
        formData.append('email', emailVerificado); // Garante que o email correto seja enviado

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
