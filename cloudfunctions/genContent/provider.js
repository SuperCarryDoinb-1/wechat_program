const https = require('node:https');

function createProvider(cloud, env, request = https.request) {
  const mode = env.AITI_AI_PROVIDER || (env.AITI_AI_KEY ? 'compatible' : 'mock');
  if (mode === 'mock' || (mode === 'compatible' && !env.AITI_AI_KEY)) return { mode: 'mock' };
  return {
    mode: 'model',
    async generate(messages) {
      if (!env.AITI_AI_MODEL) throw new Error('MODEL_NOT_CONFIGURED');
      if (mode === 'cloudbase') {
        if (typeof cloud.ai !== 'function') throw new Error('AI_SDK_UNAVAILABLE');
        const result = await cloud.ai().createModel('cloudbase').generateText({ model: env.AITI_AI_MODEL, messages });
        return result.text;
      }
      if (mode !== 'compatible' || !env.AITI_AI_KEY) throw new Error('PROVIDER_NOT_CONFIGURED');
      const endpoint = new URL(env.AITI_AI_ENDPOINT || 'https://api.deepseek.com/chat/completions');
      if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) throw new Error('INVALID_ENDPOINT');
      const body = JSON.stringify({ model: env.AITI_AI_MODEL, messages, stream: false,
        max_tokens: 512, response_format: { type: 'json_object' } });
      return new Promise((resolve, reject) => {
        let timer;
        const req = request(endpoint, { method: 'POST', headers: {
          'Content-Type': 'application/json', Authorization: `Bearer ${env.AITI_AI_KEY}`,
          'Content-Length': Buffer.byteLength(body)
        } }, res => {
          let text = '', bytes = 0;
          if (res.statusCode < 200 || res.statusCode >= 300) {
            res.resume(); clearTimeout(timer); reject(new Error('MODEL_HTTP_FAILED')); return;
          }
          res.setEncoding('utf8');
          res.on('data', chunk => {
            bytes += Buffer.byteLength(chunk);
            if (bytes > 65536) { req.destroy(new Error('MODEL_RESPONSE_TOO_LARGE')); return; }
            text += chunk;
          });
          res.on('error', error => { clearTimeout(timer); reject(error); });
          res.on('end', () => {
            clearTimeout(timer);
            try {
              const data = JSON.parse(text);
              const choice = data.choices && data.choices[0];
              if (!choice || choice.finish_reason !== 'stop') throw new Error('MODEL_INCOMPLETE');
              resolve(choice.message.content);
            } catch (_) { reject(new Error('MODEL_RESPONSE_INVALID')); }
          });
        });
        timer = setTimeout(() => req.destroy(new Error('MODEL_TIMEOUT')), 2800);
        req.on('error', error => { clearTimeout(timer); reject(error); });
        req.end(body);
      });
    }
  };
}
module.exports = { createProvider };
