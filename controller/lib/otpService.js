require("dotenv").config();

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendSMS(phone, message) {
    // This is a placeholder for SMS service integration
    // You can integrate with services like Twilio, SMS.ru, etc.
    console.log(`SMS to ${phone}: ${message}`);
    
    // For development, you can use a mock service or console log
    // In production, implement actual SMS sending logic
    return true;
}

module.exports = { generateOTP, sendSMS };