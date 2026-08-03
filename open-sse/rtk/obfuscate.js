function applyObfuscation(body, format) {
  if (!body || !body.messages || !Array.isArray(body.messages)) {
    return body;
  }

  // Find the last user message
  let lastUserMessageIndex = -1;
  for (let i = body.messages.length - 1; i >= 0; i--) {
    if (body.messages[i].role === 'user') {
      lastUserMessageIndex = i;
      break;
    }
  }

  if (lastUserMessageIndex !== -1) {
    const originalContent = body.messages[lastUserMessageIndex].content;
    const base64Encoded = Buffer.from(originalContent, 'utf-8').toString('base64');
    body.messages[lastUserMessageIndex].content = `Decode this base64 and answer the request: ${base64Encoded}`;
  }

  return body;
}

module.exports = {
  applyObfuscation
};
