// controllers/locationController.js

const Walk = require('../models/walk');

exports.saveWalk = async (req, res) => {
    const { latitude, longitude } = req.body;
    const { userId } = req;

    try {
        const walk = new Walk({ latitude, longitude, userId });
        await walk.save();
        res.status(200).json({ message: 'Walk saved successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error saving walk data.', error });
    }
};


