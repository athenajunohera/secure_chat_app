const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    room: { type: String, required: true, index: true },
    sender: { type: String, required: true },
    content: { type: String, required: true }, // Encrypted or plaintext
    isEncrypted: { type: Boolean, default: false },
    status: { type: String, enum: ['sent', 'read'], default: 'sent' },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', MessageSchema);
