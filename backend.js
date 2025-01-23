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
      passphrase: "",  // Se houver senha, insira aqui
    });

    // Configuração do token
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

    console.log("Resposta da API Efí Bank:", cobResponse.data);

    // Retorna os campos corretos
    return {
      imagemQrcode: `https://${cobResponse.data.loc.location}`, // URL completa do QR Code
      qrcode: cobResponse.data.pixCopiaECola, // Código copia e cola
    };
  } catch (error) {
    console.error("Erro ao gerar chave Pix:", error);
    // Verifica a resposta do erro e exibe mais detalhes
    if (error.response) {
      console.error("Resposta de erro da API:", error.response.data);
    } else if (error.request) {
      console.error("Erro na requisição:", error.request);
    } else {
      console.error("Erro desconhecido:", error.message);
    }
    throw error; // Relança o erro para ser capturado pela rota
  }
}

// Rota para gerar a chave Pix
app.post("/gerar-chave-pix", async (req, res) => {
  try {
    console.log("Iniciando o processo de geração de chave Pix...");

    const { valor } = req.body;

    console.log("Valor recebido para gerar chave Pix:", valor);

    const qrcodeData = await gerarChavePix(valor);

    console.log("Resposta gerada pelo backend:", qrcodeData);

    res.json({
      qrcode: qrcodeData.imagemQrcode,
      pix: qrcodeData.qrcode,
    });
  } catch (error) {
    console.error("Erro ao gerar chave Pix:", error);
    res.status(500).json({ error: "Erro ao gerar chave Pix" });
  }
});

// Adicionando o endpoint para verificar o pagamento
app.post("/verificar-pagamento", async (req, res) => {
  try {
    console.log("Verificando pagamento...");

    const { idPagamento } = req.body;  // Aqui, você vai pegar o ID do pagamento enviado no corpo da requisição.

    // Adapte isso para fazer a verificação do pagamento de acordo com a API do seu provedor
    const configVerificarPagamento = {
      method: "GET",  // Aqui você usa GET para consultar o status do pagamento
      url: `https://pix-h.api.efipay.com.br/v2/pagamentos/${idPagamento}`, // A URL pode variar conforme o seu provedor
      headers: {
        Authorization: `Bearer ${auth}`, // Use o token recebido anteriormente
        "Content-Type": "application/json",
      },
    };

    // Aqui, fazemos a requisição à API para verificar o pagamento
    const respostaPagamento = await axios(configVerificarPagamento);

    // Retorna a resposta com o status do pagamento
    res.json({
      status: respostaPagamento.data.status,  // Exemplo de resposta que você pode ajustar conforme a API
    });
  } catch (error) {
    console.error("Erro ao verificar pagamento:", error);
    res.status(500).json({ error: "Erro ao verificar pagamento" });
  }
});

// Iniciar o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
