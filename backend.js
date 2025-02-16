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

    console.log("Payload preparado:", JSON.stringify(payload, null, 2));

    // Fazendo a requisição ao Mercado Pago
    console.log("Enviando requisição para a API do Mercado Pago...");
    const response = await axios.post(
      "https://api.mercadopago.com/v1/payments",
      payload,
      {
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("Resposta recebida da API do Mercado Pago:", JSON.stringify(response.data, null, 2));

    // Verificando a resposta
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
    console.error("Erro ao gerar chave Pix:", error.response?.data || error.message);
    throw error;
  }
}

// Rota para gerar a chave Pix
app.post("/gerar-chave-pix", async (req, res) => {
  console.log("Recebendo requisição na rota /gerar-chave-pix...");
  try {
    const { valor } = req.body;

    console.log("Corpo da requisição recebido:", JSON.stringify(req.body, null, 2));

    if (!valor || isNaN(valor)) {
      console.error("Valor inválido recebido:", valor);
      return res.status(400).json({ error: "Valor inválido" });
    }

    const pixData = await gerarChavePix(valor);

    console.log("Enviando resposta para o cliente...");
    res.setHeader("Access-Control-Allow-Origin", "*"); // Adicionando o cabeçalho CORS
    res.json({
      qr_code: pixData.qr_code,
      qr_code_base64: pixData.qr_code_base64,
    });
  } catch (error) {
    console.error("Erro interno ao processar a requisição:", error);
    res.status(500).json({ error: "Erro ao gerar chave Pix", details: error.message });
  }
});

// Iniciando o servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
