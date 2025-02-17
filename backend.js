"use strict";
const axios = require("axios");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(bodyParser.json());
app.use(cors({ origin: "*" }));

// Credenciais do Mercado Pago – use seu token real
const ACCESS_TOKEN = "TEST-3549736690525885-021607-82c9a6981de9cfc996db786a154ba103-82097337";

// Função para gerar a chave PIX utilizando o endpoint de PIX Transfer
async function gerarChavePix(valor) {
  try {
    const idempotencyKey = uuidv4();
    console.log("Idempotency Key gerada:", idempotencyKey);

    // Chamando o endpoint correto para PIX Transfer
    const response = await axios.post(
      "https://api.mercadopago.com/v1/pix/transfer", // endpoint de PIX transfer
      {
        transaction_amount: valor,
        description: "Pagamento via PIX",
        payment_method_id: "pix",
        payer: {
          email: "cliente@exemplo.com",
          identification: {
            type: "CPF",
            number: "12345678909",
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey,
        },
      }
    );

    // Extraindo os dados retornados conforme a documentação
    const { point_of_interaction, id } = response.data;
    console.log("Chave PIX gerada com sucesso:", id);

    return {
      txid: id,
      // Utiliza o valor para copia e cola (texto) conforme a documentação
      qrcode: point_of_interaction.transaction_data.qr_code,
      // Utiliza a string base64 para a imagem do QR Code
      copiaECola: point_of_interaction.transaction_data.qr_code_base64,
      // Se necessário, também pode retornar o ticket_url:
      ticket_url: point_of_interaction.transaction_data.ticket_url,
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
    res.json(qrcodeData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
