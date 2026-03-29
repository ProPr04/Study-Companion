import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export const generateNotesFromChunk = async (chunk) => {
  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant", // fast + free tier friendly
      messages: [
        {
          role: "system",
          content: "You are a helpful study assistant.",
        },
        {
          role: "user",
          content: `
Convert the following text into concise study notes:
- Use bullet points
- Keep it simple and clear
- Highlight key concepts
- Avoid unnecessary details

TEXT:
${chunk}
          `,
        },
      ],
      temperature: 0.5,
    });

    return response.choices[0].message.content;

  } catch (error) {
    console.error("Groq AI error:", error);
    throw new Error("AI generation failed");
  }
};