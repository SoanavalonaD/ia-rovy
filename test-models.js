const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function checkModels() {
  const models = await ai.models.list();
  console.log("Modèles disponibles :");
  for await (const model of models) {
    console.log(model.name);
  }
}

checkModels();