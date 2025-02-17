const express = require("express");
const mercadopago = require("mercadopago");

const app = express();
app.use(express.json()); // Para interpretar o corpo das requisições JSON

// Configurar credenciais do Mercado Pago
mercadopago.configurations.setAccessToken('TEST-3549736690525885-021607-82c9a6981de9cfc996db786a154ba103-82097337');

// Endpoint para gerar a chave Pix
app.post("/gerar-chave-pix", async (req, res) => {
  try {
    const { valor } = req.body; // Valor enviado do frontend

    // Configurar o pagamento
    const preference = {
      items: [
        {
          title: "Pagamento via Pix",
          quantity: 1,
          unit_price: valor,
        },
      ],
      payment_methods: {
        excluded_payment_types: [
          {
            id: "ticket",
          },
        ],
        default_payment_method: "pix",
      },
      back_urls: {
        success: "https://seusite.com/sucesso",
        failure: "https://seusite.com/falha",
        pending: "https://seusite.com/pendente",
      },
    };

    // Criar a preferência de pagamento
    const preferenceResponse = await mercadopago.preferences.create(preference);

    // Retornar o QR Code e a chave Pix
    const paymentLink = preferenceResponse.body.init_point;
    const qrCodeImage = preferenceResponse.body.qr_code;
    res.json({
      txid: preferenceResponse.body.id,
      qrcode: paymentLink,
      imagemQrcode: qrCodeImage,
    });
  } catch (error) {
    console.error("Erro ao gerar a chave Pix:", error);
    res.status(500).json({ message: "Erro ao gerar a chave Pix" });
  }
});

// Verificação de pagamento (em tempo real)
app.post("/verificar-pagamento", async (req, res) => {
  try {
    const { txid } = req.body; // ID da transação

    // Consultar o status do pagamento
    const paymentResponse = await mercadopago.payment.get(txid);

    // Verificar o status do pagamento
    if (paymentResponse.body.status === "approved") {
      res.json({ status: "CONFIRMED" });
    } else {
      res.json({ status: "PENDING" });
    }
  } catch (error) {
    console.error("Erro ao verificar o pagamento:", error);
    res.status(500).json({ message: "Erro ao verificar o pagamento" });
  }
});

// Iniciar o servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
