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

// 2. Réception des événements (POST)
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'page') {
    body.entry.forEach(async (entry) => {
      
      // ----------------------------------------------------
      // CAS 1 : Traitement des commentaires sur les POSTS (feed)
      // ----------------------------------------------------
      if (entry.changes) {
        entry.changes.forEach(async (change) => {
          if (change.field === 'feed' && change.value.item === 'comment' && change.value.verb === 'add') {
            const commentId = change.value.comment_id;
            const commentText = change.value.message;
            const userPsid = change.value.from.id;

            console.log(`Nouveau commentaire [${commentId}] : ${commentText}`);

            // Analyse IA
            const analysis = await analyzeHateSpeech(commentText);
            console.log(`Analyse Gemini pour le commentaire "${commentText}" :`, analysis);

            if (analysis.isHate) {
              // 1. Masquer le commentaire haineux sur Facebook
              await hideFacebookComment(commentId);

              // 2. Répondre sous le commentaire ou envoyer un avertissement privé
              console.log(`Commentaire haineux masqué : ${commentId}. Reformulation : ${analysis.suggestion}`);
            }
          }
        });
      }

      // ----------------------------------------------------
      // CAS 2 : Traitement des messages privés (Messenger)
      // ----------------------------------------------------
      if (entry.messaging) {
        const webhook_event = entry.messaging[0];
        if (webhook_event && webhook_event.message && webhook_event.message.text) {
          const senderPsid = webhook_event.sender.id;
          const userMessage = webhook_event.message.text;

          console.log(`Message reçu de ${senderPsid} : ${userMessage}`);

          // Appeler le modèle IA Gemini pour analyser le message
          const analysis = await analyzeHateSpeech(userMessage);
          console.log(`Analyse Gemini pour le message "${userMessage}" :`, analysis);

          if (analysis.isHate) {
            const responseText = `⚠️ **Avertissement IA'ROVY**\n\nVotre message contient des propos déplacés ou haineux.\n\n💡 **Proposition de reformulation bienveillante :**\n"${analysis.suggestion}"`;
            await sendTextMessage(senderPsid, responseText);
          } else {
            // Si le message est correct, répondre avec le message conversationnel généré par l'IA
            const replyText = analysis.reply || `Merci pour votre message ! L'assistant IA'ROVY est actif.`;
            await sendTextMessage(senderPsid, replyText);
          }
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
    const prompt = `Tu es un modérateur expert et assistant conversationnel bienveillant pour le projet IA'ROVY à Madagascar.
Analyse le texte suivant qui peut être rédigé en Français, en Malgache ou en Frangasy.

Texte à analyser : "${text}"

Consignes :
1. Détermine si le texte contient du discours haineux, des insultes, du harcèlement ou de la discrimination.
2. Si le texte est haineux (isHate = true), propose une reformulation respectueuse et pédagogique dans le champ "suggestion", et laisse le champ "reply" vide ("").
3. Si le texte n'est pas haineux (isHate = false), laisse le champ "suggestion" vide (""), et génère une réponse chaleureuse, naturelle et fluide dans la même langue que l'utilisateur dans le champ "reply".`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash', 
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            isHate: { type: 'BOOLEAN' },
            suggestion: { type: 'STRING' },
            reply: { type: 'STRING' }
          },
          required: ['isHate', 'suggestion', 'reply']
        }
      },
    });

    const resultText = response.text;
    return JSON.parse(resultText);
  } catch (error) {
    console.error("Erreur lors de l'appel Gemini :", error);
    return { isHate: false, suggestion: '', reply: '' };
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
    console.log(`Message envoyé à ${senderPsid} : ${text}`);
  } catch (error) {
    console.error('Erreur d envoi Messenger :', error.response ? error.response.data : error.message);
  }
}

// Fonction pour MASQUER un commentaire haineux via Meta Graph API
async function hideFacebookComment(commentId) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${commentId}?access_token=${PAGE_ACCESS_TOKEN}`,
      { is_hidden: true }
    );
    console.log(`Le commentaire ${commentId} a été masqué publiquement.`);
  } catch (error) {
    console.error('Erreur lors du masquage du commentaire :', error.response ? error.response.data : error.message);
  }
}

app.listen(PORT, () => console.log(`Serveur IA'ROVY démarré sur le port ${PORT}`));