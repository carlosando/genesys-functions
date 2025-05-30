const fetch = require('node-fetch');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

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
      body: JSON.stringify({ role: 'user', content: user_message })
    });

    if (!messageResp.ok) throw new Error(`Message Error: ${await messageResp.text()}`);

    // Step 2: Run assistant
    const runResp = await fetch(`https://api.openai.com/v1/threads/${thread_id}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({ assistant_id })
    });

    const runData = await runResp.json();
    let { id: run_id, status } = runData;

    // Step 3: Optimized polling (with backoff)
    let attempts = 0;
    let waitTime = 1000;
    const maxAttempts = 5;

    while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
      await delay(waitTime);
      waitTime *= 2;
      attempts++;

      const pollResp = await fetch(`https://api.openai.com/v1/threads/${thread_id}/runs/${run_id}`, {
        headers: {
          'Authorization': `Bearer ${openAiApiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });

      const pollData = await pollResp.json();
      status = pollData.status;
    }

    if (status !== 'completed') {
      throw new Error(`Run status did not complete in time. Final status: ${status}`);
    }

    // Step 4: Get final assistant message
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

  } catch (err) {
    console.error("Execution failed:", err);
    throw new Error(`Lambda Error: ${err.message}`);
  }
};
