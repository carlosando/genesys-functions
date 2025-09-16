const axios = require('axios');
const qs = require('querystring');

/**
 * AWS Lambda handler for Genesys Cloud Function Data Action
 * Fetches an OAuth2 token using client_credentials grant type.
 */
exports.handler = async (event, context, callback) => {
  console.log("## Context: " + JSON.stringify(context));
  console.log("## Event: " + JSON.stringify(event));

  const {
    url,
    client_id,
    client_secret,
    scope,
    content_type,
    subscription_key
  } = event;

  if (!url || !client_id || !client_secret || !scope || !content_type || !subscription_key) {
    const error = new Error("Missing required input parameters.");
    console.error(error.message);
    return callback(error);
  }

  const requestBody = qs.stringify({
    grant_type: 'client_credentials',
    client_id,
    client_secret,
    scope
  });

  const headers = {
    'Content-Type': content_type,
    'Ocp-Apim-Subscription-Key': subscription_key
  };

  try {
    const response = await axios.post(url, requestBody, { headers });
    console.log("Token response: " + JSON.stringify(response.data));
    return response.data;
  } catch (error) {
    console.error("Token fetch failed:", error.message);
    if (error.response) {
      console.error("API error details:", JSON.stringify(error.response.data));
      return callback(new Error(`API error: ${JSON.stringify(error.response.data)}`));
    }
    return callback(error);
  }
};
