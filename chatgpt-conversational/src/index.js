const https = require('https');
const fs = require('fs');
const path = require('path');

exports.handler = async (event, context, callback) => {
  const openAiApiKey = event.xOpenAPIKey;
  const chatGPTModel = event.chatGPTModel || "gpt-4.1"; // Modelo configurável com fallback

  if (!openAiApiKey) {
    return callback(null, {
      assistantMessage: "__ERROR_API_KEY__",
      updatedHistoryJson: null
    });
  }

  let systemPrompt = "";
  try {
    const promptPath = path.join(__dirname, 'systemPrompt.txt');
    systemPrompt = fs.readFileSync(promptPath, 'utf-8');
  } catch (error) {
    return callback(null, {
      assistantMessage: "__ERROR_SYSTEM_PROMPT__",
      updatedHistoryJson: null
    });
  }

  let parsedHistory = [];
  try {
    if (event.historyJson && event.historyJson.trim() !== "") {
      const parsed = JSON.parse(event.historyJson);
      parsedHistory = Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {
    return callback(null, {
      assistantMessage: "__ERROR_HISTORY_JSON__",
      updatedHistoryJson: null
    });
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...parsedHistory,
    { role: 'user', content: event.userMessage }
  ];

  try {
    const response = await chatWithGPT(openAiApiKey, chatGPTModel, messages);

    const updatedMessages = [...messages, { role: 'assistant', content: response }];
    if (updatedMessages.length > 0 && updatedMessages[0].role === 'system') {
      updatedMessages[0].content = " ";
    }

    return callback(null, {
      assistantMessage: response,
      updatedHistoryJson: JSON.stringify(updatedMessages)
    });

  } catch (error) {
    const rawResponse = error.rawResponse ? `::RAW_RESPONSE::${error.rawResponse}` : "";
    return callback(null, {
      assistantMessage: `__ERROR_OPENAI_CALL_STAGE__::${error.stage || "unknown"}::${error.message}${rawResponse}`,
      updatedHistoryJson: null
    });
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
    let stage = "request_start";

    const req = https.request(options, (res) => {
      stage = "response_received";

      let body = '';
      res.on('data', (chunk) => {
        stage = "reading_response";
        body += chunk;
      });

      res.on('end', () => {
        stage = "parsing_response";
        try {
          const data = JSON.parse(body);

          if (!data.choices || !data.choices[0]?.message?.content) {
            stage = "invalid_response_structure";
            return reject({
              stage,
              message: "Resposta inesperada da OpenAI: estrutura inválida.",
              rawResponse: body
            });
          }

          resolve(data.choices[0].message.content);
        } catch (err) {
          err.stage = stage;
          err.rawResponse = body;
          reject(err);
        }
      });
    });

    req.on('error', (err) => {
      err.stage = stage || "request_error";
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}
