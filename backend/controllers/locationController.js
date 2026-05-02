// controllers/locationController.js

const Walk = require('../models/walk');

const normalizePoint = (point) => {
    const lat = Number(point?.lat);
    const lng = Number(point?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
    }

    return { lat, lng };
};

const sanitizeWalkPayload = (body = {}) => {
    const clientId = String(body.id || body.clientId || '').trim();
    const podcastName = String(body.podcastName || '').trim();
    const points = Array.isArray(body.points)
        ? body.points.map(normalizePoint).filter(Boolean)
        : [];

    if (!clientId) {
        return { error: 'Walk id is required.' };
    }

    if (!podcastName) {
        return { error: 'Podcast name is required.' };
    }

    if (points.length === 0) {
        return { error: 'At least one route point is required.' };
    }

    const date = body.date ? new Date(body.date) : new Date();

    return {
        walk: {
            clientId,
            podcastName,
            podcastIndex: Number.isFinite(Number(body.podcastIndex)) ? Number(body.podcastIndex) : -1,
            podcast: body.podcast && typeof body.podcast === 'object' ? body.podcast : null,
            podcastFetchAdress: String(body.podcastFetchAdress || ''),
            points,
            date: Number.isNaN(date.getTime()) ? new Date() : date,
        },
    };
};

const serializeWalk = (walk) => ({
    id: walk.clientId,
    clientId: walk.clientId,
    podcastName: walk.podcastName,
    podcastIndex: walk.podcastIndex,
    podcast: walk.podcast,
    podcastFetchAdress: walk.podcastFetchAdress,
    points: walk.points,
    date: walk.date?.toISOString?.() || walk.date,
    updatedAt: walk.updatedAt?.toISOString?.() || walk.updatedAt,
});

exports.listWalks = async (req, res) => {
    try {
        const walks = await Walk.find({ userId: req.userId }).sort({ date: -1, updatedAt: -1 });
        return res.json(walks.map(serializeWalk));
    } catch (error) {
        console.error('Error fetching walks:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

exports.saveWalk = async (req, res) => {
    const { error, walk } = sanitizeWalkPayload(req.body);
    if (error) {
        return res.status(400).json({ message: error });
    }

    try {
        const savedWalk = await Walk.findOneAndUpdate(
            { userId: req.userId, clientId: walk.clientId },
            { $set: { ...walk, userId: req.userId } },
            {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true,
            },
        );

        return res.status(200).json({
            message: 'Walk synced successfully.',
            walk: serializeWalk(savedWalk),
        });
    } catch (error) {
        console.error('Error saving walk data:', error);
        return res.status(500).json({ message: 'Error saving walk data.' });
    }
};

exports.deleteWalk = async (req, res) => {
    const clientId = String(req.params.walkId || '').trim();
    if (!clientId) {
        return res.status(400).json({ message: 'Walk id is required.' });
    }

    try {
        await Walk.deleteOne({ userId: req.userId, clientId });
        return res.json({ message: 'Walk deleted.' });
    } catch (error) {
        console.error('Error deleting walk:', error);
        return res.status(500).json({ message: 'Error deleting walk.' });
    }
};

exports.deleteAllWalks = async (req, res) => {
    try {
        await Walk.deleteMany({ userId: req.userId });
        return res.json({ message: 'Walk library cleared.' });
    } catch (error) {
        console.error('Error clearing walks:', error);
        return res.status(500).json({ message: 'Error clearing walks.' });
    }
};
