# Configuração de SMTP para Envio de Emails

Para que os emails de verificação sejam enviados corretamente, você precisa configurar as variáveis de ambiente SMTP na Vercel.

## Opções de Serviços SMTP

### 1. Gmail (Recomendado para testes)

1. Ative a verificação em 2 etapas na sua conta Google
2. Gere uma "Senha de App":
   - Acesse: https://myaccount.google.com/apppasswords
   - Selecione "Email" e "Outro (nome personalizado)"
   - Digite "Helpy App" e clique em "Gerar"
   - Copie a senha gerada (16 caracteres)

3. Configure na Vercel:
   - `SMTP_HOST`: `smtp.gmail.com`
   - `SMTP_PORT`: `587`
   - `SMTP_USER`: seu email do Gmail
   - `SMTP_PASS`: a senha de app gerada (16 caracteres)
   - `SMTP_SECURE`: `false`
   - `SMTP_FROM`: `Helpy <seu-email@gmail.com>`

### 2. SendGrid (Recomendado para produção)

1. Crie uma conta em https://sendgrid.com
2. Crie uma API Key:
   - Settings > API Keys > Create API Key
   - Dê um nome e copie a chave

3. Configure na Vercel:
   - `SMTP_HOST`: `smtp.sendgrid.net`
   - `SMTP_PORT`: `587`
   - `SMTP_USER`: `apikey`
   - `SMTP_PASS`: sua API Key do SendGrid
   - `SMTP_SECURE`: `false`
   - `SMTP_FROM`: `Helpy <noreply@helpy.com>`

### 3. Resend (Alternativa moderna)

1. Crie uma conta em https://resend.com
2. Obtenha sua API Key
3. Use a API do Resend diretamente (requer alteração no código)

### 4. Outlook/Hotmail

1. Configure na Vercel:
   - `SMTP_HOST`: `smtp-mail.outlook.com`
   - `SMTP_PORT`: `587`
   - `SMTP_USER`: seu email Outlook
   - `SMTP_PASS`: sua senha
   - `SMTP_SECURE`: `false`
   - `SMTP_FROM`: `Helpy <seu-email@outlook.com>`

## Como Configurar na Vercel

1. Acesse seu projeto na Vercel
2. Vá em **Settings** > **Environment Variables**
3. Adicione cada variável:
   - Clique em **Add New**
   - Digite o nome da variável (ex: `SMTP_HOST`)
   - Digite o valor
   - Selecione os ambientes (Production, Preview, Development)
   - Clique em **Save**
4. Repita para todas as variáveis necessárias
5. Faça um novo deploy para aplicar as mudanças

## Variáveis Necessárias

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-de-app
SMTP_SECURE=false
SMTP_FROM=Helpy <noreply@helpy.com>
```

## Teste

Após configurar, teste o cadastro:
1. Preencha o formulário de cadastro
2. Clique em "Próximo"
3. Verifique se o email chegou na caixa de entrada
4. Use o código de 6 dígitos para validar

## Troubleshooting

- **Email não chega**: Verifique se todas as variáveis estão corretas
- **Erro de autenticação**: Verifique se a senha está correta (use senha de app no Gmail)
- **Timeout**: Aumente os timeouts no código se necessário
- **Spam**: Verifique a pasta de spam do email

