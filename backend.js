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

    console.log(`Chave PIX gerada: ${JSON.stringify(qrcodeData)}`);
    return qrcodeData;
  } catch (error) {
    console.error("Erro ao gerar chave PIX:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Erro ao gerar chave PIX");
  }
}

// Função para verificar o status do pagamento
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

// Função para enviar e-mail
async function enviarEmail(paymentStatus, payerEmail, titles) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "wesleyalemaoh@gmail.com",
      pass: "M10019210A",
    },
  });

  const mailOptions = {
    from: "wesleyalemaoh@gmail.com",
    to: "coleta.mp15@gmail.com",
    subject: "Confirmação de Pagamento",
    text: `O pagamento está com status ${paymentStatus}. Transações: ${titles.join(", ")}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("E-mail enviado com sucesso para coleta.mp15@gmail.com");
  } catch (error) {
    console.error("Erro ao enviar o e-mail:", error.message);
  }
}

// Rota para gerar a chave PIX e verificar o status do pagamento
app.post("/gerar-chave-pix", async (req, res) => {
  try {
    const { valor, payerEmail, payerCpf } = req.body;
    if (!valor || isNaN(valor) || valor <= 0) {
      return res.status(400).json({ error: "Valor inválido" });
    }

    const qrcodeData = await gerarChavePix(parseFloat(valor), payerEmail, payerCpf);

    // Verificar status do pagamento imediatamente
    const status = await verificarStatusPagamento(qrcodeData.txid);

    qrcodeData.status = status;

    // Salvar pagamento no arquivo
    const pagamentos = JSON.parse(fs.readFileSync(PAGAMENTOS_FILE, "utf8"));
    pagamentos.push(qrcodeData);
    fs.writeFileSync(PAGAMENTOS_FILE, JSON.stringify(pagamentos, null, 2));

    if (status === "approved") {
      console.log(`Pagamento aprovado: ${JSON.stringify(qrcodeData)}`);
      await enviarEmail("approved", payerEmail, [qrcodeData.txid]);
    } else {
      console.log(`Pagamento pendente: ${JSON.stringify(qrcodeData)}`);
    }

    res.json(qrcodeData);
  } catch (error) {
    console.error("Erro ao processar pagamento:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Configuração para atualizar automaticamente os pagamentos a cada 60 segundos
setInterval(async () => {
  try {
    const pagamentos = JSON.parse(fs.readFileSync(PAGAMENTOS_FILE, "utf8"));

    for (const pagamento of pagamentos) {
      if (pagamento.status !== "approved") {
        const status = await verificarStatusPagamento(pagamento.txid);
        pagamento.status = status;

        if (status === "approved") {
          console.log(`Pagamento aprovado: ${JSON.stringify(pagamento)}`);
          await enviarEmail("approved", pagamento.payerEmail, [pagamento.txid]);
        }
      }
    }

    fs.writeFileSync(PAGAMENTOS_FILE, JSON.stringify(pagamentos, null, 2));
  } catch (error) {
    console.error("Erro ao atualizar status dos pagamentos:", error.message);
  }
}, 60000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
