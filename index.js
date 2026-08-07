const express = require('express');
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// Initialisation du client Google Gen AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 1. Validation du Webhook (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === VERIFY_TOKEN) {
    console.log('WEBHOOK_VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// 2. Réception des événements Messenger (POST)
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'page') {
    body.entry.forEach(async (entry) => {
      const webhook_event = entry.messaging[0];
      if (webhook_event && webhook_event.message && webhook_event.message.text) {
        const senderPsid = webhook_event.sender.id;
        const userMessage = webhook_event.message.text;

        console.log(`Message reçu de ${senderPsid} : ${userMessage}`);

        // Appeler le modèle IA Gemini pour analyser le message
        const analysis = await analyzeHateSpeech(userMessage);

        if (analysis.isHate) {
          const responseText = `⚠️ **Avertissement IA'ROVY**\n\nVotre message contient des propos déplacés ou haineux.\n\n💡 **Proposition de reformulation bienveillante :**\n"${analysis.suggestion}"`;
          await sendTextMessage(senderPsid, responseText);
        } else {
          // Si le message est correct, répondre normalement ou laisser passer
          await sendTextMessage(senderPsid, `Merci pour votre message ! L'assistant IA'ROVY est actif.`);
        }
      }
    });
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

/**
 * Fonction d'analyse du discours haineux via Gemini 2.5 Flash
 */
async function analyzeHateSpeech(text) {
  try {
    const prompt = `Tu es un modérateur expert pour le projet IA'ROVY à Madagascar.
Analyse le texte suivant qui peut être rédigé en Français, en Malgache ou en Frangasy.

Texte à analyser : "${text}"

Consignes :
1. Détermine si le texte contient du discours haineux, des insultes, du harcèlement ou de la discrimination.
2. Si le texte est haineux, propose une reformulation respectueuse et pédagogique.
3. Réponds UNIQUEMENT sous forme de JSON strict :
{
  "isHate": true ou false,
  "suggestion": "votre reformulation ici (ou chaine vide si isHate est false)"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // <-- UTILISEZ CE NOM EXACT
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const resultText = response.text;
    return JSON.parse(resultText);
  } catch (error) {
    console.error("Erreur lors de l'appel Gemini :", error);
    return { isHate: false, suggestion: '' };
  }
}

// Fonction d'envoi de message via Meta Graph API
async function sendTextMessage(senderPsid, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: senderPsid },
        message: { text: text }
      }
    );
  } catch (error) {
    console.error('Erreur d envoi Messenger :', error.response ? error.response.data : error.message);
  }
}

app.listen(PORT, () => console.log(`Serveur IA'ROVY démarré sur le port ${PORT}`));