document.addEventListener('DOMContentLoaded', function() {
    const formCadastro = document.getElementById('form-cadastro');
    const nomeInput = document.getElementById('nome');
    const fotoInput = document.getElementById('foto');
    const fotoPreview = document.getElementById('foto-preview');
    const fotoPreviewContainer = document.querySelector('.foto-preview-container');
    const idadeInput = document.getElementById('idade');
    const cidadeInput = document.getElementById('cidade');
    const atuacaoInput = document.getElementById('atuacao');
    const atuacaoGroup = document.getElementById('atuacao-group');
    const tipoSelect = document.getElementById('tipo');
    const descricaoTextarea = document.getElementById('descricao');
    const telefoneInput = document.getElementById('telefone');
    const emailInput = document.getElementById('email');
    const senhaInput = document.getElementById('senha');
    const confirmarSenhaInput = document.getElementById('confirmar-senha');
    const formMessage = document.getElementById('form-message');

    // --- Funções de Validação e Feedback ---
    function showMessage(message, type) {
        formMessage.textContent = message;
        // Use a classe 'form-message' do CSS base e adicione 'success', 'error' ou 'info'
        formMessage.className = `form-message ${type}`; 
        formMessage.classList.remove('hidden');
        // A mensagem de "info" (enviando) não deve desaparecer sozinha
        if (type !== 'info') { 
            setTimeout(() => {
                formMessage.classList.add('hidden');
            }, 5000); // Esconde a mensagem após 5 segundos
        }
    }

    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(String(email).toLowerCase());
    }

    function validatePassword(password) {
        // Pelo menos 8 caracteres, uma letra e um número
        const re = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
        return re.test(password);
    }

    // --- Lógica da Pré-visualização da Foto ---
    fotoInput.addEventListener('change', function(event) {
        const file = event.target.files[0]; 
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                fotoPreview.src = e.target.result;
                fotoPreviewContainer.classList.add('has-image'); // Adiciona a classe para mostrar a máscara
            };
            reader.readAsDataURL(file);
        } else {
            fotoPreview.src = '';
            fotoPreviewContainer.classList.remove('has-image'); // Remove a classe se não houver foto
        }
    });

    // --- Lógica do Campo de Atuação Condicional ---
    function toggleAtuacaoField() {
        if (tipoSelect.value === 'trabalhador') {
            // Usamos 'flex' aqui porque o .form-group foi definido com display: flex no CSS
            // para o layout de duas colunas, e queremos que ele apareça com esse display.
            atuacaoGroup.style.display = 'flex'; 
            atuacaoInput.setAttribute('required', 'true');
        } else {
            atuacaoGroup.style.display = 'none';
            atuacaoInput.removeAttribute('required');
            atuacaoInput.value = ''; // Limpa o valor se for escondido
        }
    }
    tipoSelect.addEventListener('change', toggleAtuacaoField);
    toggleAtuacaoField(); // Chama na inicialização para definir o estado correto

    // --- Lógica de Formatação de Telefone (Máscara Simples) ---
    telefoneInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, ''); // Remove tudo que não é dígito
        let formattedValue = '';

        if (value.length > 0) {
            formattedValue = '(' + value.substring(0, 2);
        }
        if (value.length > 2) {
            // Se tiver 9 dígitos (celular) ou 8 (fixo)
            const part1Length = (value.length <= 10) ? 4 : 5; // 9999-9999 ou 99999-9999
            formattedValue += ') ' + value.substring(2, 2 + part1Length);
        }
        if (value.length > 6 && value.length <= 11) { // Garante que só adicione o '-' se já tiver 7+ dígitos
            formattedValue += '-' + value.substring(2 + (value.length <= 10 ? 4 : 5), 11);
        }
        e.target.value = formattedValue;
    });

    // --- Submissão do Formulário para o Backend ---
    formCadastro.addEventListener('submit', async function(event) {
        event.preventDefault(); // Impede o envio padrão do formulário

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
        
        // 2. Coletar todos os dados do formulário usando FormData
        // FormData é essencial para enviar arquivos como a foto
        const formData = new FormData(formCadastro);

        // 3. Definir o URL da sua API de backend
        const backendApiUrl = 'https://www.helpyapp.net/api'; 

        // 4. Exibir mensagem de carregamento
        showMessage('Enviando dados...', 'info'); 

        try {
            // 5. Enviar os dados usando a Fetch API
            const response = await fetch(backendApiUrl, {
                method: 'POST',
                body: formData // FormData cuida de configurar o Content-Type: multipart/form-data automaticamente
            });

            // 6. Verificar o status da resposta HTTP
            if (!response.ok) {
                // Se a resposta não for OK (ex: 400, 500), tenta ler uma mensagem de erro do backend
                const errorData = await response.json(); // Assumimos que o backend retorna JSON em caso de erro
                throw new Error(errorData.message || 'Erro desconhecido no servidor.');
            }

            // 7. Processar a resposta de sucesso
            const data = await response.json(); // Assumimos que o backend retorna JSON em caso de sucesso

            if (data.success) { // Se o backend indicar sucesso (ex: { success: true, message: "..." })
                showMessage(data.message || 'Cadastro realizado com sucesso!', 'success');
                // Opcional: Limpar o formulário após o sucesso
                formCadastro.reset();
                fotoPreview.src = ''; // Limpa a pré-visualização da foto
                fotoPreviewContainer.classList.remove('has-image'); // Remove a máscara/ícone
                toggleAtuacaoField(); // Restaura o estado inicial do campo atuação
            
            } else { // Se o backend indicar falha mas com status HTTP 200 (ex: { success: false, message: "..." })
                showMessage(data.message || 'Houve um erro no cadastro.', 'error');
            }

        } catch (error) {
            // 8. Capturar e lidar com erros (erros de rede, erros lançados pelos .then() anteriores)
            console.error('Erro ao enviar o formulário:', error);
            showMessage(`Erro: ${error.message || 'Não foi possível conectar ao servidor.'}`, 'error');
        }
    });
});