const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Endpoint para gerar a chave Pix
app.post('/gerar-chave-pix', async (req, res) => {
  const { valor, descricao, email } = req.body;

  try {
    // Requisição para a API do Mercado Pago
    const response = await axios.post('https://api.mercadopago.com/v1/payments', {
      transaction_amount: parseFloat(valor),
      description: descricao,
      payment_method_id: 'pix',
      payer: {
        email: email,
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer SEU_ACCESS_TOKEN`
      }
    });

    // Retorna os dados relevantes para o front-end
    res.json({
      id: response.data.id,
      qr_code: response.data.point_of_interaction.transaction_data.qr_code,
      qr_code_base64: response.data.point_of_interaction.transaction_data.qr_code_base64
    });
  } catch (error) {
    console.error('Erro ao criar pagamento Pix:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Erro ao criar pagamento Pix' });
  }
});

// Inicia o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
