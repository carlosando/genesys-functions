// lambda-gemini-vision/index.js

const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");




// Função principal do Lambda Handler
exports.handler = async (event, context, callback) => {

    // --- Configuração ---
    // Obtenha a chave da API Gemini das variáveis de ambiente do Lambda
    // NUNCA coloque a chave diretamente no código!
    const GEMINI_API_KEY = event.GEMINI_API_KEY;
    const PUBLIC_IMAGE_URL = event.gcapi_public_url; // O URL público da imagem
    const GEMINI_MODEL = "gemini-1.5-flash"; // Ou gemini-1.5-pro-latest, etc.
    const PROMPT = event.prompt; // Seu prompt


    // Verificação inicial da chave da API
    if (!GEMINI_API_KEY) {
        throw new Error("Variável de ambiente GEMINI_API_KEY não definida.");
    }
    // Verificação inicial da chave da API
    if (!PROMPT) {
        throw new Error("Variável de ambiente prompt não definida.");
    }
    // Verificação inicial da chave da API
    if (!PUBLIC_IMAGE_URL) {
        throw new Error("Variável de ambiente gc_api_public_url não definida.");
    }

    // Inicializa o cliente Gemini
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    console.log("Iniciando análise da imagem:", PUBLIC_IMAGE_URL);


    let imageBytes;
    let contentType;

    // --- 1. Baixar a imagem do URL público ---
    try {
        console.log("Baixando imagem...");
        const response = await axios.get(PUBLIC_IMAGE_URL, {
            responseType: 'arraybuffer' // Importante para obter dados binários
        });

        // Verifica se o download foi bem-sucedido (Axios lança erro para status >= 400)
        console.log("Download concluído com sucesso. Status:", response.status);

        imageBytes = response.data; // Dados binários da imagem (Buffer no Node.js)
        contentType = response.headers['content-type'] || 'application/octet-stream'; // Pega o MIME type ou usa um default
        console.log("Tipo de conteúdo detectado:", contentType);
        console.log ("Resposta do Request", response);

        if (!imageBytes || imageBytes.length === 0) {
            throw new Error("Download resultou em dados de imagem vazios.");
        }

    } catch (error) {
        console.error("Erro ao baixar a imagem:", error.message);
        if (error.response) {
            console.error("Detalhes do erro HTTP:", { status: error.response.status, data: error.response.data ? error.response.data.toString() : 'N/A' }); // Tenta mostrar corpo do erro
        }
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: "Falha ao baixar a imagem do URL fornecido.",
                details: error.message
            }),
        };
    }

    // --- 2. Codificar a imagem em Base64 ---
    // O Node.js Buffer já tem o método toString('base64')
    const imageBase64 = imageBytes.toString('base64');
    console.log("Imagem codificada em Base64.");

    // --- 3. Chamar a API Gemini Vision ---
    try {
        console.log("Enviando imagem para análise do Gemini...");

        const imagePart = {
            inlineData: {
                data: imageBase64,
                mimeType: contentType // Usa o content_type detectado
            }
        };

        const result = await model.generateContent([PROMPT, imagePart]);
        const geminiResponse = await result.response; // Espera a Promise resolver
        const analysisText = geminiResponse.text(); // Pega o texto da resposta

        console.log("Análise recebida do Gemini.");

        // Retorna a análise com sucesso
        return {
            statusCode: 200,
            headers: { // Boa prática adicionar cabeçalhos CORS se for chamar via API Gateway de um frontend
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*", // Ajuste conforme necessário para segurança
                "Access-Control-Allow-Credentials": true
            },
            body: JSON.stringify({
                message: "Análise da imagem concluída com sucesso.",
                imageUrl: PUBLIC_IMAGE_URL,
                analysis: analysisText
            }),
        };

    } catch (error) {
        console.error("Erro ao chamar a API Gemini:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: "Falha ao analisar a imagem com a API Gemini.",
                details: error.message
            }),
        };
    }
};