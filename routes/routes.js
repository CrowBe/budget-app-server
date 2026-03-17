const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const secret = process.env.JWT_SECRET;

const signupValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').trim().notEmpty().withMessage('Name is required'),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

router.post('/signup', signupValidation, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  passport.authenticate('signup', { session: false }, async (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res.status(400).json({ error: info?.message || 'Signup failed' });
    }
    return res.status(201).json({
      message: 'Signup successful',
      user: { name: user.name, email: user.email },
    });
  })(req, res, next);
});

router.post('/login', loginValidation, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  passport.authenticate('login', { session: false }, async (err, user, info) => {
    try {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ error: info?.message || 'Authentication failed' });
      }

      req.login(user, { session: false }, async (error) => {
        if (error) return next(error);
        const body = { _id: user._id, email: user.email };
        const token = jwt.sign({ user: body }, secret, { expiresIn: '7d' });
        return res.json({ user: { name: user.name, email: user.email, token } });
      });
    } catch (error) {
      return next(error);
    }
  })(req, res, next);
});

module.exports = router;
