// routes/locationRoutes.js

const express = require('express');
const { saveWalk } = require('../controllers/locationController');
const authenticate = require('../middleware/authMiddleware');
const Walk = require('../models/walk');

const router = express.Router();

// POST /api/location
router.post('/', authenticate, saveWalk);

// GET /api/location
router.get('/', authenticate, async (req, res) => {
    try {
        const walks = await Walk.find({ userId: req.userId }).sort({ timestamp: -1 });
        res.json(walks);
    } catch (error) {
        console.error('Error fetching walks:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
