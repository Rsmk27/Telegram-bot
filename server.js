const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Load Environment Variables (Set these in Render Dashboard)
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const MANI_BACKEND_URL = "https://project-mani-c0t3.onrender.com/api/chat";
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

// Simple in-memory session history tracker
const chatHistories = {};

// Health Check Endpoint
app.get('/', (req, res) => {
    res.json({ status: "Telegram Bridge is live 🚀" });
});

// Telegram Webhook Endpoint
app.post('/telegram-webhook', async (req, res) => {
    // 1. Instantly acknowledge Telegram to prevent infinite retries
    res.sendStatus(200);

    const body = req.body;

    // 2. Process Telegram Business messages
    if (body.business_message) {
        const msg = body.business_message;
        const chatId = msg.chat.id;
        const userQuery = msg.text;
        const connectionId = msg.business_connection_id; // CRITICAL field

        if (!userQuery) return; // Skip stickers, images, or media files

        // 3. Handle Chat History Array state
        if (!chatHistories[chatId]) {
            chatHistories[chatId] = [];
        }
        const history = chatHistories[chatId];

        try {
            // 4. Send request to your Mani Core backend
            const response = await axios.post(MANI_BACKEND_URL, {
                query: userQuery,
                siteContext: "User is chatting via Telegram Business integration.",
                history: history
            });

            const botReply = response.data.response;

            // 5. Deliver the reply back to the user via Telegram Business channel
            await axios.post(`${TELEGRAM_API}/sendMessage`, {
                business_connection_id: connectionId,
                chat_id: chatId,
                text: botReply
            });

            // 6. Update local history array
            history.push({ role: "user", content: userQuery });
            history.push({ role: "assistant", content: botReply });

            // Keep conversation context lean (trim older history if it exceeds 10 rounds)
            if (history.length > 20) history.splice(0, 2);

        } catch (error) {
            console.error("Error routing message:", error.response?.data || error.message);
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bridge listening on port ${PORT}`));
