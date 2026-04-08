const {
    extractContinentalUserId,
    fetchContinentalAuth,
    parseProxyResponseBody,
} = require('../utils/continentalAuth');

const authenticate = async (req, res, next) => {
    const header = String(req.headers.authorization || '');
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ message: 'Authorization token required.' });
    }

    try {
        const upstreamResponse = await fetchContinentalAuth('/api/auth/me', { req });
        const payload = await parseProxyResponseBody(upstreamResponse);

        if (!upstreamResponse.ok) {
            if (upstreamResponse.status === 401) {
                return res.status(401).json({ message: payload.message || 'Token invalid or expired.' });
            }

            return res.status(502).json({ message: 'Continental ID could not validate this session.' });
        }

        const userId = extractContinentalUserId(payload);
        if (!userId) {
            return res.status(502).json({ message: 'Continental ID response did not include a user id.' });
        }

        req.userId = userId;
        req.user = payload.user || payload;
        req.continentalAuth = payload;
        return next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(502).json({ message: 'Continental ID is unavailable right now.' });
    }
};

module.exports = authenticate;
