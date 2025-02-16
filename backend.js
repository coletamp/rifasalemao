async function gerarChavePix(valor) {
  try {
    console.log("Iniciando a geração da chave Pix...");

    const payload = {
      transaction_amount: parseFloat(valor),
      description: "Pagamento via Pix",
      payment_method_id: "pix",
      payer: {
        email: "emaildopagador@example.com", // Substitua por um email válido
        first_name: "Nome",
        last_name: "Sobrenome",
        identification: {
          type: "CPF",
          number: "12345678909", // Substitua por um CPF válido
        },
      },
    };

    console.log("Payload enviado para o Mercado Pago:", JSON.stringify(payload, null, 2));

    // Gerando uma chave única para o header X-Idempotency-Key
    const idempotencyKey = uuidv4();
    console.log("X-Idempotency-Key gerado:", idempotencyKey);

    // Verificando se o idempotencyKey não está null ou undefined
    if (!idempotencyKey) {
      throw new Error("A chave de idempotência não foi gerada corretamente.");
    }

    // Verificando o valor antes de enviar
    console.log("Valor da chave de idempotência antes de enviar:", idempotencyKey);

    // Fazendo a requisição ao Mercado Pago
    const response = await axios.post(
      "https://api.mercadopago.com/v1/payments",
      payload,
      {
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey, // Passando o header corretamente
        },
      }
    );

    console.log("Resposta da API Mercado Pago:", JSON.stringify(response.data, null, 2));

    if (response.data?.point_of_interaction?.transaction_data?.qr_code) {
      const pixData = response.data.point_of_interaction.transaction_data;
      console.log("Chave Pix gerada com sucesso:", pixData.qr_code);
      return {
        qr_code: pixData.qr_code,
        qr_code_base64: pixData.qr_code_base64,
      };
    } else {
      console.error("Resposta inválida da API do Mercado Pago:", response.data);
      throw new Error("Resposta inválida da API do Mercado Pago");
    }
  } catch (error) {
    console.error("Erro ao gerar chave Pix:");
    console.error("Mensagem do erro:", error.message);
    console.error("Erro completo:", error);
    console.error("Resposta do erro:", error.response?.data || "Sem resposta");
    throw error;
  }
}
