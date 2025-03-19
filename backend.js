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

    const qrcodeData = {
      txid: response.data.id,
      qrcode: response.data.point_of_interaction.transaction_data.qr_code,
      copiaECola: response.data.point_of_interaction.transaction_data.qr_code_base64,
      valor,
      payerEmail,
      payerCpf,
      status: "pendente", // Inicialmente, o status é "pendente"
    };

    console.log(`Chave PIX gerada: ${JSON.stringify(qrcodeData)}`);
    return qrcodeData;
  } catch (error) {
    console.error("Erro ao gerar chave PIX:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Erro ao gerar chave PIX");
  }
}

// Função para salvar pagamento no arquivo
function salvarPagamento(pagamento) {
  const pagamentos = JSON.parse(fs.readFileSync(PAGAMENTOS_FILE, "utf8"));
  pagamentos.push(pagamento);
  fs.writeFileSync(PAGAMENTOS_FILE, JSON.stringify(pagamentos, null, 2));
}

// Função para verificar o status de um pagamento
async function verificarStatusPagamento(txid) {
  try {
    const response = await axios.get(`https://api.mercadopago.com/v1/payments/${txid}`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });

    return response.data.status;
  } catch (error) {
    console.error("Erro ao verificar status do pagamento:", error.message);
    throw new Error("Erro ao verificar status do pagamento");
  }
}

// Função para consultar o status do pagamento até que ele seja aprovado
async function monitorarPagamento(txid, qrcodeData) {
  let status = "pendente";
  try {
    while (status !== "approved") {
      status = await verificarStatusPagamento(txid);

      if (status === "approved") {
        // Atualiza o status para 'approved' no pagamento
        qrcodeData.status = status;
        salvarPagamento(qrcodeData);
        console.log(`Pagamento confirmado: txid=${txid}, status=approved`);
        break;
      }

      // Espera 1 minuto antes de consultar novamente
      console.log(`Status do pagamento ${txid} ainda não aprovado. Verificando novamente em 1 minuto...`);
      await new Promise(resolve => setTimeout(resolve, 60000)); // Aguardar 1 minuto
    }
  } catch (error) {
    console.error("Erro ao monitorar pagamento:", error.message);
  }
}

// Rota para gerar a chave PIX e salvar o pagamento no arquivo
app.post("/gerar-chave-pix", async (req, res) => {
  try {
    const { valor, payerEmail, payerCpf } = req.body;
    if (!valor || isNaN(valor) || valor <= 0) {
      return res.status(400).json({ error: "Valor inválido" });
    }

    const qrcodeData = await gerarChavePix(parseFloat(valor), payerEmail, payerCpf);

    // Salvar a transação no arquivo com status 'pendente'
    salvarPagamento(qrcodeData);

    // Monitorar o status do pagamento
    monitorarPagamento(qrcodeData.txid, qrcodeData);

    console.log(`Chave PIX gerada com sucesso: txid=${qrcodeData.txid}, valor=${qrcodeData.valor}, email=${qrcodeData.payerEmail}`);
    res.json(qrcodeData);
  } catch (error) {
    console.error("Erro ao gerar chave PIX:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Rota para listar apenas os pagamentos aprovados
app.get("/pagamentos", (req, res) => {
  try {
    const pagamentos = JSON.parse(fs.readFileSync(PAGAMENTOS_FILE, "utf8"));
    const pagamentosAprovados = pagamentos.filter((p) => p.status === "approved");
    res.json(pagamentosAprovados);
  } catch (error) {
    res.status(500).json({ error: "Erro ao carregar pagamentos" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
