# 💳 Guia de Integração com Gateway de Pagamento

Este documento explica como integrar o sistema de Pagamento Seguro do Helpy com gateways de pagamento reais.

## 📋 Pré-requisitos

1. Conta no gateway de pagamento escolhido (Stripe, PagSeguro, Mercado Pago, etc.)
2. Chaves de API (Secret Key e Public Key)
3. Configurar variáveis de ambiente no `.env`

## 🔧 Configuração

### Variáveis de Ambiente

Adicione ao arquivo `.env`:

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLIC_KEY=pk_test_...

# Ou PagSeguro
PAGSEGURO_EMAIL=seu@email.com
PAGSEGURO_TOKEN=seu_token

# Ou Mercado Pago
MP_ACCESS_TOKEN=seu_access_token
MP_PUBLIC_KEY=seu_public_key
```

## 🔌 Integração com Stripe

### 1. Instalar dependência

```bash
npm install stripe
```

### 2. Modificar `api/server.js`

Na rota `POST /api/pagamento-seguro`, substitua o comentário de integração por:

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Criar Payment Intent
const valorTotal = valor + taxaPlataforma;
const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(valorTotal * 100), // Stripe usa centavos
    currency: 'brl',
    payment_method: metodoPagamento, // ID do método de pagamento do cliente
    confirm: true,
    metadata: {
        pagamentoId: pagamento._id.toString(),
        clienteId: clienteId.toString(),
        profissionalId: profissionalId.toString(),
        tipoServico: tipoServico
    }
});

pagamento.transacaoId = paymentIntent.id;
pagamento.status = paymentIntent.status === 'succeeded' ? 'pago' : 'pendente';
```

### 3. Webhook para confirmação

Crie uma rota para receber webhooks do Stripe:

```javascript
app.post('/api/webhook/stripe', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        const pagamentoId = paymentIntent.metadata.pagamentoId;
        
        await PagamentoSeguro.findByIdAndUpdate(pagamentoId, {
            status: 'pago',
            dataPagamento: new Date()
        });
    }

    res.json({received: true});
});
```

## 🔌 Integração com PagSeguro

### 1. Instalar dependência

```bash
npm install pagseguro-nodejs
```

### 2. Modificar `api/server.js`

```javascript
const pagseguro = require('pagseguro-nodejs')({
    email: process.env.PAGSEGURO_EMAIL,
    token: process.env.PAGSEGURO_TOKEN,
    mode: 'sandbox' // ou 'production'
});

const transaction = await pagseguro.transaction({
    paymentMode: 'default',
    paymentMethod: metodoPagamento,
    currency: 'BRL',
    itemId1: pagamento._id.toString(),
    itemDescription1: `Serviço ${tipoServico}`,
    itemAmount1: valorTotal.toFixed(2),
    itemQuantity1: 1,
    reference: pagamento._id.toString(),
    senderEmail: cliente.email
});

pagamento.transacaoId = transaction.code;
pagamento.status = transaction.status === '3' ? 'pago' : 'pendente';
```

## 🔌 Integração com Mercado Pago

### 1. Instalar dependência

```bash
npm install mercadopago
```

### 2. Modificar `api/server.js`

```javascript
const mercadopago = require('mercadopago');
mercadopago.configure({
    access_token: process.env.MP_ACCESS_TOKEN
});

const payment = await mercadopago.payment.save({
    transaction_amount: valorTotal,
    token: metodoPagamento, // Token do cartão
    description: `Serviço ${tipoServico}`,
    installments: 1,
    payment_method_id: 'visa', // ou 'master', 'amex', etc.
    payer: {
        email: cliente.email,
        identification: {
            type: 'CPF',
            number: cliente.cpf // se disponível
        }
    },
    metadata: {
        pagamentoId: pagamento._id.toString()
    }
});

pagamento.transacaoId = payment.body.id;
pagamento.status = payment.body.status === 'approved' ? 'pago' : 'pendente';
```

## 💸 Integração de Reembolsos

### Stripe

```javascript
const refund = await stripe.refunds.create({
    payment_intent: pagamento.transacaoId,
    amount: Math.round(pagamento.valor * 100)
});
pagamento.transacaoIdReembolso = refund.id;
```

### PagSeguro

```javascript
const refund = await pagseguro.refund({
    transactionCode: pagamento.transacaoId,
    refundValue: pagamento.valor
});
```

### Mercado Pago

```javascript
const refund = await mercadopago.payment.refund(pagamento.transacaoId);
```

## 🔔 Notificações Push (Opcional)

Para notificações push em tempo real, integre com:

- **Firebase Cloud Messaging (FCM)**
- **OneSignal**
- **Pusher**

Exemplo com FCM:

```javascript
const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

async function enviarPushNotification(userId, titulo, mensagem) {
    const user = await User.findById(userId);
    if (user.fcmToken) {
        await admin.messaging().send({
            token: user.fcmToken,
            notification: {
                title: titulo,
                body: mensagem
            }
        });
    }
}
```

## 📊 Próximos Passos

1. Testar integração em ambiente sandbox/teste
2. Configurar webhooks para confirmação automática
3. Implementar retry logic para falhas de pagamento
4. Adicionar logs detalhados de transações
5. Implementar sistema de reconciliação financeira

## ⚠️ Segurança

- **NUNCA** exponha chaves secretas no frontend
- Use HTTPS em produção
- Valide todos os webhooks com assinatura
- Implemente rate limiting nas rotas de pagamento
- Mantenha logs de auditoria de todas as transações

## 📞 Suporte

Para dúvidas sobre integração, consulte a documentação oficial do gateway escolhido.

