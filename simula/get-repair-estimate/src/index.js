// src/index.js

/**
 * Lambda handler para retornar a previsão de retorno da eletricidade
 * baseado no último dígito do customer_id.
 */

exports.handler = async (event, context, callback) => {
  console.log("## Context: " + JSON.stringify(context));
  console.log("## Event: " + JSON.stringify(event));

  try {
    const customerId = event.customer_id;

    if (!customerId || typeof customerId !== 'string' || customerId.length === 0) {
      throw new Error("Parâmetro 'customer_id' inválido ou ausente.");
    }

    const lastChar = customerId.slice(-1);

    if (!/^\d$/.test(lastChar)) {
      throw new Error("O último caractere de 'customer_id' não é um número válido.");
    }

    const previsao = parseInt(lastChar, 10);

    const response = { previsao };

    console.log("## Response: " + JSON.stringify(response));

    return response;
  } catch (error) {
    console.error("## Erro na execução da função:", error.message);
    callback(error);
  }
};
