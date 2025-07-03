const axios = require("axios");

async function analyzeImage(base64Image) {
    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                contents: [{
                    parts: [
                        { text: "Extract the first 5 digits (numbers only) from this utility meter image. Just return the numbers." },
                        { 
                            inline_data: { 
                                mime_type: "image/jpeg",  // исправлено с image/png
                                data: base64Image 
                            } 
                        }
                    ]
                }]
            }
        );

        const text = response.data.candidates[0].content.parts[0].text.trim();
        console.log("🔍 Gemini response:", text);
        return text;

    } catch (error) {
        console.error("Gemini API error:", error.response?.data || error.message);
        return null;
    }
}

module.exports = { analyzeImage };
