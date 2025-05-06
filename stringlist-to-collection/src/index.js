exports.handler = async (event, context, callback) => {
    console.log("## Context: " + JSON.stringify(context));
    console.log("## Event: " + JSON.stringify(event));

    try {
        const inputString = event.inputCitiesString;

        if (!inputString || typeof inputString !== 'string') {
            throw new Error("inputCitiesString is required and must be a string.");
        }

        let citiesArray;

        try {
            citiesArray = JSON.parse(inputString);
        } catch (parseError) {
            throw new Error("Failed to parse inputCitiesString. It must be a valid JSON array string.");
        }

        if (!Array.isArray(citiesArray)) {
            throw new Error("Parsed value is not an array.");
        }

        const response = {
            cities: citiesArray
        };

        console.log("## Response: " + JSON.stringify(response));
        return response;

    } catch (error) {
        console.error("## Handler failed: " + error.message);
        callback(error);
    }
};
