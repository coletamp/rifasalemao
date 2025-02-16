const express = require('express');
const mercadopago = require('mercadopago');
const app = express();

app.use(express.json());

// Configura as credenciais do Mercado Pago
mercadopago.configure({
  access_token: 'SEU_ACCESS_TOKEN'
});

// Endpoint para gerar a chave Pix
app.post('/gerar-chave-pix', async (req, res) => {
  const { valor } = req.body; // Obtém o valor enviado pelo front-end

  // Dados do pagamento via Pix
  const paymentData = {
    transaction_amount: parseFloat(valor), // Valor da transação
    payment_method_id: 'pix', // Método de pagamento Pix
    payer: {
      email: 'email_do_comprador@example.com', // E-mail do pagador
      first_name: 'Nome', // Nome do pagador
      last_name: 'Sobrenome', // Sobrenome do pagador
      identification: {
        type: 'CPF', // Tipo de documento
        number: '12345678909' // Número do CPF
      }
    }
  };

  try {
    // Cria o pagamento via Pix
    const payment = await mercadopago.payment.create(paymentData);
    // Retorna os dados do pagamento, incluindo o QR Code
    res.json({
      txid: payment.body.id, // ID da transação
      qrcode: payment.body.point_of_interaction.transaction_data.qr_code, // QR Code em formato texto
      imagemQrcode: payment.body.point_of_interaction.transaction_data.qr_code_base64 // QR Code em formato de imagem
    });
  } catch (error) {
    console.error('Erro ao criar pagamento:', error);
    res.status(500).json({ error: 'Erro ao criar pagamento' }); // Retorna erro caso a criação do pagamento falhe
  }
});

// Inicia o servidor
app.listen(3000, () => {
  console.log('Servidor rodando na porta 3000');
});
