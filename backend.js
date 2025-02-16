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

// Função para gerar chave Pix e QR Code
async function gerarChavePix(valor) {
  try {
    console.log("Iniciando a geração da chave Pix com Mercado Pago...");

    const config = {
      method: "POST",
      url: "https://api.mercadopago.com/v1/payments",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `unique-key-${Date.now()}`, // Chave única
      },
      data: {
        transaction_amount: valor,
        description: "Pagamento via Pix",
        payment_method_id: "pix",
        payer: {
          email: "default@exemplo.com", // E-mail genérico
          first_name: "Cliente",        // Nome genérico
          last_name: "Anonimo",         // Sobrenome genérico
          identification: {
            type: "CPF",
            number: "00000000000",     // CPF genérico
          },
        },
      },
    };

    const response = await axios(config);
    const { point_of_interaction, id } = response.data;

    console.log("Chave Pix gerada com sucesso:", id);

    return {
      txid: id,
      qrcode: point_of_interaction.transaction_data.qr_code,
      imagemQrcode: point_of_interaction.transaction_data.qr_code_base64,
    };
  } catch (error) {
    console.error("Erro ao gerar chave Pix:", error.response ? error.response.data : error.message);
    throw error;
  }
}

// Função para verificar o status de pagamento
async function verificarPagamento(txid) {
  try {
    console.log("Verificando pagamento...");

    const config = {
      method: "GET",
      url: `https://api.mercadopago.com/v1/payments/${txid}`,
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    };

    const response = await axios(config);
    console.log("Pagamento verificado com sucesso:", response.data);

    return response.data;
  } catch (error) {
    console.error("Erro ao verificar pagamento:", error.response ? error.response.data : error.message);
    throw error;
  }
}

// Rota para gerar a chave Pix
app.post("/gerar-chave-pix", async (req, res) => {
  try {
    const { valor } = req.body;

    // Verifica se o valor é válido
    if (!valor || isNaN(valor) || valor <= 0) {
      return res.status(400).json({ error: "Valor inválido. O valor deve ser um número maior que 0." });
    }

    const qrcodeData = await gerarChavePix(parseFloat(valor));

    res.json({
      txid: qrcodeData.txid,
      qrcode: qrcodeData.qrcode,
      imagemQrcode: qrcodeData.imagemQrcode,
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao gerar chave Pix", detalhes: error.response ? error.response.data : error.message });
  }
});

// Rota para verificar o pagamento
app.post("/verificar-pagamento", async (req, res) => {
  try {
    const { txid } = req.body;

    if (!txid) {
      return res.status(400).json({ error: "TXID é obrigatório" });
    }

    const pagamento = await verificarPagamento(txid);
    res.json(pagamento);
  } catch (error) {
    res.status(500).json({ error: "Erro ao verificar pagamento", detalhes: error.response ? error.response.data : error.message });
  }
});

// Iniciando o servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
