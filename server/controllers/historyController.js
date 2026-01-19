const TransferLog = require('../models/TransferLog');

const getUserHistory = async (req, res) => {
    try {
        const username = req.user.username;
        // Find transfers where the user was either the sender OR the receiver
        const logs = await TransferLog.find({
            $or: [{ sender: username }, { receiver: username }]
        }).sort({ timestamp: -1 }); // Newest first

        res.json(logs);
    } catch (err) {
        res.status(500).json({ message: "Error fetching history" });
    }
};

module.exports = { getUserHistory };