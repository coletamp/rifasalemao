"use strict";
const axios = require("axios");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(bodyParser.json());
app.use(cors());

const ACCESS_TOKEN = "APP_USR-7155153166578433-022021-bb77c63cb27d3d05616d5c08e09077cf-502781407";
const PAGAMENTOS_FILE = "pagamentos.json";

// Inicializar arquivo de pagamentos, se não existir
if (!fs.existsSync(PAGAMENTOS_FILE)) {
  fs.writeFileSync(PAGAMENTOS_FILE, JSON.stringify([]));
}

// Função para gerar uma chave PIX
async function gerarChavePix(valor, payerEmail, payerCpf) {
  try {
    const idempotencyKey = uuidv4();
    const response = await axios.post(
      "https://api.mercadopago.com/v1/payments",
      {
        transaction_amount: valor,
        description: "Pagamento via PIX",
        payment_method_id: "pix",
        payer: {
          email: payerEmail,
          identification: {
            type: "CPF",
            number: payerCpf,
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

    const qrcodeData = response.data.point_of_interaction?.transaction_data;
    if (!qrcodeData) {
      throw new Error("Dados de pagamento não encontrados na resposta");
    }

    return {
      txid: response.data.id,
      qrcode: qrcodeData.qr_code,
      copiaECola: qrcodeData.qr_code_base64,
      valor,
      payerEmail,
      payerCpf,
      status: "pendente",
    };
  } catch (error) {
    console.error("Erro ao gerar chave PIX:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Erro desconhecido");
  }
}

// Função para salvar pagamento
function salvarPagamento(pagamento) {
  const pagamentos = JSON.parse(fs.readFileSync(PAGAMENTOS_FILE, "utf8"));
  pagamentos.push(pagamento);
  fs.writeFileSync(PAGAMENTOS_FILE, JSON.stringify(pagamentos, null, 2));
}

// Função para atualizar o status dos pagamentos
async function atualizarStatusPagamentos() {
  try {
    const pagamentos = JSON.parse(fs.readFileSync(PAGAMENTOS_FILE, "utf8"));

    for (const pagamento of pagamentos) {
      if (pagamento.status !== "approved") {
        const response = await axios.get(`https://api.mercadopago.com/v1/payments/${pagamento.txid}`, {
          headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
        });

        pagamento.status = response.data.status;
        console.log(`Pagamento atualizado: txid=${pagamento.txid}, status=${pagamento.status}`);
      }
    }

    fs.writeFileSync(PAGAMENTOS_FILE, JSON.stringify(pagamentos, null, 2));
    console.log("Status dos pagamentos atualizado com sucesso.");
  } catch (error) {
    console.error("Erro ao atualizar status dos pagamentos:", error.message);
  }
}

// Função para enviar um ping ao servidor
async function enviarPing() {
  try {
    const response = await axios.get(`http://localhost:${PORT}/pagamentos`);
    console.log("Ping bem-sucedido:", response.data);
  } catch (error) {
    console.error("Erro ao enviar ping:", error.message);
  }
}

// Configuração para atualizar automaticamente os pagamentos a cada 60 segundos
setInterval(atualizarStatusPagamentos, 60000);

// Configuração para enviar ping ao servidor a cada 60 segundos
setInterval(enviarPing, 60000);

// Rota para verificar status de pagamento
app.post("/verificar-status", async (req, res) => {
  const { txid } = req.body;
  if (!txid) {
    return res.status(400).json({ error: "txid não fornecido" });
  }

  try {
    const response = await axios.get(`https://api.mercadopago.com/v1/payments/${txid}`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });

    return res.json({ status: response.data.status });
  } catch (error) {
    console.error("Erro ao verificar status do pagamento:", error.message);
    return res.status(500).json({ error: "Erro ao verificar status do pagamento" });
  }
});

// Rota para gerar chave PIX
app.post("/gerar-chave-pix", async (req, res) => {
  try {
    const { valor, payerEmail, payerCpf } = req.body;
    if (!valor || !payerEmail || !payerCpf || isNaN(valor) || valor <= 0) {
      return res.status(400).json({ error: "Dados inválidos ou incompletos" });
    }

    const qrcodeData = await gerarChavePix(parseFloat(valor), payerEmail, payerCpf);

    salvarPagamento(qrcodeData);

    console.log(`Chave PIX gerada com sucesso: txid=${qrcodeData.txid}, valor=${qrcodeData.valor}, email=${qrcodeData.payerEmail}`);
    res.json(qrcodeData);
  } catch (error) {
    console.error("Erro ao gerar chave PIX:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Atualização de status automática
setInterval(atualizarStatusPagamentos, 60000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
