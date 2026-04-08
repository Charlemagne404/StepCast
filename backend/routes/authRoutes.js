const express = require('express');

const authenticate = require('../middleware/authMiddleware');
const {
    fetchContinentalAuth,
    forwardSetCookieHeaders,
    parseProxyResponseBody,
} = require('../utils/continentalAuth');

const router = express.Router();

const proxyAuthRequest = async (req, res, path, { method = req.method } = {}) => {
    try {
        const upstreamResponse = await fetchContinentalAuth(`/api/auth${path}`, {
            req,
            method,
            body: method === 'GET' || method === 'HEAD' ? undefined : req.body,
        });
        const payload = await parseProxyResponseBody(upstreamResponse);

        forwardSetCookieHeaders(upstreamResponse, res);
        return res.status(upstreamResponse.status).json(payload);
    } catch (error) {
        console.error(`Continental auth proxy failed for ${method} ${path}:`, error);
        return res.status(502).json({ message: 'Continental ID is unavailable right now.' });
    }
};

router.get('/protected', authenticate, (req, res) => {
    res.json({
        message: 'You have access to this protected route.',
        userId: req.userId,
    });
});

router.post('/register', (req, res) => proxyAuthRequest(req, res, '/register'));
router.post('/login', (req, res) => proxyAuthRequest(req, res, '/login'));
router.post('/refresh_token', (req, res) => proxyAuthRequest(req, res, '/refresh_token'));
router.post('/logout', (req, res) => proxyAuthRequest(req, res, '/logout'));
router.get('/me', (req, res) => proxyAuthRequest(req, res, '/me'));

module.exports = router;
