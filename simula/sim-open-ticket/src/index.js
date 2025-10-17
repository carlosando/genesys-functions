/**
 * Lambda Function - Gera número de ticket aleatório
 * Compatível com Genesys Function Data Actions
 * Runtime: Node.js 20.x
 */

exports.handler = async (event, context, callback) => {
  console.log("## Event:", JSON.stringify(event));
  console.log("## Context:", JSON.stringify(context));

  try {
    // Gera uma string de 5 dígitos aleatórios
    const ticketNumber = Array.from({ length: 5 }, () =>
      Math.floor(Math.random() * 10)
    ).join('');

    const response = {
      ticket_number: ticketNumber
    };

    console.log("## Response:", JSON.stringify(response));
    return response;

  } catch (error) {
    console.error("Handler Error:", error.message);
    callback(error);
  }
};
