const axios = require('axios');
require('dotenv').config();

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

if (!PAGE_ACCESS_TOKEN) {
  console.error("Erreur : PAGE_ACCESS_TOKEN n'est pas défini dans le fichier .env.");
  process.exit(1);
}

async function subscribePage() {
  try {
    console.log("1. Récupération des informations de la Page...");
    const meResponse = await axios.get(`https://graph.facebook.com/v19.0/me?access_token=${PAGE_ACCESS_TOKEN}`);
    const pageId = meResponse.data.id;
    const pageName = meResponse.data.name;
    console.log(`Page identifiée : ${pageName} (ID: ${pageId})`);

    console.log("2. Liaison de la Page à l'application Facebook (souscription aux webhooks)...");
    const subscribeResponse = await axios.post(
      `https://graph.facebook.com/v19.0/${pageId}/subscribed_apps`,
      {
        subscribed_fields: ['feed', 'messages']
      },
      {
        params: {
          access_token: PAGE_ACCESS_TOKEN
        }
      }
    );

    if (subscribeResponse.data.success) {
      console.log("✅ Succès ! La Page est désormais abonnée aux webhooks (feed et messages).");
    } else {
      console.log("⚠️ Réponse inattendue de l'API Facebook :", subscribeResponse.data);
    }
  } catch (error) {
    console.error("❌ Erreur lors de la liaison de la page :", error.response ? error.response.data : error.message);
  }
}

subscribePage();
