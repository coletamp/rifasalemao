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

// Função para gerar a chave PIX utilizando o endpoint de criar preferência
async function gerarChavePix(valor) {
  try {
    const idempotencyKey = uuidv4();
    console.log("Idempotency Key gerada:", idempotencyKey);

    // Chamando o endpoint correto para criar a preferência de pagamento (Checkout)
    const response = await axios.post(
      "https://api.mercadopago.com/checkout/preferences",
      {
        items: [
          {
            title: "Pagamento via PIX",
            quantity: 1,
            unit_price: valor,
          },
        ],
        payment_methods: {
          default_payment_method_id: "pix",  // Definindo PIX como o método de pagamento
          excluded_payment_types: [
            {
              id: "ticket", // Exclui outros métodos como boletos, por exemplo
            },
          ],
          installments: 1,
        },
        back_urls: {
          success: "https://www.sucesso.com.br",
          failure: "https://www.falha.com.br",
          pending: "https://www.pendente.com.br",
        },
        payer: {
          email: "cliente@exemplo.com",
          identification: {
            type: "CPF",
            number: "12345678909",
          },
        },
        notification_url: "https://www.seunotificacao.com.br",
        external_reference: "referencia-externa-12345",
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey,
        },
      }
    );

    console.log("Resposta da API do Mercado Pago:", response.data);

    const { point_of_interaction } = response.data;

    if (!point_of_interaction || !point_of_interaction.transaction_data) {
      throw new Error("Dados de interação PIX não encontrados na resposta.");
    }

    const { transaction_data } = point_of_interaction;
    const { qr_code, qr_code_base64, ticket_url } = transaction_data;

    return {
      txid: response.data.id,
      qrcode: qr_code,
      copiaECola: qr_code_base64,
      ticket_url: ticket_url,
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
