const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');  // Ensure the correct path
const authenticate = require('../middleware/authMiddleware'); // Import middleware

const router = express.Router();

// Test Protected Route (Requires Authentication)
router.get('/protected', authenticate, (req, res) => {
    res.json({ message: 'You have access to this protected route!', userId: req.userId });
});

// User Registration Route
router.post('/register', async (req, res) => {
    try {
        console.log("📩 Received register request:", req.body);
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const newUser = new User({ email, password });
        await newUser.save();

        console.log("✅ User registered:", email);
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error("⚠️ Registration error:", error);
        res.status(500).json({ message: 'Server error', error });
    }
});

// User Login Route
router.post('/login', async (req, res) => {
    try {
        console.log("📥 Received login request");

        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        // Set the token as an HTTP-only cookie
        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('token', token, {
            httpOnly: true, // Prevents JavaScript access
            secure: isProduction,   // HTTPS only in production
            sameSite: isProduction ? 'Strict' : 'Lax', // Avoid blocking local dev
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
        });

        console.log("🎉 Login successful for:", user.email);
        res.json({ message: 'Login successful', userId: user._id });
    } catch (error) {
        console.error("⚠️ Server error:", error);
        res.status(500).json({ message: 'Server error', error });
    }
});

// User Logout Route
router.post('/logout', (req, res) => {
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('token', {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'Strict' : 'Lax'
    });
    res.json({ message: 'Logged out successfully' });
});

module.exports = router;
