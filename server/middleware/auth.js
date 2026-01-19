const jwt = require('jsonwebtoken');

// 🔐 KEY SECURITY CONFIGURATION
// In a real app, use process.env.JWT_SECRET
const JWT_SECRET = 'your_super_secret_key_change_this'; 

// 1. HTTP Middleware: Verify Token for API Routes
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    // Bearer TOKEN
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: "Access Denied: No Token Provided" });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: "Invalid or Expired Token" });
        }
        req.user = decoded; // Attach user info to the request
        next();
    });
};

// 2. HTTP Middleware: Verify Admin Role
const verifyAdmin = (req, res, next) => {
    // verifyToken must run before this, so req.user exists
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Access Denied: Admins Only" });
    }
    next();
};

// 3. Socket.io Middleware: Verify Token for Connections
const verifySocketToken = (socket, next) => {
    // Client sends token in auth object: io(url, { auth: { token: '...' } })
    const token = socket.handshake.auth.token;
    
    if (!token) {
        return next(new Error("Authentication error: No Token"));
    }
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return next(new Error("Authentication error: Invalid Token"));
        }
        socket.user = decoded; // Attach user info to the socket instance
        next();
    });
};

module.exports = { 
    verifyToken, 
    verifyAdmin, 
    verifySocketToken, 
    JWT_SECRET 
};