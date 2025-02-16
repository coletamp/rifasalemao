"use strict";

const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid"); // Biblioteca para gerar UUID

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

    const payload = {
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
    };

    console.log("Payload enviado para o Mercado Pago:", JSON.stringify(payload, null, 2));

    // Gerando uma chave única para o header X-Idempotency-Key
    const idempotencyKey = uuidv4();
    console.log("X-Idempotency-Key gerado:", idempotencyKey);

    // Verifique se o idempotencyKey não está null ou undefined
    if (!idempotencyKey) {
      throw new Error("A chave de idempotência não foi gerada corretamente.");
    }

    // Fazendo a requisição ao Mercado Pago
    console.log("Enviando requisição para Mercado Pago com X-Idempotency-Key:", idempotencyKey);

    const response = await axios.post(
      "https://api.mercadopago.com/v1/payments",
      payload,
      {
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey, // Adicionando o header necessário
        },
      }
    );

    console.log("Resposta da API Mercado Pago:", JSON.stringify(response.data, null, 2));

    if (response.data?.point_of_interaction?.transaction_data?.qr_code) {
      const pixData = response.data.point_of_interaction.transaction_data;
      console.log("Chave Pix gerada com sucesso:", pixData.qr_code);
      return {
        qr_code: pixData.qr_code,
        qr_code_base64: pixData.qr_code_base64,
      };
    } else {
      console.error("Resposta inválida da API do Mercado Pago:", response.data);
      throw new Error("Resposta inválida da API do Mercado Pago");
    }
  } catch (error) {
    console.error("Erro ao gerar chave Pix:");
    console.error("Mensagem do erro:", error.message);
    console.error("Erro completo:", error);
    console.error("Resposta do erro:", error.response?.data || "Sem resposta");
    throw error;
  }
}

// Rota para gerar a chave Pix
app.post("/gerar-chave-pix", async (req, res) => {
  try {
    const { valor } = req.body;

    console.log("Requisição recebida com valor:", valor);

    if (!valor || isNaN(valor)) {
      console.warn("Valor inválido recebido:", valor);
      return res.status(400).json({ error: "Valor inválido" });
    }

    const pixData = await gerarChavePix(valor);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      qr_code: pixData.qr_code,
      qr_code_base64: pixData.qr_code_base64,
    });
  } catch (error) {
    console.error("Erro interno ao gerar chave Pix:", error.message);
    console.error("Detalhes completos do erro:", error);
    res.status(500).json({
      error: "Erro ao gerar chave Pix",
      details: error.response?.data || error.message,
    });
  }
});

// Iniciando o servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
