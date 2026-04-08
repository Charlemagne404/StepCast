require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const https = require('https');
const http = require('http');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/authRoutes');  
const locationRoutes = require('./routes/locationRoutes'); // Ensure this is correct

const app = express();

app.use(cookieParser());  // Middleware to parse cookies
app.use(express.json());  // Middleware for parsing JSON requests

// Database Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('Failed to connect to MongoDB:', err));

// CORS Configuration
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://127.0.0.1:5500')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/location', locationRoutes); // Ensure this is correct

// Start server (HTTPS if certs provided, otherwise HTTP)
const PORT = process.env.PORT || 5001;
const sslKeyPath = process.env.SSL_KEY_PATH;
const sslCertPath = process.env.SSL_CERT_PATH;

const handleServerError = (err, protocol) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Set PORT to a free port and try again.`);
        console.error(`Example: PORT=5001 node server.js`);
    } else {
        console.error(`Error starting ${protocol} server:`, err);
    }
    process.exit(1);
};

if (sslKeyPath && sslCertPath && fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
    const sslOptions = {
        key: fs.readFileSync(sslKeyPath),
        cert: fs.readFileSync(sslCertPath)
    };
    const server = https.createServer(sslOptions, app);
    server.on('error', (err) => handleServerError(err, 'HTTPS'));
    server.listen(PORT, () => {
        console.log(`🚀 HTTPS Server is running on port ${PORT}`);
    });
} else {
    const server = http.createServer(app);
    server.on('error', (err) => handleServerError(err, 'HTTP'));
    server.listen(PORT, () => {
        console.log(`🚀 HTTP Server is running on port ${PORT}`);
    });
}
