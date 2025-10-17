const https = require('https');

/**
 * Handler compatível com Genesys Cloud Function
 * Recebe a URI da imagem e envia a imagem codificada em base64 para o Google Gemini Vision API.
 * parametros: image_uri, GEMINI_API_KEY, content_text, mime_type
 */
exports.handler = async (event, context, callback) => {
  console.log('## Context:', JSON.stringify(context));
  console.log('## Event:', JSON.stringify(event));

  const imageUri = event.image_uri;
  if (!imageUri) {
    callback(new Error('Parâmetro "imageUri" é obrigatório.'));
    return;
  }

  const apiKey = event.GEMINI_API_KEY;
  if (!apiKey) {
    callback(new Error('Variável de ambiente GEMINI_API_KEY não está definida.'));
    return;
  }

  const content_text = event.content_text;
  if (!content_text) {
    callback(new Error('Variável de content_text não está definida.'));
    return;
  }


  const mime_type = event.mime_type;
  if (!mime_type) {
    callback(new Error('Variável mime_type não está definida.'));
    return;
  }

  try {
    const base64Image = await fetchImageAsBase64(imageUri);


    const requestBody = JSON.stringify({
      contents: [
        {
          parts: [
            { text: content_text },
            {
              inline_data: {
                mime_type: mime_type, // ou image/png, se necessário
                data: base64Image
              }
            }
          ]
        }
      ]
    });

    const geminiResponse = await callGeminiApi(apiKey, requestBody);
    const parsed = JSON.parse(geminiResponse);

    return parsed;
  } catch (error) {
    console.error("Erro durante o processamento:", error);
    callback(error);
  }
};

/**
 * Faz o download de uma imagem e converte para base64
 */
function fetchImageAsBase64(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer.toString('base64'));
      });
    }).on('error', reject);
  });
}

/**
 * Chama a API Gemini com a imagem codificada
 * https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=
 */
function callGeminiApi(apiKey, body) {
  const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`Erro ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
