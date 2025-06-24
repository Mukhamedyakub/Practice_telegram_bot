const { axiosInstance } = require("./axios");

function sendMessage(messageObj, messageText){
  return axiosInstance.get("sendMessage", {
    chat_id: messageObj.chat.id,
    text: messageText,
  });
}

function handleMessage(messageObj){
  if (!messageObj || typeof messageObj !== "object" || !messageObj.chat || !messageObj.text) {
    console.warn("⚠️ Invalid message object received:", messageObj);
    return;
  }

  const messageText = messageObj.text;

  if (messageText.startsWith("/")) {
    const command = messageText.substring(1);
    switch (command) {
      case "start":
        return sendMessage(messageObj, "Hi! I'm a bot. I can help you to get started");
      default:
        return sendMessage(messageObj, "Hey hi, I don't know that command");
    }
  }

  return sendMessage(messageObj, messageText);
}



module.exports = { handleMessage };