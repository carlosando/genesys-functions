const https = require('https');
const querystring = require('querystring');

/**
 * Lambda handler para Genesys Function Data Action
 * Requisições autenticadas para obter imagem da Genesys Cloud e enviar para Gemini Vision API.
 */
exports.handler = async (event, context, callback) => {
  console.log("## Context:", JSON.stringify(context));
  console.log("## Event:", JSON.stringify(event));

  const { image_uri, GEMINI_API_KEY, content_text, mime_type, clientId, clientSecret, oauthRegion } = event;

  // Verificação de parâmetros obrigatórios
  const missing = ['image_uri', 'GEMINI_API_KEY', 'content_text', 'mime_type', 'clientId', 'clientSecret', 'oauthRegion']
    .filter(k => !event[k]);

  if (missing.length > 0) {
    throw new Error(`Parâmetros obrigatórios ausentes: ${missing.join(', ')}`);
  }

  try {
    const accessToken = await getAccessTokenFromGenesys(clientId, clientSecret, oauthRegion);
    const base64Image = await fetchImageWithBearerToken(image_uri, accessToken);

    const requestBody = JSON.stringify({
      contents: [
        {
          parts: [
            { text: content_text },
            {
              inline_data: {
                mime_type,
                data: base64Image
              }
            }
          ]
        }
      ]
    });

    const response = await callGeminiApi(GEMINI_API_KEY, requestBody);
    return JSON.parse(response);

  } catch (error) {
    console.error("Erro no processamento:", error);
    throw error;
  }
};

function fetchImageWithBearerToken(url, accessToken) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);

        console.log("Imagem baixada - tamanho em bytes:", buffer.length);
        if (!buffer.length) {
          return reject(new Error("A imagem retornada da URL está vazia."));
        }

        resolve(buffer.toString('base64'));
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Solicita o access_token usando clientId e clientSecret da Genesys Cloud
 */
function getAccessTokenFromGenesys(clientId, clientSecret, region) {
  const postData = querystring.stringify({
    grant_type: 'client_credentials'
  });

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const options = {
    hostname: `login.${region}`,
    path: '/oauth/token',
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const parsed = JSON.parse(data);
          resolve(parsed.access_token);
        } else {
          reject(new Error(`Erro ao obter access_token (${res.statusCode}): ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Chama a API Gemini
 */
function callGeminiApi(apiKey, body) {
  const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
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
