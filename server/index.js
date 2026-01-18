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
    maxHttpBufferSize: 1e8, // 100MB Max Packet Size
    pingTimeout: 60000, 
    transports: ['websocket'], // Force WebSocket (Faster)
    perMessageDeflate: false   // 🚀 SPEED BOOST: Disable compression for binary files
});

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

    socket.on('request_transfer', (data) => {
        if (io.sockets.sockets.get(data.to)) {
            io.to(data.to).emit('incoming_request', { from: socket.id, ...data });
        } else {
            io.to(socket.id).emit('user_offline', { id: data.to });
        }
    });

    socket.on('response_transfer', (data) => io.to(data.to).emit('request_response', { from: socket.id, accepted: data.accepted }));

    socket.on('file_chunk', (data) => io.to(data.to).emit('receive_chunk', data));
    
    socket.on('window_ack', (data) => io.to(data.to).emit('ack_received', { offset: data.offset }));

    socket.on('transfer_completed', async (logData) => {
        try { await TransferLog.create(logData); } catch(e) {}
        io.to(logData.receiverId).emit('transfer_success', logData);
    });

    socket.on('disconnect', () => {
        delete users[socket.id];
        io.emit('users_update', users);
    });
});

server.listen(5000, '0.0.0.0', () => console.log(`🚀 High-Performance Server on 5000`));