const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    maxHttpBufferSize: 1e8, // 100MB Packet Limit
    pingTimeout: 60000, 
    transports: ['websocket'], 
    perMessageDeflate: false // Disable compression for speed
});

// Optional DB
mongoose.connect('mongodb://127.0.0.1:27017/lanShareDB')
    .catch(err => console.log('DB Error (Ignore if offline):', err.message));

const TransferSchema = new mongoose.Schema({
    sender: String, receiver: String, fileName: String, fileSize: Number, timestamp: { type: Date, default: Date.now }
});
const TransferLog = mongoose.model('TransferLog', TransferSchema);

let users = {}; 

io.on('connection', (socket) => {
    console.log(`🔌 Connected: ${socket.id}`);

    socket.on('join', (name) => {
        users[socket.id] = name;
        io.emit('users_update', users);
    });

    // Request Transfer (With Zombie Check)
    socket.on('request_transfer', (data) => {
        if (io.sockets.sockets.get(data.to)) {
            io.to(data.to).emit('incoming_request', { from: socket.id, ...data });
        } else {
            io.to(socket.id).emit('user_offline', { id: data.to });
        }
    });

    // Response (Accept/Reject)
    socket.on('response_transfer', (data) => {
        io.to(data.to).emit('request_response', { from: socket.id, ...data });
    });

    // File Chunk Relay
    socket.on('file_chunk', (data) => {
        io.to(data.to).emit('receive_chunk', data);
    });
    
    // Acknowledgement Relay (CRITICAL FIX: Forwarding 'data' preserves transferId)
    socket.on('window_ack', (data) => {
        io.to(data.to).emit('ack_received', data); 
    });

    // Completion Signal
    socket.on('transfer_completed', async (logData) => {
        try { await TransferLog.create(logData); } catch(e) {}
        io.to(logData.receiverId).emit('transfer_completed', logData);
    });

    socket.on('disconnect', () => {
        delete users[socket.id];
        io.emit('users_update', users);
    });
});

const PORT = 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server Running on ${PORT}`));