# Enchanted Chat (Secure E2E Chat App)

A beautifully animated, fully secure End-to-End Encrypted real-time messaging application with an Ethereal Painterly aesthetic.

## Features
- **Military-Grade End-to-End Encryption:** Messages are encrypted locally on the device using AES-GCM and RSA-OAEP. The keys are dynamically generated on registration and stored securely in local browser storage—the database never sees unencrypted data!
- **Real-Time WebSockets:** Instant communication with animated typing indicators and online statuses, powered by Socket.io.
- **Ethereal Aesthetic UI:** Immersive CSS particle effects (cherry blossoms/petals slowly falling), glassy frosted interfaces, animated gradients, and dynamic painting backgrounds.
- **WhatsApp-Style Inputs:** Full emoji keyboard integrations and encrypted image attachments (using local base64 decoding under 2MB).
- **Read Receipts & Optimistic UI:** Messages instantly appear for the sender, and read-statuses bounce back flawlessly.

## Tech Stack
- Frontend: React (Vite), Tailwind CSS v4, Socket.io-client, node-forge (Crypto)
- Backend: Node.js, Express, Socket.io, Mongoose/MongoDB

## Installation
*(Make sure Node.js is installed)*

1. Navigate to the `backend` folder and run: `npm install`
2. Navigate to the `frontend` folder and run: `npm install`
3. In `backend`, create a `.env` file with your `MONGO_URI` (MongoDB connection string).
4. Run the backend: `npm start`
5. Run the frontend: `npm run dev`

## Deployment
See the provided `netlify.toml` for standard Netlify build settings. Point the Frontend's `.env` to the hosted Backend URL.
