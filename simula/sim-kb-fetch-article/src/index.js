/**
 * Lambda compatível com Genesys Function Data Actions
 * Node.js 20.x
 */

exports.handler = async (event, context, callback) => {
  console.log("## Event:", JSON.stringify(event));
  console.log("## Context:", JSON.stringify(context));

  try {
    // Validação básica
    if (!event.inputString || typeof event.inputString !== 'string') {
      throw new Error("Parâmetro 'inputString' é obrigatório e deve ser uma string.");
    }

    const randomId = Math.floor(Math.random() * 1000000); // Inteiro aleatório

    const response = {
      articleText: event.inputString,
      articleId: randomId
    };

    console.log("## Response:", JSON.stringify(response));
    return response;

  } catch (error) {
    console.error("Handler Error:", error.message);
    callback(error);
  }
};
