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

// Insira o caminho de seu certificado .p12 dentro de seu projeto
var certificado = fs.readFileSync("./homologacao-680504-loja2.p12");

// Insira as credenciais do PIX
var credenciais = {
  client_id: "Client_Id_81ae6fbca0e6de8d8ce690690289bfd6e2e1d7bf",
  client_secret: "Client_Secret_57bd0d434850d5d8c578e01df13750a1a3ced239",
};

// Codificando as credenciais em base64
var data_credentials = credenciais.client_id + ":" + credenciais.client_secret;
var auth = Buffer.from(data_credentials).toString("base64");

// Função para gerar chave Pix
async function gerarChavePix(valor) {
  try {
    console.log("Iniciando a geração da chave Pix...");

    const agent = new https.Agent({
      pfx: certificado,
      passphrase: "",
    });

    // Log para verificar a configuração do token
    console.log("Configurando o token com as credenciais e certificado...");

    const configToken = {
      method: "POST",
      url: "https://pix-h.api.efipay.com.br/oauth/token",
      headers: {
        Authorization: "Basic " + auth,
        "Content-Type": "application/json",
      },
      httpsAgent: agent,
      data: JSON.stringify({ grant_type: "client_credentials" }),
    };

    const tokenResponse = await axios(configToken);
    const token = tokenResponse.data.access_token;

    // Log para verificar a resposta do token
    console.log("Token de acesso recebido:", token);

    // Configurando a cobrança com o token obtido
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

    // Log da resposta para garantir que os dados estão sendo acessados corretamente
    console.log("Resposta da API Efí Bank:", cobResponse.data);

    // Retorna os campos corretos
    return {
      imagemQrcode: `https://${cobResponse.data.loc.location}`, // URL completa do QR Code
      qrcode: cobResponse.data.pixCopiaECola, // Código copia e cola
    };
  } catch (error) {
    console.error("Erro ao gerar chave Pix:", error);
    throw error; // Relança o erro para ser capturado pela rota
  }
}

// Função para verificar o status do pagamento
async function verificarPagamento(pixKey) {
  try {
    console.log("Verificando status do pagamento...");

    const agent = new https.Agent({
      pfx: certificado,
      passphrase: "",
    });

    const configPagamento = {
      method: "POST",
      url: "https://pix-h.api.efipay.com.br/v2/cob/" + pixKey + "/status",
      headers: {
        Authorization: `Bearer ${auth}`,
        "Content-Type": "application/json",
      },
      httpsAgent: agent,
    };

    const pagamentoResponse = await axios(configPagamento);

    if (pagamentoResponse.data.status === "PAID") {
      console.log("Pagamento confirmado!");
      return { paymentConfirmed: true };
    } else {
      console.log("Pagamento não confirmado.");
      return { paymentConfirmed: false };
    }
  } catch (error) {
    console.error("Erro ao verificar pagamento:", error);
    throw error; // Relança o erro para ser capturado pela rota
  }
}

// Rota para gerar a chave Pix
app.post("/gerar-chave-pix", async (req, res) => {
  try {
    console.log("Iniciando o processo de geração de chave Pix...");
    
    const { valor } = req.body;

    // Log para verificar o valor recebido
    console.log("Valor recebido para gerar chave Pix:", valor);

    const qrcodeData = await gerarChavePix(valor);

    // Log para verificar o que está sendo enviado
    console.log("Resposta gerada pelo backend:", qrcodeData);

    res.json({
      qrcode: qrcodeData.imagemQrcode,
      pix: qrcodeData.qrcode,
    });
  } catch (error) {
    console.error("Erro completo:", error.response?.data || error);
    res.status(500).json({ error: "Erro ao gerar chave Pix" });
  }
});

// Rota para verificar o status do pagamento
app.post("/verificar-pagamento", async (req, res) => {
  try {
    const { pixKey } = req.body;

    // Log para verificar o pixKey recebido
    console.log("PixKey recebido para verificar pagamento:", pixKey);

    const status = await verificarPagamento(pixKey);

    res.json(status);
  } catch (error) {
    console.error("Erro ao verificar pagamento:", error);
    res.status(500).json({ error: "Erro ao verificar pagamento" });
  }
});

// Iniciar o servidor
const PORT = process.env.PORT || 3000; // Usa a porta do ambiente ou 3000 como padrão
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
