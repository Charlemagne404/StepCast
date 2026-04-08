const DEFAULT_CONTINENTAL_AUTH_BASE_URL = 'https://auth.continental-hub.com';
const DEFAULT_TIMEOUT_MS = 15000;

const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');

const parseTimeoutMs = (value, fallback = DEFAULT_TIMEOUT_MS) => {
    const parsed = Number.parseInt(String(value || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getContinentalAuthBaseUrl = () =>
    trimTrailingSlash(process.env.CONTINENTAL_AUTH_BASE_URL || DEFAULT_CONTINENTAL_AUTH_BASE_URL);

const buildContinentalAuthUrl = (path) => {
    const normalizedPath = String(path || '').startsWith('/') ? path : `/${path}`;
    return `${getContinentalAuthBaseUrl()}${normalizedPath}`;
};

const buildForwardHeaders = (req, extraHeaders = {}) => {
    const headers = {};
    const headerNames = [
        'authorization',
        'content-type',
        'cookie',
        'origin',
        'referer',
        'user-agent',
        'x-forwarded-for',
        'x-forwarded-proto',
    ];

    for (const headerName of headerNames) {
        const value = req?.headers?.[headerName];
        if (value) {
            headers[headerName] = value;
        }
    }

    return {
        ...headers,
        ...extraHeaders,
    };
};

const fetchContinentalAuth = async (path, { req, method = 'GET', body, headers = {} } = {}) => {
    if (typeof fetch !== 'function') {
        throw new Error('Global fetch is not available in this Node.js runtime.');
    }

    const controller = new AbortController();
    const timeoutMs = parseTimeoutMs(process.env.CONTINENTAL_AUTH_TIMEOUT_MS);
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const requestHeaders = buildForwardHeaders(req, headers);
        const requestInit = {
            method,
            headers: requestHeaders,
            signal: controller.signal,
        };

        if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
            if (!requestHeaders['content-type']) {
                requestHeaders['content-type'] = 'application/json';
            }
            requestInit.body =
                typeof body === 'string' || body instanceof Buffer
                    ? body
                    : JSON.stringify(body);
        }

        return await fetch(buildContinentalAuthUrl(path), requestInit);
    } finally {
        clearTimeout(timeoutId);
    }
};

const parseProxyResponseBody = async (response) => {
    const text = await response.text();
    if (!text) {
        return {};
    }

    try {
        return JSON.parse(text);
    } catch {
        return { message: text };
    }
};

const forwardSetCookieHeaders = (upstreamResponse, res) => {
    const cookies =
        typeof upstreamResponse.headers.getSetCookie === 'function'
            ? upstreamResponse.headers.getSetCookie()
            : [];

    if (cookies.length > 0) {
        res.setHeader('Set-Cookie', cookies);
        return;
    }

    const singleCookie = upstreamResponse.headers.get('set-cookie');
    if (singleCookie) {
        res.setHeader('Set-Cookie', singleCookie);
    }
};

const extractContinentalUserId = (payload) => {
    const candidates = [
        payload?.user?.id,
        payload?.user?._id,
        payload?.id,
        payload?._id,
        payload?.userId,
        payload?.continentalId,
    ];

    for (const candidate of candidates) {
        const normalized = String(candidate || '').trim();
        if (normalized) {
            return normalized;
        }
    }

    return '';
};

module.exports = {
    buildContinentalAuthUrl,
    extractContinentalUserId,
    fetchContinentalAuth,
    forwardSetCookieHeaders,
    getContinentalAuthBaseUrl,
    parseProxyResponseBody,
};
