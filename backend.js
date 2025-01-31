"use strict";
const https = require("https");
const axios = require("axios");
const fs = require("fs");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

// Configurações do servidor
const app = express();
app.use(bodyParser.json());
app.use(cors());

// Caminho do certificado .p12
const certificado = fs.readFileSync("./homologacao-680504-loja2.p12");

// Credenciais do PIX
const credenciais = {
  client_id: "Client_Id_81ae6fbca0e6de8d8ce690690289bfd6e2e1d7bf",
  client_secret: "Client_Secret_57bd0d434850d5d8c578e01df13750a1a3ced239",
};

// Codificando as credenciais em base64
const data_credentials = `${credenciais.client_id}:${credenciais.client_secret}`;
const auth = Buffer.from(data_credentials).toString("base64");

// Função para gerar chave Pix e QR Code
async function gerarChavePix(valor) {
  try {
    console.log("Iniciando a geração da chave Pix...");
    const agent = new https.Agent({
      pfx: certificado,
      passphrase: "", // Se houver senha, insira aqui
    });

    // Configuração do token
    const configToken = {
      method: "POST",
      url: "https://pix-h.api.efipay.com.br/oauth/token",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      httpsAgent: agent,
      data: JSON.stringify({ grant_type: "client_credentials" }),
    };

    const tokenResponse = await axios(configToken);
    const token = tokenResponse.data.access_token;

    console.log("Token de acesso recebido:", token);

    // Configurando a cobrança
    const configCob = {
      method: "POST",
      url: "https://pix-h.api.efipay.com.br/v2/cob",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      httpsAgent: agent,
      data: JSON.stringify({
        calendario: { expiracao: 3600 },
        valor: { original: valor.toFixed(2) },
        chave: "mtt.h10@hotmail.com", // Substitua pela sua chave Pix
        solicitacaoPagador: "Pagamento de títulos",
      }),
    };

    console.log("Enviando solicitação de cobrança...");

    const cobResponse = await axios(configCob);
    console.log("Resposta da API Efí Bank:", cobResponse.data);

    // Baixar a imagem do QR Code e converter para base64
    let qrCodeUrl = cobResponse.data.loc.location;

    // Adicionar protocolo se estiver ausente
    if (!qrCodeUrl.startsWith("http")) {
      qrCodeUrl = `https://${qrCodeUrl}`;
    }

    const qrCodeResponse = await axios.get(qrCodeUrl, {
      responseType: "arraybuffer",
    });
    const qrCodeBase64 = Buffer.from(qrCodeResponse.data, "binary").toString("base64");

    return {
      qrcode: `data:image/png;base64,${qrCodeBase64}`, // QR Code em base64
      pixCopiaECola: cobResponse.data.pixCopiaECola,
    };
  } catch (error) {
    console.error("Erro ao gerar chave Pix:", error);
    if (error.response) {
      console.error("Resposta de erro da API:", error.response.data);
      return { error: error.response.data };
    } else if (error.request) {
      console.error("Nenhuma resposta da API foi recebida:", error.request);
    } else {
      console.error("Erro ao configurar a requisição:", error.message);
    }
    throw error;
  }
}

// Rota para gerar a chave Pix
app.post("/gerar-chave-pix", async (req, res) => {
  try {
    const { valor } = req.body;

    if (!valor || isNaN(valor) || valor <= 0) {
      return res.status(400).json({ error: "Valor inválido. Deve ser maior que zero." });
    }

    const qrcodeData = await gerarChavePix(parseFloat(valor));

    res.json({
      qrcode: qrcodeData.qrcode,
      pixCopiaECola: qrcodeData.pixCopiaECola,
    });
  } catch (error) {
    console.error("Erro ao gerar chave Pix:", error);
    if (error.response) {
      res.status(500).json({ error: error.response.data });
    } else {
      res.status(500).json({ error: "Erro interno no servidor" });
    }
  }
});

// Rota para verificar o pagamento
app.post("/verificar-pagamento", async (req, res) => {
  try {
    const { txid } = req.body;

    if (!txid) {
      return res.status(400).json({ error: "TXID é obrigatório" });
    }

    const agent = new https.Agent({
      pfx: certificado,
      passphrase: "",
    });

    // Configuração para consultar status do pagamento
    const configConsulta = {
      method: "GET",
      url: `https://pix-h.api.efipay.com.br/v2/cob/${txid}`,
      headers: {
        Authorization: `Bearer ${auth}`,
        "Content-Type": "application/json",
      },
      httpsAgent: agent,
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
