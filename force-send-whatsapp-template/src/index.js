const axios = require("axios");

exports.handler = async (event, context) => {
  console.log("## Context: " + JSON.stringify(context));
  console.log("## Event: " + JSON.stringify(event));

  const {
    clientId,
    clientSecret,
    fromAddress,
    toAddress,
    responseId,
    bodyParameters
  } = event;

  const validBodyParameters = Array.isArray(bodyParameters) ? bodyParameters : [];
  console.log("## Sanitized bodyParameters:", JSON.stringify(validBodyParameters));

  const buildPayload = (useExistingActiveConversation) => ({
    fromAddress,
    toAddress,
    toAddressMessengerType: "whatsapp",
    useExistingActiveConversation,
    messagingTemplate: {
      responseId,
      bodyParameters: validBodyParameters.map((val, idx) => ({
        id: String(idx + 1),
        value: val
      }))
    }
  });

  try {
    // 1. Authenticate with Genesys Cloud (Region: sae1)
    const tokenResponse = await axios.post("https://login.sae1.pure.cloud/oauth/token", null, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      auth: {
        username: clientId,
        password: clientSecret
      },
      params: {
        grant_type: "client_credentials"
      }
    });

    const accessToken = tokenResponse.data.access_token;

    const endpoint = "https://api.sae1.pure.cloud/api/v2/conversations/messages/agentless";
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    };

    // 2. First attempt
    const payload1 = buildPayload(false);
    console.log("## First request body:", JSON.stringify(payload1, null, 2));

    try {
      const firstResponse = await axios.post(endpoint, payload1, { headers });
      return {
        success: true,
        attempt: 1,
        response: firstResponse.data
      };
    } catch (err) {
      const msg = err?.response?.data?.message || "";
      console.warn("## First attempt failed. Message:", msg);
      if (!msg.includes("An active conversation is already in progress")) {
        throw err;
      }
    }

    // 3. Retry with useExistingActiveConversation = true
    const payload2 = buildPayload(true);
    console.log("## Retrying with existing conversation. Request body:", JSON.stringify(payload2, null, 2));

    const secondResponse = await axios.post(endpoint, payload2, { headers });
    return {
      success: true,
      attempt: 2,
      response: secondResponse.data
    };

  } catch (error) {
    const errMsg = error.response?.data || error.message;
    console.error("## ERROR sending message:", JSON.stringify(errMsg));
    return {
      success: false,
      error: errMsg
    };
  }
};
