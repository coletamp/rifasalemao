const express = require("express");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(bodyParser.json());

const PORT = 3000;

// Configuração do Nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "wesleyalemaoh@gmail.com",
    pass: "M10019210a", // Substitua por uma senha de app
  },
});

// Função para enviar e-mail de confirmação
async function enviarEmailConfirmacao(email, valor, txid) {
  const mailOptions = {
    from: "wesleyalemaoh@gmail.com",
    to: email,
    subject: "Confirmação de Pagamento",
    text: `O pagamento de R$ ${valor.toFixed(2)} foi recebido com sucesso. ID da transação: ${txid}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("E-mail enviado com sucesso para:", email);
  } catch (error) {
    console.error("Erro ao enviar e-mail:", error.message);
    throw new Error("Erro ao enviar e-mail de confirmação");
  }
}

// Rota para enviar e-mails diretamente
app.post("/enviar-email", async (req, res) => {
  const { paymentStatus, payerEmail, titles } = req.body;

  const mailOptions = {
    from: "wesleyalemaoh@gmail.com",
    to: payerEmail,
    subject: "Status do Pagamento",
    text: `Status do pagamento: ${paymentStatus}. Títulos relacionados: ${titles.join(", ")}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).send("E-mail enviado com sucesso!");
  } catch (error) {
    console.error("Erro ao enviar e-mail:", error.message);
    res.status(500).send("Erro ao enviar e-mail.");
  }
});

// Rota para gerar chave PIX
app.post("/gerar-chave-pix", async (req, res) => {
  const { payerEmail, valor } = req.body;

  if (!payerEmail || !valor) {
    return res.status(400).send("Email e valor são obrigatórios.");
  }

  try {
    // Simulação de geração de chave PIX com um UUID
    const qrcodeData = {
      chave: uuidv4(),
      txid: uuidv4().substring(0, 20),
    };

    console.log("Chave PIX gerada:", qrcodeData);

    // Enviar e-mail de confirmação
    await enviarEmailConfirmacao(payerEmail, valor, qrcodeData.txid);

    res.status(200).json({
      message: "Chave PIX gerada e e-mail enviado.",
      qrcodeData,
    });
  } catch (error) {
    console.error("Erro ao processar a solicitação:", error.message);
    res.status(500).send("Erro ao gerar chave PIX ou enviar e-mail.");
  }
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
