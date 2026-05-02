// routes/locationRoutes.js

const express = require('express');
const {
    deleteAllWalks,
    deleteWalk,
    listWalks,
    saveWalk,
} = require('../controllers/locationController');
const authenticate = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', authenticate, listWalks);
router.post('/', authenticate, saveWalk);
router.delete('/', authenticate, deleteAllWalks);
router.delete('/:walkId', authenticate, deleteWalk);

module.exports = router;
