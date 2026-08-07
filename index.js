const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'votre_token_secret_ici';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// 1. Validation du Webhook (GET) - Nécessaire pour l'écran Facebook actuel
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

// 2. Réception des événements (POST) - Pour recevoir les messages
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'page') {
    body.entry.forEach(async (entry) => {
      const webhook_event = entry.messaging[0];
      if (webhook_event && webhook_event.message) {
        const senderPsid = webhook_event.sender.id;
        const userMessage = webhook_event.message.text;

        console.log(`Message reçu de ${senderPsid}: ${userMessage}`);

        // TODO: Appeler ici votre modèle IA pour analyser le texte
        // Pour le test, on renvoie une réponse automatique
        await sendTextMessage(senderPsid, `Message reçu : "${userMessage}"`);
      }
    });
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// Envoi de message via Meta Graph API
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
    console.error('Erreur d envoi:', error.response ? error.response.data : error.message);
  }
}

app.listen(PORT, () => console.log(`Serveur prêt sur le port ${PORT}`));