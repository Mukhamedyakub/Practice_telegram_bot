const { handleMessage } = require("./lib/Telegram")

async function handler(req, method){
  const { body } = req;
  if (body) {
    const messageObj = body.message || body.callback_query;
    await handleMessage(messageObj);
  }
  return { status: 'ok' };
}

module.exports = { handler };