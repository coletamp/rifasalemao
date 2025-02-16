"use strict";
const axios = require("axios");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();

// Configuração do servidor
const app = express();
app.use(bodyParser.json());
app.use(cors());

// Configuração do Mercado Pago
const mercadoPago = {
  access_token: process.env.ACCESS_TOKEN, // Token de acesso do Mercado Pago
};

// Função para gerar chave Pix e QR Code
async function gerarChavePix(valor) {
  try {
    console.log("Iniciando a geração da chave Pix...");

    // Configuração da cobrança Pix
    const configCob = {
      method: "POST",
      url: "https://api.mercadopago.com/v1/payments",
      headers: {
        Authorization: `Bearer ${mercadoPago.access_token}`,
        "Content-Type": "application/json",
      },
      data: {
        transaction_amount: parseFloat(valor),
        description: "Pagamento Wesley Alemão Prêmios",
        payment_method_id: "pix",
        payer: {
          email: "cliente@example.com", // Substituir pelo e-mail do cliente
          first_name: "Cliente",
          last_name: "Exemplo",
          identification: {
            type: "CPF",
            number: "12345678909", // Substituir pelo CPF do cliente
          },
        },
      },
    };

    console.log("Enviando solicitação de cobrança...");
    const cobResponse = await axios(configCob);

    console.log("Cobrança criada com sucesso:", cobResponse.data);

    const { id: txid, point_of_interaction } = cobResponse.data;
    const { qr_code, qr_code_base64 } = point_of_interaction.transaction_data;

    return {
      txid,
      qrcode: qr_code,
      imagemQrcode: `data:image/jpeg;base64,${qr_code_base64}`,
    };
  } catch (error) {
    console.error("Erro ao gerar chave Pix:", error);
    if (error.response) {
      console.error("Resposta de erro da API:", error.response.data);
    }
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

    const qrcodeData = await gerarChavePix(parseFloat(valor));

    res.json({
      txid: qrcodeData.txid,
      qrcode: qrcodeData.qrcode,
      imagemQrcode: qrcodeData.imagemQrcode,
    });
  } catch (error) {
    console.error("Erro ao gerar chave Pix:", error);
    res.status(500).json({ error: "Erro ao gerar chave Pix" });
  }
});

// Função para verificar o pagamento
async function verificarPagamento(txid) {
  try {
    console.log("Verificando pagamento para o TXID:", txid);

    const configConsulta = {
      method: "GET",
      url: `https://api.mercadopago.com/v1/payments/${txid}`,
      headers: {
        Authorization: `Bearer ${mercadoPago.access_token}`,
        "Content-Type": "application/json",
      },
    };

    const consultaResponse = await axios(configConsulta);
    console.log("Pagamento verificado com sucesso:", consultaResponse.data);

    return consultaResponse.data;
  } catch (error) {
    console.error("Erro ao verificar pagamento:", error);
    if (error.response) {
      console.error("Resposta de erro da API:", error.response.data);
    }
    throw error;
  }
}

// Rota para verificar o pagamento
app.post("/verificar-pagamento", async (req, res) => {
  try {
    const { txid } = req.body;

    if (!txid) {
      return res.status(400).json({ error: "TXID é obrigatório" });
    }

    const paymentStatus = await verificarPagamento(txid);

    res.json(paymentStatus);
  } catch (error) {
    console.error("Erro ao verificar pagamento:", error);
    res.status(500).json({ error: "Erro ao verificar pagamento" });
  }
});

// Iniciando o servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
