exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return json(204, {});
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error('Missing DEEPSEEK_API_KEY on Netlify');
    return json(500, { error: { message: 'Missing DEEPSEEK_API_KEY on Netlify' } });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    return json(400, { error: 'Invalid JSON body' });
  }

  const system = String(payload.system || '').slice(0, 2000);
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const safeMessages = messages
    .filter((msg) => msg && ['user', 'assistant'].includes(msg.role))
    .slice(-12)
    .map((msg) => ({
      role: msg.role,
      content: String(msg.content || '').slice(0, 1200),
    }));

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 800,
        temperature: 0.6,
        messages: [{ role: 'system', content: system }, ...safeMessages],
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('DeepSeek API error', response.status, JSON.stringify(data).slice(0, 1000));
      return json(response.status, {
        error: { message: data.error?.message || data.message || `DeepSeek HTTP ${response.status}` },
      });
    }

    return json(200, {
      choices: [
        {
          message: {
            content: data.choices?.[0]?.message?.content || '抱歉，暂时无法回答，请稍后再试。',
          },
        },
      ],
    });
  } catch (error) {
    console.error('DeepSeek request failed', error);
    return json(502, { error: { message: error.message || 'DeepSeek request failed' } });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}
