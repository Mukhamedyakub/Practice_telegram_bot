require("dotenv").config();
const axios = require("axios");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent";

async function analyzeImage(imageBase64) {
    if (!GEMINI_API_KEY) {
        throw new Error("Gemini API key not configured");
    }

    try {
        const response = await axios.post(
            `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
            {
                contents: [{
                    parts: [
                        {
                            text: "Please extract all numbers visible in this utility meter image. Return only the numbers in a clear format."
                        },
                        {
                            inline_data: {
                                mime_type: "image/jpeg",
                                data: imageBase64
                            }
                        }
                    ]
                }]
            }
        );

        const result = response.data.candidates[0].content.parts[0].text;
        return result;
    } catch (error) {
        console.error("Gemini API error:", error);
        throw new Error("Failed to analyze image");
    }
}

module.exports = { analyzeImage };