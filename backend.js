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

// Inicializar o arquivo de pagamentos se não existir
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

    const qrcode = {
      txid: response.data.id,
      qrcode: qrcodeData.qr_code,
      copiaECola: qrcodeData.qr_code_base64,
      valor,
      payerEmail,
      payerCpf,
      status: "pendente", // Inicialmente, o status é "pendente"
    };

    console.log(`Chave PIX gerada: ${JSON.stringify(qrcode)}`);
    return qrcode;
  } catch (error) {
    console.error("Erro ao gerar chave PIX:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Erro desconhecido");
  }
}

// Função para salvar pagamento no arquivo
function salvarPagamento(pagamento) {
  const pagamentos = JSON.parse(fs.readFileSync(PAGAMENTOS_FILE, "utf8"));
  pagamentos.push(pagamento);
  fs.writeFileSync(PAGAMENTOS_FILE, JSON.stringify(pagamentos, null, 2));
}

// Rota para verificar o status de um pagamento manualmente
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

// Rota para gerar a chave PIX e salvar o pagamento no arquivo
app.post("/gerar-chave-pix", async (req, res) => {
  try {
    const { valor, payerEmail, payerCpf } = req.body;
    if (!valor || !payerEmail || !payerCpf || isNaN(valor) || valor <= 0) {
      return res.status(400).json({ error: "Dados inválidos ou incompletos" });
    }

    const qrcodeData = await gerarChavePix(parseFloat(valor), payerEmail, payerCpf);

    // Salvar a transação no arquivo com status 'pendente'
    salvarPagamento(qrcodeData);

    console.log(`Chave PIX gerada com sucesso: txid=${qrcodeData.txid}, valor=${qrcodeData.valor}, email=${qrcodeData.payerEmail}`);
    res.json(qrcodeData);
  } catch (error) {
    console.error("Erro ao gerar chave PIX:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Rota para confirmar o pagamento e retornar os títulos apenas se o status for 'approved'
app.post("/confirmar-pagamento", async (req, res) => {
  try {
    const { txid } = req.query;
    if (!txid) {
      return res.status(400).json({ error: "TXID não fornecido" });
    }

    // Verificar o status do pagamento
    const status = await verificarStatus(txid);

    if (status === "approved") {
      // Buscar os pagamentos aprovados
      const pagamentos = JSON.parse(fs.readFileSync(PAGAMENTOS_FILE, "utf8"));
      const pagamento = pagamentos.find((p) => p.txid === txid);
      if (pagamento) {
        pagamento.status = status; // Atualizar o status para aprovado
        salvarPagamento(pagamento); // Atualizar no arquivo
        return res.json({ status, titulos: pagamento }); // Enviar os títulos junto com o status aprovado
      }
      return res.status(404).json({ error: "Pagamento não encontrado" });
    } else {
      // Retornar apenas a chave PIX, caso o pagamento não tenha sido aprovado
      return res.json({ status });
    }
  } catch (error) {
    console.error("Erro ao confirmar pagamento:", error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
