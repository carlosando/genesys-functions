/**
 * Genesys Cloud Function Handler
 * @param event - Input values
 * @param context - Execution context
 * @param callback - Error callback
 */
exports.handler = async (event, context, callback) => {
    try {
        const fetch = (await import("node-fetch")).default;

        const { cep } = event;
        if (!cep) {
            throw new Error("CEP é obrigatório");
        }

        // Buscar endereço pelo ViaCEP
        const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        if (!viaCepResponse.ok) {
            throw new Error("Erro ao consultar ViaCEP");
        }
        const endereco = await viaCepResponse.json();
        if (endereco.erro) {
            throw new Error("CEP inválido");
        }

        const { localidade, uf } = endereco;
        const geocodeResponse = await fetch(`https://nominatim.openstreetmap.org/search?city=${localidade}&state=${uf}&country=Brazil&format=json&limit=1`);
        if (!geocodeResponse.ok) {
            throw new Error("Erro ao obter coordenadas");
        }
        const geocodeData = await geocodeResponse.json();
        if (geocodeData.length === 0) {
            throw new Error("Não foi possível obter coordenadas para esse CEP");
        }

        const { lat, lon } = geocodeData[0];
        const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=America/Sao_Paulo`);
        if (!weatherResponse.ok) {
            throw new Error("Erro ao obter previsão do tempo");
        }
        const weatherData = await weatherResponse.json();

        const response = {
            endereco: endereco.logradouro ? `${endereco.logradouro}, ${endereco.bairro}, ${localidade} - ${uf}` : `${localidade} - ${uf}`,
            previsao_tempo: weatherData.current_weather,
        };

        console.log("Function completed successfully", response);
        return callback(null, response);
    } catch (error) {
        console.error("Handler failed", error);
        return callback(error);
    }
};
