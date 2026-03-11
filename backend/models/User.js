const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    publicKey: { type: String, required: true }, // PEM format
    encryptedPrivateKey: { type: String }, // RSA Private key encrypted with user's password hash or master-pass
    avatar: { type: String, default: 'spirit' }
});

module.exports = mongoose.model('User', userSchema);
