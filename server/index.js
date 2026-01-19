const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const cors = require('cors');

// Import Modules
const userRoutes = require('./routes/userRoutes');
const { verifySocketToken } = require('./middleware/auth');
const { createDefaultAdmin } = require('./controllers/userController');

const app = express();
app.use(cors());
app.use(express.json());

// --- DATABASE CONNECTION ---
mongoose.connect('mongodb://127.0.0.1:27017/lanShareDB')
    .then(() => {
        console.log('✅ MongoDB Connected');
        createDefaultAdmin(); // Ensure admin exists
    })
    .catch(err => console.log('DB Error:', err.message));

// --- API ROUTES ---
app.use('/api', userRoutes);

// --- SOCKET SERVER SETUP ---
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    maxHttpBufferSize: 1e8,
    pingTimeout: 60000,
    transports: ['websocket'],
    perMessageDeflate: false
});

// Middleware: Secure the Socket connection
io.use(verifySocketToken);

// --- SOCKET LOGIC (Transfer Engine) ---
// Note: We keep transfer logic here or move to a separate 'socketHandler.js'
// For now, keeping it here is fine as it's separate from User logic.

const TransferSchema = new mongoose.Schema({
    sender: String, receiver: String, fileName: String, fileSize: Number, timestamp: { type: Date, default: Date.now }
});
const TransferLog = mongoose.model('TransferLog', TransferSchema);

let onlineUsers = {}; 

io.on('connection', (socket) => {
    // console.log(`🔌 ${socket.user.username} Connected (${socket.id})`);
    
    onlineUsers[socket.id] = socket.user.username;
    io.emit('users_update', onlineUsers);

    socket.on('request_transfer', (data) => {
        if (io.sockets.sockets.get(data.to)) {
            io.to(data.to).emit('incoming_request', { from: socket.id, ...data });
        } else {
            io.to(socket.id).emit('user_offline', { id: data.to });
        }
    });

    socket.on('response_transfer', (data) => io.to(data.to).emit('request_response', { from: socket.id, ...data }));
    socket.on('file_chunk', (data) => io.to(data.to).emit('receive_chunk', data));
    socket.on('window_ack', (data) => io.to(data.to).emit('ack_received', data));
    
    socket.on('transfer_completed', async (logData) => {
        try { await TransferLog.create(logData); } catch(e) {}
        io.to(logData.receiverId).emit('transfer_completed', logData);
    });

    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
        io.emit('users_update', onlineUsers);
    });
});

const PORT = 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Modular Server Running on ${PORT}`));