"use strict";
const axios = require("axios");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");

const app = express();
app.use(bodyParser.json());
app.use(cors());

const ACCESS_TOKEN = "APP_USR-7155153166578433-022021-bb77c63cb27d3d05616d5c08e09077cf-502781407";
const PAGAMENTOS_FILE = "pagamentos.json";

// Inicializar o arquivo de pagamentos se não existir
if (!fs.existsSync(PAGAMENTOS_FILE)) {
  fs.writeFileSync(PAGAMENTOS_FILE, JSON.stringify([]));
}

// Configuração do transporte de e-mail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "wesleyalemaoh@gmail.com",
    pass: "<M10019210a>", // Substitua pela senha de aplicativo do Gmail
  },
});

// Função para enviar e-mail de confirmação
async function enviarEmailConfirmacao(pagamento) {
  const mailOptions = {
    from: "wesleyalemaoh@gmail.com",
    to: "coleta.mp15@gmail.com",
    subject: "Confirmação de Pagamento",
    text: `Pagamento confirmado!\n\nDetalhes do pagamento:\n- Valor: R$ ${pagamento.valor}\n- Email do Pagador: ${pagamento.payerEmail}\n- CPF do Pagador: ${pagamento.payerCpf}\n- Status: ${pagamento.status}`,
  };

  try {
    console.log(`[LOG] Tentando enviar e-mail de confirmação para: ${mailOptions.to}`);
    await transporter.sendMail(mailOptions);
    console.log("[LOG] E-mail de confirmação enviado com sucesso.");
  } catch (error) {
    console.error("[ERRO] Falha ao enviar e-mail de confirmação:", error);
  }
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
      status: "pendente",
    };

    console.log(`[LOG] Chave PIX gerada: ${JSON.stringify(qrcodeData)}`);

    return qrcodeData;
  } catch (error) {
    console.error("[ERRO] Falha ao gerar chave PIX:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Erro ao gerar chave PIX");
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

    // Salvar pagamento no arquivo
    const pagamentos = JSON.parse(fs.readFileSync(PAGAMENTOS_FILE, "utf8"));
    pagamentos.push(qrcodeData);
    fs.writeFileSync(PAGAMENTOS_FILE, JSON.stringify(pagamentos, null, 2));

    console.log(`[LOG] Chave PIX gerada com sucesso: txid=${qrcodeData.txid}, valor=${qrcodeData.valor}, email=${qrcodeData.payerEmail}`);

    res.json(qrcodeData);
  } catch (error) {
    console.error("[ERRO] Falha ao gerar chave PIX:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Função para atualizar o status dos pagamentos
async function atualizarStatusPagamentos() {
  try {
    const pagamentos = JSON.parse(fs.readFileSync(PAGAMENTOS_FILE, "utf8"));

    for (const pagamento of pagamentos) {
      if (pagamento.status !== "approved") {
        console.log(`[LOG] Verificando status do pagamento: txid=${pagamento.txid}`);
        const response = await axios.get(`https://api.mercadopago.com/v1/payments/${pagamento.txid}`, {
          headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
        });

        pagamento.status = response.data.status;

        console.log(`[LOG] Status atualizado: txid=${pagamento.txid}, status=${pagamento.status}`);

        if (pagamento.status === "approved") {
          console.log(`[LOG] Pagamento confirmado: txid=${pagamento.txid}, valor=${pagamento.valor}, email=${pagamento.payerEmail}`);
          await enviarEmailConfirmacao(pagamento); // Enviar e-mail de confirmação
        }
      }
    }

    fs.writeFileSync(PAGAMENTOS_FILE, JSON.stringify(pagamentos, null, 2));
    console.log("[LOG] Status dos pagamentos atualizado com sucesso.");
  } catch (error) {
    console.error("[ERRO] Falha ao atualizar status dos pagamentos:", error);
  }
}

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

// Rota para verificar o status de um pagamento manualmente
app.post("/verificar-status", async (req, res) => {
  const { txid } = req.body;
  if (!txid) {
    return res.status(400).json({ error: "txid não fornecido" });
  }

  try {
    console.log(`[LOG] Verificando status manualmente para txid=${txid}`);
    const response = await axios.get(`https://api.mercadopago.com/v1/payments/${txid}`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });

    const status = response.data.status;

    // Atualizar o status no arquivo
    const pagamentos = JSON.parse(fs.readFileSync(PAGAMENTOS_FILE, "utf8"));
    const pagamento = pagamentos.find((p) => p.txid === txid);
    if (pagamento) {
      pagamento.status = status;
      fs.writeFileSync(PAGAMENTOS_FILE, JSON.stringify(pagamentos, null, 2));

      console.log(`[LOG] Status atualizado manualmente: txid=${pagamento.txid}, status=${pagamento.status}`);

      if (status === "approved") {
        console.log(`[LOG] Pagamento confirmado manualmente: txid=${pagamento.txid}, valor=${pagamento.valor}, email=${pagamento.payerEmail}`);
        await enviarEmailConfirmacao(pagamento);
      }
    }

    res.json({ status });
  } catch (error) {
    console.error("[ERRO] Falha ao verificar status do pagamento:", error);
    res.status(500).json({ error: "Erro ao verificar status do pagamento" });
  }
});

// Configuração para atualizar automaticamente os pagamentos a cada 60 segundos
setInterval(atualizarStatusPagamentos, 60000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[LOG] Servidor rodando na porta ${PORT}`));
