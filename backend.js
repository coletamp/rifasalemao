// Importações
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mercadopago = require('mercadopago');
require('dotenv').config();

// Configuração do Mercado Pago
mercadopago.configurations.setAccessToken(process.env.ACCESS_TOKEN);

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Rota para gerar chave Pix
app.post('/gerar-chave-pix', async (req, res) => {
    const { valor } = req.body;

    if (!valor) {
        return res.status(400).json({ error: 'Valor é obrigatório.' });
    }

    try {
        const paymentData = {
            transaction_amount: parseFloat(valor),
            description: 'Pagamento Wesley Alemão Prêmios',
            payment_method_id: 'pix',
            payer: {
                email: 'cliente@example.com', // Substituir pelo e-mail do cliente
                first_name: 'Cliente',
                last_name: 'Exemplo',
                identification: {
                    type: 'CPF',
                    number: '12345678909' // Substituir por CPF do cliente
                }
            }
        };

        const payment = await mercadopago.payment.create(paymentData);

        return res.status(201).json({
            txid: payment.body.id,
            qrcode: payment.body.point_of_interaction.transaction_data.qr_code,
            imagemQrcode: `data:image/jpeg;base64,${payment.body.point_of_interaction.transaction_data.qr_code_base64}`
        });
    } catch (error) {
        console.error('Erro ao gerar chave Pix:', error);
        res.status(500).json({ error: 'Erro ao gerar chave Pix.' });
    }
});

// Rota para verificar o pagamento
app.post('/verificar-pagamento', async (req, res) => {
    const { txid } = req.body;

    if (!txid) {
        return res.status(400).json({ error: 'TXID é obrigatório.' });
    }

    try {
        const payment = await mercadopago.payment.get(txid);

        return res.status(200).json({
            status: payment.body.status,
            status_detail: payment.body.status_detail
        });
    } catch (error) {
        console.error('Erro ao verificar pagamento:', error);
        res.status(500).json({ error: 'Erro ao verificar pagamento.' });
    }
});

// Iniciar o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
