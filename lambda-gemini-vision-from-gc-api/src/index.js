// lambda-gemini-vision/index.js

const axios = require('axios');
const cheerio = require('cheerio'); // Para analisar HTML
const { GoogleGenerativeAI } = require("@google/generative-ai"); // Cliente Gemini
const { URL } = require('url'); // Para resolver URLs

// --- Função Auxiliar para Extrair a URL Real do HTML ---
// (Mantida fora do handler para melhor organização)
// **** ADAPTE A LÓGICA DE EXTRAÇÃO CONFORME O HTML REAL ****
function extractRealImageUrl(htmlContent, baseUrl) {
    try {
        const $ = cheerio.load(htmlContent);

        // Tenta meta refresh
        const metaRefresh = $('meta[http-equiv="refresh"]');
        if (metaRefresh.length > 0) {
            const content = metaRefresh.attr('content');
            if (content) {
                const match = content.match(/url=(.*)/i);
                if (match && match[1]) {
                    const extractedUrl = match[1].trim().replace(/['"]/g, '');
                    const absoluteUrl = new URL(extractedUrl, baseUrl).href;
                    console.log("URL extraída da tag meta refresh:", absoluteUrl);
                    return absoluteUrl;
                }
            }
        }

        // Tenta link específico (Exemplo, adaptar seletor!)
        // const downloadLink = $('a#downloadLink');
        // if (downloadLink.length > 0) { ... }

        // Tenta JS básico (Exemplo, adaptar!)
         const scriptTags = $('script');
         let jsUrl = null;
         scriptTags.each((i, elem) => {
             const scriptContent = $(elem).html();
             if (scriptContent) {
                  const locMatch = scriptContent.match(/window\.location(\.href)?\s*=\s*['"]([^'"]+)['"]/);
                  if (locMatch && locMatch[2]) {
                       jsUrl = locMatch[2];
                       return false;
                  }
             }
         });
          if (jsUrl) {
               const absoluteUrl = new URL(jsUrl, baseUrl).href;
               console.log("URL extraída de um script (tentativa básica):", absoluteUrl);
               return absoluteUrl;
          }


        console.error("Não foi possível encontrar a URL da imagem real no HTML.");
        return null;

    } catch (parseError) {
        console.error("Erro ao analisar o HTML com cheerio:", parseError);
        return null;
    }
}

// --- Handler Principal do Lambda ---
exports.handler = async (event) => {

    // --- Configuração e Constantes (Agora dentro do handler) ---
    const GEMINI_API_KEY = event.GEMINI_API_KEY;
    const INITIAL_HTML_URL = event.gcapi_public_url; // Vem do evento
    const PROMPT = event.prompt;                     // Vem do evento
    const GEMINI_MODEL = "gemini-1.5-flash";         // Modelo especificado
    const ACCEPTABLE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'application/octet-stream'];

    // --- Validação da Entrada do Evento ---
    if (!GEMINI_API_KEY) {
        console.error("Erro: event.GEMINI_API_KEY não fornecido.");
        return {
            statusCode: 400, // Bad Request
            body: JSON.stringify({ error: "Parâmetro obrigatório 'GEMINI_API_KEY' ausente no evento de entrada." }),
        };
    }
    if (!INITIAL_HTML_URL) {
        console.error("Erro: event.gcapi_public_url não fornecido.");
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Parâmetro obrigatório 'gcapi_public_url' ausente no evento de entrada." }),
        };
    }
     if (!PROMPT) {
         console.error("Erro: event.prompt não fornecido.");
         return {
             statusCode: 400,
             body: JSON.stringify({ error: "Parâmetro obrigatório 'prompt' ausente no evento de entrada." }),
         };
     }

    console.log("Iniciando processo. URL inicial (HTML):", INITIAL_HTML_URL);
    console.log("Modelo Gemini:", GEMINI_MODEL);
    console.log("Prompt:", PROMPT);


    // --- Inicialização do Cliente Gemini (Dentro do handler, após obter a chave) ---
    let model;
    try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    } catch (initError) {
         console.error("Erro ao inicializar o cliente GoogleGenerativeAI:", initError);
         return {
             statusCode: 500,
             body: JSON.stringify({ error: "Falha ao inicializar o cliente Gemini. Verifique a API Key.", details: initError.message }),
         };
    }


    let realImageUrl;

    // --- 1. Obter o HTML da URL inicial ---
    try {
        console.log("Buscando HTML da URL inicial...");
        const htmlResponse = await axios.get(INITIAL_HTML_URL, {
             headers: { 'User-Agent': 'Mozilla/5.0' } // Simula browser
        });
        console.log("HTML recebido. Status:", htmlResponse.status);
         if (htmlResponse.status >= 400) throw new Error(`Status ${htmlResponse.status}`);

        const htmlContent = htmlResponse.data;

        // --- 2. Extrair a URL real da imagem do HTML ---
        console.log("Analisando HTML para encontrar a URL real da imagem...");
        realImageUrl = extractRealImageUrl(htmlContent, INITIAL_HTML_URL); // Usa a função auxiliar

        if (!realImageUrl) {
            throw new Error("Não foi possível extrair a URL da imagem do conteúdo HTML.");
        }
        console.log("URL real da imagem encontrada:", realImageUrl);

    } catch (error) {
        console.error("Erro na etapa 1 ou 2 (Buscar HTML ou Extrair URL):", error.message);
        return {
            statusCode: 502, // Ou 400 se a URL inicial for inválida
            body: JSON.stringify({
                error: "Falha ao obter ou processar o HTML da URL inicial.",
                initialUrl: INITIAL_HTML_URL,
                details: error.message
            }),
        };
    }

    // --- 3. Baixar a imagem da URL real ---
    let imageBytes;
    let finalContentType;
    try {
        console.log(`Baixando imagem da URL real: ${realImageUrl}`);
        const imageResponse = await axios.get(realImageUrl, {
            responseType: 'arraybuffer' // Obter bytes
        });
        console.log("Download da imagem concluído. Status:", imageResponse.status);
        if (imageResponse.status >= 400) throw new Error(`Status ${imageResponse.status}`);

        imageBytes = imageResponse.data;
        finalContentType = imageResponse.headers['content-type']?.toLowerCase() || 'application/octet-stream';
        console.log("Tipo de conteúdo da imagem:", finalContentType);

        if (!ACCEPTABLE_IMAGE_TYPES.includes(finalContentType)) {
            console.warn(`Aviso: Tipo de conteúdo (${finalContentType}) não usualmente listado, mas prosseguindo.`);
        }
        if (!imageBytes || imageBytes.length === 0) {
            throw new Error("Download da imagem real resultou em dados vazios.");
        }

    } catch (error) {
        console.error("Erro na etapa 3 (Baixar Imagem Real):", error.message);
        return {
            statusCode: 502,
            body: JSON.stringify({
                error: "Falha ao baixar a imagem da URL extraída.",
                realImageUrl: realImageUrl,
                details: error.message
            }),
        };
    }

    // --- 4. Codificar em Base64 ---
    const imageBase64 = imageBytes.toString('base64');
    console.log("Imagem codificada em Base64.");

    // --- 5. Chamar a API Gemini ---
    try {
        console.log("Enviando imagem para análise do Gemini...");
        const imagePart = {
            inlineData: { data: imageBase64, mimeType: finalContentType }
        };

        const result = await model.generateContent([PROMPT, imagePart]); // Usa o PROMPT do evento
        const geminiResponse = await result.response;
        const analysisText = geminiResponse.text();

        console.log("Análise recebida do Gemini.");

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}, // CORS header
            body: JSON.stringify({
                message: "Análise da imagem concluída com sucesso.",
                initialUrl: INITIAL_HTML_URL,
                imageUrlUsed: realImageUrl,
                analysis: analysisText
            }),
        };

    } catch (error) {
        console.error("Erro na etapa 5 (Chamar API Gemini):", error);
        // Log específico do erro Gemini, se possível
        let errorDetails = error.message;
        if (error.response && error.response.data) {
            errorDetails = JSON.stringify(error.response.data);
            console.error("Detalhes do erro Gemini API:", errorDetails);
        }
        return {
            statusCode: 500, // Erro interno do servidor (nossa lógica ou Gemini)
            body: JSON.stringify({
                error: "Falha ao analisar a imagem com a API Gemini.",
                details: errorDetails
            }),
        };
    }
};