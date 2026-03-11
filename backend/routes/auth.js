const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/authMiddleware');

// Register
router.post('/register', async (req, res) => {
    try {
        const { username, password, publicKey, avatar, encryptedPrivateKey } = req.body;
        const items = await User.findOne({ username });
        if (items) return res.status(400).json({ message: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword, publicKey, avatar, encryptedPrivateKey });
        await newUser.save();

        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ message: 'User not found' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({
            token,
            username,
            publicKey: user.publicKey,
            avatar: user.avatar,
            encryptedPrivateKey: user.encryptedPrivateKey
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get User Public Key
router.get('/key/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ publicKey: user.publicKey });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Avatar
router.post('/update-avatar', authMiddleware, async (req, res) => {
    try {
        const { avatar } = req.body;
        const user = await User.findOneAndUpdate({ username: req.user.username }, { avatar }, { new: true });
        res.json({ success: true, avatar: user.avatar });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
