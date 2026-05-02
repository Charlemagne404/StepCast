// models/walk.js

const mongoose = require('mongoose');

const pointSchema = new mongoose.Schema({
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
}, { _id: false });

const walkSchema = new mongoose.Schema({
    clientId: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    podcastName: { type: String, required: true },
    podcastIndex: { type: Number, default: -1 },
    podcast: { type: mongoose.Schema.Types.Mixed, default: null },
    podcastFetchAdress: { type: String, default: '' },
    points: { type: [pointSchema], required: true },
    date: { type: Date, default: Date.now },
}, {
    timestamps: true,
});

walkSchema.index({ userId: 1, clientId: 1 }, { unique: true });

module.exports = mongoose.model('Walk', walkSchema);
