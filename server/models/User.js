const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true }, // Added Email
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    isFirstLogin: { type: Boolean, default: true }
});

module.exports = mongoose.model('User', UserSchema);