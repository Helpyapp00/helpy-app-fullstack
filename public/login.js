document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const feedbackMessage = document.getElementById('feedback-message');
    const togglePassword = document.getElementById('toggle-password');
    const senhaInput = document.getElementById('senha-login');
    const btnLogin = document.getElementById('btn-login');

    if (togglePassword && senhaInput) {
        togglePassword.addEventListener('click', function (e) {
            const type = senhaInput.getAttribute('type') === 'password' ? 'text' : 'password';
            senhaInput.setAttribute('type', type);
            this.classList.toggle('fa-eye-slash');
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('email-login').value;
            const senha = senhaInput.value;

            btnLogin.disabled = true;
            feedbackMessage.textContent = 'Processando...';
            feedbackMessage.className = 'feedback-message';

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, senha })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    localStorage.setItem('jwtToken', data.token);
                    localStorage.setItem('userId', data.userId);
                    localStorage.setItem('userType', data.userType);
                    localStorage.setItem('userName', data.userName);
                    localStorage.setItem('userPhotoUrl', data.userPhotoUrl);
                    
                    feedbackMessage.textContent = 'Login bem-sucedido! Redirecionando...';
                    feedbackMessage.classList.add('success');
                    
                    window.location.href = 'index.html';
                } else {
                    feedbackMessage.textContent = data.message || 'Erro desconhecido. Por favor, tente novamente.';
                    feedbackMessage.classList.add('error');
                }
            } catch (error) {
                console.error('Erro de rede ou servidor:', error);
                feedbackMessage.textContent = 'Erro: Não foi possível conectar ao servidor ou processar o login.';
                feedbackMessage.classList.add('error');
            } finally {
                btnLogin.disabled = false;
            }
        });
    }
});