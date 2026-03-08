const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const Message = require('./models/Message');

dotenv.config();

const allowedOrigins = [
    /^https:\/\/.*\.netlify\.app$/,  // any netlify subdomain
    /^http:\/\/localhost:\d+$/,       // any localhost port
    /^http:\/\/127\.0\.0\.1:\d+$/,   // localhost IP
    /^http:\/\/192\.168\.\d+\.\d+:\d+$/, // Local LAN
    /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,  // Local LAN
];

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl)
        if (!origin) return callback(null, true);
        const allowed = allowedOrigins.some(pattern => pattern.test(origin));
        if (allowed) return callback(null, true);
        return callback(new Error(`CORS blocked: ${origin}`));
    },
    methods: ["GET", "POST"],
    credentials: true,
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: corsOptions
});

const authRoutes = require('./routes/auth');
const authMiddleware = require('./middleware/authMiddleware');

app.use(cors(corsOptions));
app.use(express.json());

// Database connection
console.log('Attempting to connect to the Realm (MongoDB)...');
mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
})
    .then(() => {
        console.log('✅ MAGIC SUCCESS: Connected to the Realm (MongoDB)');
    })
    .catch(err => {
        console.error('❌ DARK MAGIC ERROR: Failed to reach the Realm!');
        console.error('Reason:', err.message);
    });

// Middleware to check DB connection
const checkDB = (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
            error: "The Realm is not yet open. (Database connection issue). Please check the backend console for the secret fix!"
        });
    }
    next();
};

app.use('/api/auth', checkDB, authRoutes);

// Get messages for a room (General)
app.get('/api/messages/room/:room', authMiddleware, async (req, res) => {
    try {
        const { room } = req.params;
        const messages = await Message.find({ room }).sort({ timestamp: 1 }).limit(100);
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get DM messages between two users
app.get('/api/messages/dm', authMiddleware, async (req, res) => {
    try {
        const { user1, user2 } = req.query;
        // Check if the requesting user is either user1 or user2
        if (req.user.username !== user1 && req.user.username !== user2) {
            return res.status(403).json({ message: 'Unauthorized access to DMs' });
        }

        // Find messages where (sender=user1 AND room=user2) OR (sender=user2 AND room=user1)
        const messages = await Message.find({
            $or: [
                { sender: user1, room: user2 },
                { sender: user2, room: user1 }
            ]
        }).sort({ timestamp: 1 }).limit(100);
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Socket.io logic
const onlineUsers = new Map(); // Map<socket.id, username>

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('join_app', (username) => {
        socket.join(username); // Join personal room for DMs
        socket.join('general'); // Join general chat

        onlineUsers.set(socket.id, username);
        console.log(`User ${username} joined app`);

        // Broadcast unique online users list
        const uniqueUsers = Array.from(new Set(onlineUsers.values()));
        io.emit('online_users', uniqueUsers);
    });

    socket.on('join_room', (room) => {
        socket.join(room);
        console.log(`User ${socket.id} joined room: ${room}`);
    });

    socket.on('send_message', async (data) => {
        // data: { room, author, encryptedData, isEncrypted, time }

        // Save to DB
        try {
            const newMessage = new Message({
                room: data.room,
                sender: data.author,
                content: typeof data.encryptedData === 'object' ? JSON.stringify(data.encryptedData) : data.encryptedData,
                isEncrypted: data.isEncrypted
            });
            await newMessage.save();
        } catch (err) {
            console.error("Error saving message", err);
        }

        if (data.room === 'general') {
            io.to('general').emit('receive_message', { ...data, status: 'sent' });
        } else {
            // DM: Send to recipient's room
            io.to(data.room).emit('receive_message', { ...data, status: 'sent' });
        }
    });

    // Typing Indicators
    socket.on('typing', (data) => {
        // data: { room, username }
        socket.to(data.room).emit('user_typing', data);
    });

    socket.on('stop_typing', (data) => {
        // data: { room, username }
        socket.to(data.room).emit('user_stop_typing', data);
    });

    // Mark as Read
    socket.on('mark_read', async (data) => {
        // data: { messageIds, room, reader }
        try {
            await Message.updateMany(
                { _id: { $in: data.messageIds }, room: data.reader },
                { $set: { status: 'read' } }
            );
            // Notify the sender that messages were read
            socket.to(data.room).emit('messages_read', { room: data.reader, reader: data.reader });
        } catch (err) {
            console.error("Error marking messages as read", err);
        }
    });

    // Public Key Exchange
    socket.on('register_public_key', (data) => {
        // data: { username, publicKey }
        // Broadcast key to everyone so they can cache it
        socket.broadcast.emit('user_public_key', data);
    });

    socket.on('disconnect', () => {
        const username = onlineUsers.get(socket.id);
        if (username) {
            onlineUsers.delete(socket.id);
            const uniqueUsers = Array.from(new Set(onlineUsers.values()));
            io.emit('online_users', uniqueUsers);
        }
        console.log('User disconnected', socket.id);
    });
});

const PORT = process.env.PORT || 5050;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✨ PORTAL OPEN: The Realm is listening on port ${PORT}`);
    console.log(`🔗 Local Access: http://localhost:${PORT}`);
});
