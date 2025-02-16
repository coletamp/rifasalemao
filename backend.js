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
    console.log("[INFO] Iniciando a geração da chave Pix...");
    console.log("[DEBUG] Valor recebido:", valor);

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

    console.log("[INFO] Enviando solicitação de cobrança ao Mercado Pago...");
    const cobResponse = await axios(configCob);

    console.log("[SUCCESS] Cobrança criada com sucesso. Dados retornados:", cobResponse.data);

    const { id: txid, point_of_interaction } = cobResponse.data;
    const { qr_code, qr_code_base64 } = point_of_interaction.transaction_data;

    console.log("[DEBUG] Dados do QR Code retornados:", { txid, qr_code });

    return {
      txid,
      qrcode: qr_code,
      imagemQrcode: `data:image/jpeg;base64,${qr_code_base64}`,
    };
  } catch (error) {
    console.error("[ERROR] Erro ao gerar chave Pix:", error);
    if (error.response) {
      console.error("[ERROR] Resposta de erro da API Mercado Pago:", error.response.data);
    }
    throw error;
  }
}

// Rota para gerar a chave Pix
app.post("/gerar-chave-pix", async (req, res) => {
  try {
    console.log("[INFO] Requisição recebida para gerar chave Pix.");
    console.log("[DEBUG] Corpo da requisição:", req.body);

    const { valor } = req.body;

    if (!valor || isNaN(valor)) {
      console.error("[ERROR] Valor inválido recebido:", valor);
      return res.status(400).json({ error: "Valor inválido" });
    }

    console.log("[INFO] Chamando a função gerarChavePix com o valor:", valor);
    const qrcodeData = await gerarChavePix(parseFloat(valor));

    console.log("[SUCCESS] Chave Pix gerada com sucesso. Retornando dados ao cliente...");
    res.json({
      txid: qrcodeData.txid,
      qrcode: qrcodeData.qrcode,
      imagemQrcode: qrcodeData.imagemQrcode,
    });
  } catch (error) {
    console.error("[ERROR] Erro ao processar a rota /gerar-chave-pix:", error);
    res.status(500).json({ error: "Erro ao gerar chave Pix" });
  }
});

// Função para verificar o pagamento
async function verificarPagamento(txid) {
  try {
    console.log("[INFO] Verificando pagamento para o TXID:", txid);

    const configConsulta = {
      method: "GET",
      url: `https://api.mercadopago.com/v1/payments/${txid}`,
      headers: {
        Authorization: `Bearer ${mercadoPago.access_token}`,
        "Content-Type": "application/json",
      },
    };

    console.log("[INFO] Enviando requisição para verificar pagamento...");
    const consultaResponse = await axios(configConsulta);

    console.log("[SUCCESS] Pagamento verificado com sucesso. Dados retornados:", consultaResponse.data);

    return consultaResponse.data;
  } catch (error) {
    console.error("[ERROR] Erro ao verificar pagamento:", error);
    if (error.response) {
      console.error("[ERROR] Resposta de erro da API Mercado Pago:", error.response.data);
    }
    throw error;
  }
}

// Rota para verificar o pagamento
app.post("/verificar-pagamento", async (req, res) => {
  try {
    console.log("[INFO] Requisição recebida para verificar pagamento.");
    console.log("[DEBUG] Corpo da requisição:", req.body);

    const { txid } = req.body;

    if (!txid) {
      console.error("[ERROR] TXID não fornecido.");
      return res.status(400).json({ error: "TXID é obrigatório" });
    }

    console.log("[INFO] Chamando a função verificarPagamento com o TXID:", txid);
    const paymentStatus = await verificarPagamento(txid);

    console.log("[SUCCESS] Status do pagamento retornado ao cliente.");
    res.json(paymentStatus);
  } catch (error) {
    console.error("[ERROR] Erro ao processar a rota /verificar-pagamento:", error);
    res.status(500).json({ error: "Erro ao verificar pagamento" });
  }
});

// Iniciando o servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`[INFO] Servidor rodando na porta ${PORT}`);
});
