"use strict";
const axios = require("axios");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

// Configurações do servidor
const app = express();
app.use(bodyParser.json());
app.use(cors());

// Credenciais do Mercado Pago
const ACCESS_TOKEN = "TEST-3549736690525885-021607-82c9a6981de9cfc996db786a154ba103-82097337";

// Função para gerar chave PIX e QR Code
async function gerarChavePix(valor) {
  try {
    console.log("Iniciando a geração da chave PIX...");

    const response = await axios.post(
      "https://api.mercadopago.com/v1/payments",
      {
        transaction_amount: valor,
        description: "Pagamento via PIX",
        payment_method_id: "pix",
        payer: {
          email: "cliente@exemplo.com", // Dados genéricos para atender à exigência
          identification: {
            type: "CPF",
            number: "12345678909" // CPF genérico
          }
        }
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Extraindo dados necessários
    const { point_of_interaction, id } = response.data;

    console.log("Chave PIX gerada com sucesso:", id);

    return {
      txid: id, // ID da transação
      qrcode: point_of_interaction.transaction_data.qr_code, // Código QR
      copiaECola: point_of_interaction.transaction_data.qr_code_base64, // Código PIX Copia e Cola
    };
  } catch (error) {
    console.error("Erro ao gerar chave PIX:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Erro ao gerar chave PIX");
  }
}

// Rota para gerar a chave PIX
app.post("/gerar-chave-pix", async (req, res) => {
  try {
    const { valor } = req.body;

    if (!valor || isNaN(valor)) {
      return res.status(400).json({ error: "Valor inválido" });
    }

    const qrcodeData = await gerarChavePix(parseFloat(valor));

    res.json({
      txid: qrcodeData.txid,
      qrcode: qrcodeData.qrcode,
      copiaECola: qrcodeData.copiaECola,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Iniciando o servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
