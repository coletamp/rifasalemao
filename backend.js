const express = require("express");
const fs = require("fs");
const axios = require("axios");
const cors = require("cors");
const app = express();

const PAGAMENTOS_FILE = "pagamentos.json";
const MERCADO_PAGO_BASE_URL = "https://api.mercadopago.com/v1";
const MERCADO_PAGO_ACCESS_TOKEN = "SEU_ACCESS_TOKEN_AQUI";
const EMAIL_CONFIRMATION_API = "https://api.example.com/send-email";

app.use(cors());
app.use(express.json());

// Endpoint para gerar chave PIX
app.post("/gerar-chave-pix", (req, res) => {
  const { valor, payerEmail, payerCpf } = req.body;

  if (!valor || !payerEmail || !payerCpf) {
    console.error("[ERRO] Parâmetros inválidos ao gerar chave PIX.");
    return res.status(400).send("Parâmetros inválidos.");
  }

  const txid = `TXID${Date.now()}`;
  const pagamento = {
    txid,
    valor,
    payerEmail,
    payerCpf,
    status: "pending",
  };

  try {
    const pagamentos = JSON.parse(fs.readFileSync(PAGAMENTOS_FILE, "utf8"));
    pagamentos.push(pagamento);
    fs.writeFileSync(PAGAMENTOS_FILE, JSON.stringify(pagamentos, null, 2));

    console.log(`[LOG] Chave PIX gerada com sucesso: ${txid}`);
    res.status(200).send({ txid });
  } catch (err) {
    console.error(`[ERRO] Falha ao salvar chave PIX: ${err.message}`);
    res.status(500).send("Erro ao gerar chave PIX.");
  }
});

// Função para atualizar o status dos pagamentos
async function atualizarStatusPagamentos() {
  console.log("[DEBUG] Início da função atualizarStatusPagamentos");

  try {
    const pagamentos = JSON.parse(fs.readFileSync(PAGAMENTOS_FILE, "utf8"));

    for (const pagamento of pagamentos) {
      if (pagamento.status === "approved") {
        console.log(`[LOG] Pagamento já aprovado: txid=${pagamento.txid}`);
        continue;
      }

      console.log(`[DEBUG] Verificando status do pagamento: txid=${pagamento.txid}`);

      try {
        const response = await axios.get(
          `${MERCADO_PAGO_BASE_URL}/payments/${pagamento.txid}`,
          {
            headers: {
              Authorization: `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
            },
          }
        );

        const novoStatus = response.data.status;
        pagamento.status = novoStatus;

        if (novoStatus === "approved") {
          console.log(`[LOG] Pagamento aprovado: txid=${pagamento.txid}`);

          try {
            await axios.post(EMAIL_CONFIRMATION_API, {
              email: pagamento.payerEmail,
              message: `Seu pagamento de R$${pagamento.valor} foi aprovado!`,
            });

            console.log(`[LOG] E-mail de confirmação enviado para ${pagamento.payerEmail}`);
          } catch (emailError) {
            console.error(`[ERRO] Falha ao enviar e-mail: ${emailError.message}`);
          }
        }
      } catch (apiError) {
        console.error(
          `[ERRO] Falha ao verificar status do pagamento: txid=${pagamento.txid}, erro=${apiError.message}`
        );
      }
    }

    fs.writeFileSync(PAGAMENTOS_FILE, JSON.stringify(pagamentos, null, 2));
    console.log("[DEBUG] Pagamentos atualizados com sucesso.");
  } catch (err) {
    console.error(`[ERRO] Falha ao ler ou atualizar pagamentos: ${err.message}`);
  }
}

// Intervalo para atualização dos pagamentos
setInterval(atualizarStatusPagamentos, 60000);

// Início do servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`[LOG] Servidor rodando na porta ${PORT}`);
});
