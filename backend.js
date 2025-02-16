const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// Substitua com suas credenciais do Mercado Pago
const ACCESS_TOKEN = 'TEST-3549736690525885-021607-82c9a6981de9cfc996db786a154ba103-82097337';

app.post('/gerar-pix', async (req, res) => {
  const { valor, descricao } = req.body;

  try {
    const response = await axios.post(
      'https://api.mercadopago.com/v1/payments',
      {
        transaction_amount: parseFloat(valor),
        description: descricao || 'Pagamento Pix',
        payment_method_id: 'pix',
        payer: {
          email: 'usuario@exemplo.com',
          first_name: 'Usuário',
          last_name: 'Padrão',
          identification: {
            type: 'CPF',
            number: '12345678909', // CPF genérico
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
        },
      }
    );

    const { point_of_interaction, qr_code, qr_code_base64 } = response.data;

    res.json({
      pixCopiaCola: point_of_interaction.transaction_data.qr_code,
      qrCodeBase64: qr_code_base64,
    });
  } catch (error) {
    console.error('Erro ao gerar Pix:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao gerar Pix.' });
  }
});

app.listen(3000, () => {
  console.log('Servidor rodando na porta 3000.');
});
