// src/lambda-thread-create.js

const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  console.log("## Event: " + JSON.stringify(event));
  const { openAiApiKey } = event;

  try {
    const response = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    console.log("Thread created:", data);

    return {
      thread_id: data.id
    };
  } catch (error) {
    console.error("Thread creation failed:", error);
    throw new Error(`Lambda Error: ${error.message}`);
  }
};
