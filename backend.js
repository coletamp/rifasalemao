"use strict";
const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const cors = require("cors");

// Configurações do servidor
const app = express();
app.use(bodyParser.json());
app.use(cors());

// Credenciais do Mercado Pago
const MP_ACCESS_TOKEN = "TEST-3549736690525885-021607-82c9a6981de9cfc996db786a154ba103-82097337";

// Função para gerar chave Pix e QR Code
async function gerarChavePix(valor) {
  try {
    console.log("Iniciando a geração da chave Pix...");

    // Configuração para criar o pagamento Pix
    const response = await axios.post(
      "https://api.mercadopago.com/v1/payments",
      {
        transaction_amount: parseFloat(valor),
        description: "Pagamento via Pix",
        payment_method_id: "pix",
        payer: {
          email: "emaildopagador@example.com", // Substitua por um email válido
          first_name: "Nome",
          last_name: "Sobrenome",
          identification: {
            type: "CPF",
            number: "12345678909", // Substitua por um CPF válido
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    const paymentData = response.data;
    const pixData = paymentData.point_of_interaction.transaction_data;

    console.log("Chave Pix gerada com sucesso:", pixData.qr_code);

    return {
      qr_code: pixData.qr_code,
      qr_code_base64: pixData.qr_code_base64,
    };
  } catch (error) {
    console.error("Erro ao gerar chave Pix:", error.response?.data || error.message);
    throw error;
  }
}

// Rota para gerar a chave Pix
app.post("/gerar-chave-pix", async (req, res) => {
  try {
    const { valor } = req.body;

    if (!valor || isNaN(valor)) {
      return res.status(400).json({ error: "Valor inválido" });
    }

    const pixData = await gerarChavePix(valor);
    res.json({
      qr_code: pixData.qr_code,
      qr_code_base64: pixData.qr_code_base64,
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao gerar chave Pix" });
  }
});

// Iniciando o servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
