document.addEventListener('DOMContentLoaded', function() {
    const formLogin = document.getElementById('form-login');
    const emailInput = document.getElementById('email');
    const senhaInput = document.getElementById('senha');
    const formMessage = document.getElementById('form-message');

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

    formLogin.addEventListener('submit', async function(event) {
        event.preventDefault();

        const email = emailInput.value;
        const senha = senhaInput.value;

        if (!email || !senha) {
            showMessage('Por favor, preencha todos os campos.', 'error');
            return;
        }

        showMessage('Verificando credenciais...', 'info');

        try {
            const response = await fetch('https://www.helpyapp.net/api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, senha })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                showMessage(data.message || 'Login realizado com sucesso!', 'success');
                localStorage.setItem('jwtToken', data.token);
                localStorage.setItem('userId', data.userId);
                localStorage.setItem('userType', data.userType);
                
                // IMPORTANTE: Certifique-se que seu backend na rota /api/login retorna userName e userPhotoUrl
                localStorage.setItem('userName', data.userName || 'Usuário');
                localStorage.setItem('userPhotoUrl', data.userPhotoUrl || 'https://via.placeholder.com/50?text=User');

                window.location.href = 'index.html';
            } else {
                showMessage(data.message || 'Erro ao fazer login. Verifique suas credenciais.', 'error');
            }
        } catch (error) {
            console.error('Erro ao enviar o formulário de login:', error);
            showMessage('Erro: Não foi possível conectar ao servidor ou processar o login.', 'error');
        }
    });
});