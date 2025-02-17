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
const MERCADO_PAGO_ACCESS_TOKEN = "TEST-3549736690525885-021607-82c9a6981de9cfc996db786a154ba103-82097337"; // Substitua pelo seu token de acesso

// Função para gerar chave Pix e QR Code
async function gerarChavePix(valor) {
  try {
    console.log("Iniciando a geração da chave Pix...");

    // Configurando o pagamento Pix
    const configPagamento = {
      method: "POST",
      url: "https://api.mercadopago.com/v1/payments",
      headers: {
        Authorization: `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      data: {
        transaction_amount: valor,
        payment_method_id: "pix",
        description: "Pagamento de compra",
        payer: {
          email: "cliente@example.com", // Opcional: email do pagador
        },
      },
    };

    console.log("Enviando solicitação de pagamento Pix...");
    const pagamentoResponse = await axios(configPagamento);

    console.log("Pagamento criado com sucesso:", pagamentoResponse.data);

    const { id, point_of_interaction } = pagamentoResponse.data;
    const qrcodeData = point_of_interaction.transaction_data;

    return {
      id,
      qrcode: qrcodeData.qr_code,
      imagemQrcode: qrcodeData.qr_code_base64,
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
      id: qrcodeData.id,
      qrcode: qrcodeData.qrcode,
      imagemQrcode: qrcodeData.imagemQrcode,
    });
  } catch (error) {
    console.error("Erro ao gerar chave Pix:", error);
    res.status(500).json({ error: "Erro ao gerar chave Pix" });
  }
});

// Rota para verificar o pagamento
app.post("/verificar-pagamento", async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: "ID do pagamento é obrigatório" });
    }

    // Configuração para consultar status do pagamento
    const configConsulta = {
      method: "GET",
      url: `https://api.mercadopago.com/v1/payments/${id}`,
      headers: {
        Authorization: `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
      },
    };

    const consultaResponse = await axios(configConsulta);
    res.json(consultaResponse.data);
  } catch (error) {
    console.error("Erro ao verificar pagamento:", error);
    if (error.response) {
      console.error("Resposta de erro da API:", error.response.data);
    }
    res.status(500).json({ error: "Erro ao verificar pagamento" });
  }
});

// Iniciando o servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
