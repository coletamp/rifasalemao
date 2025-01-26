if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Carregar certificado SSL
const cert = fs.readFileSync(
  path.resolve(__dirname, `../../certs/${process.env.GN_CERT}`)
);

const agent = new https.Agent({
  pfx: cert,
  passphrase: ''
});

// Função para autenticação com a API
const authenticate = ({ clientID, clientSecret }) => {
  const credentials = Buffer.from(
    `${clientID}:${clientSecret}`
  ).toString('base64');

  return axios({
    method: 'POST',
    url: `${process.env.GN_ENDPOINT}/oauth/token`,
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json'
    },
    httpsAgent: agent,
    data: {
      grant_type: 'client_credentials'
    }
  });
};

// Função para criar uma requisição autenticada
const GNRequest = async (credentials) => {
  const authResponse = await authenticate(credentials);
  const accessToken = authResponse.data?.access_token;

  return axios.create({
    baseURL: process.env.GN_ENDPOINT,
    httpsAgent: agent,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
};

const app = express();

// Middleware para processamento de JSON
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', 'src/views');

// Função para autenticar a aplicação
const reqGNAlready = GNRequest({
  clientID: process.env.GN_CLIENT_ID,
  clientSecret: process.env.GN_CLIENT_SECRET
});

// Endpoint para gerar chave Pix e QR Code
app.post('/gerar-chave-pix', async (req, res) => {
  const reqGN = await reqGNAlready;
  const { valor } = req.body;  // Recebe o valor enviado pelo frontend

  const dataCob = {
    calendario: {
      expiracao: 3600  // Tempo de expiração de 1 hora
    },
    valor: {
      original: valor  // Valor da cobrança
    },
    chave: '126bec4a-2eb6-4b79-a045-78db68412899',  // Chave Pix estática, pode ser alterada conforme necessário
    solicitacaoPagador: 'Cobrança dos serviços prestados.'  // Descrição da cobrança
  };

  try {
    // Envia a requisição para criar a cobrança
    const cobResponse = await reqGN.post('/v2/cob', dataCob);

    // Solicita o QR Code associado à cobrança gerada
    const qrcodeResponse = await reqGN.get(`/v2/loc/${cobResponse.data.loc.id}/qrcode`);

    // Retorna a chave Pix e o QR Code
    res.json({
      pix: cobResponse.data.chave,  // Retorna a chave Pix gerada
      location: qrcodeResponse.data.imagemQrcode  // URL da imagem do QR Code
    });
  } catch (error) {
    console.error("Erro ao gerar chave Pix ou QR Code:", error);
    res.status(500).json({ error: 'Erro ao gerar chave Pix.' });
  }
});

// Endpoint para verificar o pagamento
app.post('/verificar-pagamento', async (req, res) => {
  const { idPagamento } = req.body;  // Recebe o ID do pagamento enviado pelo frontend

  const reqGN = await reqGNAlready;

  try {
    // Solicita o status do pagamento usando o ID
    const paymentStatusResponse = await reqGN.get(`/v2/pix/${idPagamento}/status`);  // Endpoint fictício para status de pagamento

    // Verifica se o pagamento foi confirmado
    if (paymentStatusResponse.data.status === 'CONFIRMED') {
      res.json({ status: 'CONFIRMED' });  // Pagamento confirmado
    } else {
      res.json({ status: 'PENDING' });  // Pagamento ainda pendente
    }
  } catch (error) {
    console.error("Erro ao verificar pagamento:", error);
    res.status(500).json({ error: 'Erro ao verificar pagamento.' });
  }
});

// Endpoint para o Webhook (Recebe notificações de status do pagamento)
app.post('/webhook(/pix)?', (req, res) => {
  console.log(req.body);  // Logs o corpo da requisição para depuração
  res.send('200');  // Responde com status 200 OK
});

// Inicia o servidor na porta 8000
app.listen(8000, () => {
  console.log('Server running on port 8000');
});
