// Backend - Node.js
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { Payment, MercadoPagoConfig } from 'mercadopago';

// Configurações iniciais do servidor
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Configuração do MercadoPago
const client = new MercadoPagoConfig({ accessToken: '<ACCESS_TOKEN>' }); // Substitua pelo seu token

// Endpoint para criar pagamento via Pix
app.post('/create_pix_payment', async (req, res) => {
    try {
        const { transactionAmount, description } = req.body;

        const payment = new Payment(client);
        const result = await payment.create({
            body: {
                transaction_amount: transactionAmount,
                description,
                payment_method_id: 'pix',
                payer: {
                    email: 'comprador@exemplo.com', // Adapte conforme necessário
                    identification: {
                        type: 'CPF',
                        number: '12345678900', // Apenas como exemplo
                    },
                },
                date_of_expiration: new Date(new Date().getTime() + 24 * 60 * 60 * 1000), // 24 horas
            },
            requestOptions: {
                idempotencyKey: `<SOME_UNIQUE_VALUE>` // Substitua por um valor único para evitar duplicação
            }
        });

        return res.status(200).json({
            qrCodeBase64: result.body.point_of_interaction.transaction_data.qr_code_base64,
            pixCode: result.body.point_of_interaction.transaction_data.qr_code,
        });
    } catch (error) {
        console.error('Erro ao criar pagamento com Pix:', error);
        return res.status(500).json({ error: 'Erro ao criar pagamento com Pix' });
    }
});

// Inicializar servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});


// Frontend
    </script>
