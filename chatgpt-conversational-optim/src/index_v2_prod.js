const https = require('https');
const fs = require('fs');
const path = require('path');


exports.handler = async (event, context, callback) => {
  // Substituído conforme solicitado
  const openAiApiKey = event.xOpenAPIKey;
  const chatGPTModel = event.chatGPTModel || "gpt-4.1"; // Modelo configurável com fallback

  if (!openAiApiKey) return callback(new Error("API key da OpenAI (xOpenAPIKey) não fornecida."));

  // Carrega o systemPrompt do arquivo local
  let systemPrompt = "";
  try {
    const promptPath = path.join(__dirname, 'systemPrompt.txt');
    systemPrompt = fs.readFileSync(promptPath, 'utf-8');
    console.log("systemPrompt carregado.");
  } catch (error) {
    console.error("Erro ao carregar systemPrompt.txt:", error);
    systemPrompt = " "; // fallback mínimo
  }

  // Parse do histórico
  let parsedHistory = [];
  try {
    if (event.historyJson && event.historyJson.trim() !== "") {
      const parsed = JSON.parse(event.historyJson);
      parsedHistory = Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {
    return callback(new Error("Histórico malformado. Deve ser uma string JSON de um array de mensagens."));
  }
  
  // NOVO TRATAMENTO: addPromptHistory
  if (event.addPromptHistory && event.addPromptHistory.trim() !== "") {
    parsedHistory.push({ role: 'user', content: event.addPromptHistory.trim() });
  }

  // Cria contexto para a requisição ao LLM
  const messages = [
    { role: 'system', content: systemPrompt },
    ...parsedHistory,
    { role: 'user', content: event.userMessage }
  ];

  try {
    const response = await chatWithGPT(openAiApiKey, chatGPTModel, messages);

    // Prepara histórico atualizado, sanitizando systemPrompt
    const updatedMessages = [...messages, { role: 'assistant', content: response }];
    if (updatedMessages.length > 0 && updatedMessages[0].role === 'system') {
      updatedMessages[0].content = " "; // substitui prompt longo por espaço
    }

    return {
      assistantMessage: response,
      updatedHistoryJson: JSON.stringify(updatedMessages)
    };

  } catch (error) {
    console.error("Erro na chamada à OpenAI:", error);
    callback(error);
  }
};

async function chatWithGPT(apiKey, model, messages) {
  const postData = JSON.stringify({
    model: model,
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
            console.error("Resposta inválida da OpenAI:", data);
            return reject(new Error("Resposta inesperada da OpenAI."));
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
