require("dotenv").config();
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/budget-app';
const PORT = process.env.PORT || 3000;

mongoose.connect(MONGO_URI);
mongoose.connection.on('error', error => console.error('MongoDB connection error:', error));

require('./auth/auth');

const routes = require('./routes/routes');
const secureRoutes = require('./routes/secure-routes');
const transactionRoutes = require('./routes/transaction-routes');

const app = express();

app.use(helmet());
app.use(morgan('combined'));
app.use(express.json());
app.use(cors());

// Rate limiting on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/signup', authLimiter);
app.use('/login', authLimiter);

app.use('/', routes);
app.use('/user', passport.authenticate('jwt', { session: false }), secureRoutes);
app.use('/transactions', passport.authenticate('jwt', { session: false }), transactionRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use(function (err, req, res, next) {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}.`);
  });
}

module.exports = app;
