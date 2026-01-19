const mongoose = require('mongoose');

const TransferLogSchema = new mongoose.Schema({
    sender: { type: String, required: true },     // Username of sender
    receiver: { type: String, required: true },   // Username of receiver
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    status: { type: String, enum: ['Completed', 'Failed'], default: 'Completed' },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TransferLog', TransferLogSchema);