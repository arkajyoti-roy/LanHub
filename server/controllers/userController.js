const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET } = require('../middleware/auth');

// Initialize Default Admin
const createDefaultAdmin = async () => {
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
        const hashedPassword = await bcrypt.hash('admin@123', 10);
        await User.create({
            username: 'admin',
            email: 'admin@local.host', // Default email
            password: hashedPassword,
            role: 'admin',
            isFirstLogin: false 
        });
        console.log('👑 Default Admin Created: admin / admin@local.host / admin@123');
    }
};

// --- AUTH FUNCTIONS ---

const login = async (req, res) => {
    try {
        // "identifier" can be username OR email
        const { identifier, password } = req.body;
        
        // Find user where username is identifier OR email is identifier
        const user = await User.findOne({ 
            $or: [{ username: identifier }, { email: identifier }] 
        });

        if (!user) return res.status(400).json({ message: "User not found" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(403).json({ message: "Invalid Password" });

        const token = jwt.sign(
            { id: user._id, username: user.username, role: user.role }, 
            JWT_SECRET, 
            { expiresIn: '24h' }
        );

        res.json({ token, role: user.role, isFirstLogin: user.isFirstLogin, username: user.username });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const changePassword = async (req, res) => {
    try {
        const { newPassword } = req.body;
        if (newPassword.length < 6) return res.status(400).json({ message: "Password too short" });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await User.findByIdAndUpdate(req.user.id, { 
            password: hashedPassword, 
            isFirstLogin: false 
        });
        
        res.json({ message: "Password updated successfully" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// --- ADMIN FUNCTIONS ---

const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}, '-password'); 
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const createUser = async (req, res) => {
    try {
        // Accept email in body
        const { username, email, role } = req.body; 
        const defaultPassword = 'user@123';
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
        
        const newUser = await User.create({
            username,
            email, // Save email
            password: hashedPassword,
            role: role || 'user',
            isFirstLogin: true
        });
        res.json(newUser);
    } catch (e) {
        res.status(400).json({ message: "User/Email already exists or invalid data" });
    }
};

const deleteUser = async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ message: "User deleted" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { createDefaultAdmin, login, changePassword, getAllUsers, createUser, deleteUser };