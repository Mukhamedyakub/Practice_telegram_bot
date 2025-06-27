const { handleMessage } = require("./lib/Telegram");

async function handler(req, method){
  const { body } = req;

  if (body) {
    // Pick any supported type of update
    const messageObj = body.message || body.callback_query || body.edited_message;
    
    if (messageObj) {
      await handleMessage(messageObj);
    } else {
      console.warn("⚠️ Unknown update type received:", body);
    }
  }

  return { status: 'ok' };
}


module.exports = { handler };
