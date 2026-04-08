// models/walk.js

const mongoose = require('mongoose');

const walkSchema = new mongoose.Schema({
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    userId: { type: String, required: true, index: true },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Walk', walkSchema);
