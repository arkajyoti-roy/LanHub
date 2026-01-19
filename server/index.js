const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const cors = require('cors');

// --- IMPORTS FROM MODULES ---
const userRoutes = require('./routes/userRoutes');
const { verifySocketToken } = require('./middleware/auth');
const { createDefaultAdmin } = require('./controllers/userController');
const TransferLog = require('./models/TransferLog'); // 📜 History Model

const app = express();

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- DATABASE CONNECTION ---
// Make sure MongoDB is running!
mongoose.connect('mongodb://127.0.0.1:27017/lanShareDB')
    .then(() => {
        console.log('✅ MongoDB Connected');
        createDefaultAdmin(); // Create 'admin' user if missing
    })
    .catch(err => console.log('❌ DB Error:', err.message));

// --- API ROUTES ---
// Login, Admin, and History routes live here
app.use('/api', userRoutes);

// --- SOCKET SERVER SETUP ---
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    maxHttpBufferSize: 1e8, // 100MB Packet Limit
    pingTimeout: 60000, 
    transports: ['websocket'], 
    perMessageDeflate: false // Disable compression for speed
});

// 🔒 SECURE SOCKET: Verify Token on Connection
io.use(verifySocketToken);

// --- REAL-TIME TRANSFER ENGINE ---
let onlineUsers = {}; 

io.on('connection', (socket) => {
    // socket.user is attached by verifySocketToken middleware
    // console.log(`🔌 Connected: ${socket.user.username}`);

    // Map Socket ID -> Username
    onlineUsers[socket.id] = socket.user.username;
    io.emit('users_update', onlineUsers);

    // 1. Request File Transfer
    socket.on('request_transfer', (data) => {
        if (io.sockets.sockets.get(data.to)) {
            io.to(data.to).emit('incoming_request', { from: socket.id, ...data });
        } else {
            io.to(socket.id).emit('user_offline', { id: data.to });
        }
    });

    // 2. Accept/Reject Response
    socket.on('response_transfer', (data) => {
        io.to(data.to).emit('request_response', { from: socket.id, ...data });
    });

    // 3. High-Speed Data Chunk Relay
    socket.on('file_chunk', (data) => {
        io.to(data.to).emit('receive_chunk', data);
    });
    
    // 4. Elastic Window Acknowledgement
    socket.on('window_ack', (data) => {
        io.to(data.to).emit('ack_received', data); 
    });

    // 5. Completion & HISTORY LOGGING 📜
    socket.on('transfer_completed', async (logData) => {
        // logData = { sender, receiver, fileName, fileSize, receiverId, ... }
        
        try {
            // Save to MongoDB
            await TransferLog.create({
                sender: logData.sender,
                receiver: logData.receiver, // Ensure Client sends Name, not ID
                fileName: logData.fileName,
                fileSize: logData.fileSize,
                status: 'Completed',
                timestamp: new Date()
            });
            // console.log(`💾 Log Saved: ${logData.fileName}`);
        } catch(e) {
            console.error("❌ Failed to save log:", e.message);
        }

        // Notify Receiver to finalize file
        io.to(logData.receiverId).emit('transfer_completed', logData);
    });

    // 6. Disconnect Handler
    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
        io.emit('users_update', onlineUsers);
    });
});

const PORT = 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 LAN Server Running on ${PORT}`));