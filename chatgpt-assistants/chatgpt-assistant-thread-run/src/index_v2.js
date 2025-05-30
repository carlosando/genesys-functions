// src/lambda-thread-run.js

const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  console.log("## Event: " + JSON.stringify(event));

  const { openAiApiKey, thread_id, assistant_id, user_message } = event;

  try {
    // Step 1: Add message to thread
    const messageResp = await fetch(`https://api.openai.com/v1/threads/${thread_id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        role: 'user',
        content: user_message
      })
    });

    if (!messageResp.ok) {
      const errorBody = await messageResp.text();
      throw new Error(`Error sending message: ${messageResp.status} - ${errorBody}`);
    }

    // Step 2: Run the assistant
    const runResp = await fetch(`https://api.openai.com/v1/threads/${thread_id}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        assistant_id
      })
    });

    const runData = await runResp.json();

    // Step 3: Poll for completion
    let status = runData.status;
    let run_id = runData.id;
    let attempts = 0;

    while (status !== 'completed' && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const statusResp = await fetch(`https://api.openai.com/v1/threads/${thread_id}/runs/${run_id}`, {
        headers: {
          'Authorization': `Bearer ${openAiApiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });

      const statusData = await statusResp.json();
      status = statusData.status;
      attempts++;
    }

    if (status !== 'completed') {
      throw new Error('Assistant execution did not complete in time.');
    }

    // Step 4: Get messages
    const messagesResp = await fetch(`https://api.openai.com/v1/threads/${thread_id}/messages`, {
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });

    const messagesData = await messagesResp.json();
    const lastMessage = messagesData.data?.find(msg => msg.role === 'assistant');

    return {
      reply: lastMessage?.content?.[0]?.text?.value || "No response"
    };

  } catch (error) {
    console.error("Execution failed:", error);
    throw new Error(`Lambda Error: ${error.message}`);
  }
};
