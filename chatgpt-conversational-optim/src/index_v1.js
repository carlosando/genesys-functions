const https = require('https');

exports.handler = async (event, context, callback) => {
  console.log("## Context: " + JSON.stringify(context));
  console.log("## Event: " + JSON.stringify(event));

  // const openAiApiKey = context.clientContext?.['x-openai-apikey'];
  const openAiApiKey = event.xOpenAPIKey;

  if (!openAiApiKey) {
    return callback(new Error("API key da OpenAI não fornecida no contexto."));
  }

  // Verifica se systemPrompt está presente
  if (!event.systemPrompt || event.systemPrompt.trim() === "") {
    return callback(new Error("Parâmetro obrigatório 'systemPrompt' ausente ou vazio."));
  }

  const gptModel = event.chatGPTModel || "gpt-4.1"; // Define o modelo padrão se não for fornecido
  if (!gptModel || gptModel.trim() === "") {
    return callback(new Error("gptModel não fornecida no contexto."));
  }

  // Parse do histórico de conversa
 let parsedHistory = [];

  try {
    if (event.historyJson && event.historyJson.trim() !== "") {
      const parsed = JSON.parse(event.historyJson);
      parsedHistory = Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {
    return callback(new Error("Histórico malformado. Deve ser uma string JSON de um array de mensagens."));
  }


  const messages = [
    { role: 'system', content: event.systemPrompt },
    ...parsedHistory,
    { role: 'user', content: event.userMessage }
  ];

  try {
    const response = await chatWithGPT(openAiApiKey, messages);

    return {
      assistantMessage: response,
      updatedHistoryJson: JSON.stringify([...messages, { role: 'assistant', content: response }])
    };

  } catch (error) {
    console.error("Erro ao chamar OpenAI:", error);
    callback(error);
  }
};

async function chatWithGPT(apiKey, messages) {
  const postData = JSON.stringify({
    model: "gpt-4.1",
    messages,
    temperature: 0.7
  });

  const options = {
    hostname: 'api.openai.com',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (!data.choices || !data.choices[0]?.message?.content) {
            console.error("Resposta inesperada da OpenAI:", data);
            return reject(new Error("Resposta inesperada da OpenAI. Verifique o modelo, credenciais ou limites."));
          }
          resolve(data.choices[0].message.content);
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}
