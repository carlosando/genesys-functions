// src/index.js

exports.handler = async (event, context, callback) => {
  console.log("## Context:", JSON.stringify(context));
  console.log("## Event:", JSON.stringify(event));

  const response = {
    hasPowerOutage: false,
    reason: '',
    originalCustomerId: event.customer_id || null
  };

  try {
    const { customer_id } = event;

    if (!customer_id || typeof customer_id !== 'string') {
      throw new Error("Invalid or missing 'customer_id'");
    }

    const lastChar = customer_id.trim().slice(-1);

    if (!/\d/.test(lastChar)) {
      throw new Error("The last character of customer_id must be a digit.");
    }

    const digit = parseInt(lastChar, 10);
    response.hasPowerOutage = digit % 2 === 0;
    response.reason = response.hasPowerOutage
      ? "Even digit detected — power outage reported."
      : "Odd digit detected — no power outage.";

    console.log("## Response:", JSON.stringify(response));
    return response;

  } catch (error) {
    console.error("## Error:", error.message);
    callback(error);
  }
};
