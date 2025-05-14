// File: src/index.js

/**
 * Genesys Function Data Action Lambda
 * Busca por municípios similares em um estado (UF) usando a API do IBGE
 */

const https = require('https');

exports.handler = async (event, context, callback) => {
  console.log("## Context:", JSON.stringify(context));
  console.log("## Event:", JSON.stringify(event));

  const { estado, municipioBusca } = event;

  if (!estado || !municipioBusca) {
    return callback(new Error("Parâmetros 'estado' e 'municipioBusca' são obrigatórios."));
  }

  const url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estado}/municipios`;

  try {
    const municipios = await fetchMunicipios(url);

    const similares = municipios
      .filter(m => m.nome.toLowerCase().includes(municipioBusca.toLowerCase()))
      .map(m => m.nome);

    const response = {
      municipiosEncontrados: similares
    };

    console.log("## Resultado:", JSON.stringify(response));
    return response;

  } catch (error) {
    console.error("Erro na execução da função:", error);
    callback(error);
  }
};

function fetchMunicipios(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(new Error("Erro ao parsear JSON da resposta do IBGE."));
        }
      });
    }).on('error', (e) => {
      reject(new Error(`Erro ao chamar API do IBGE: ${e.message}`));
    });
  });
}
