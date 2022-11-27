const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const router = express.Router();

const secret = process.env.JWT_SECRET;

router.post(
  '/signup',
  async (req, res, next) => {
    passport.authenticate('signup', { session: false, failureRedirect: '/signup', failureMessage: true },    
      async (err, user) => {
        return res.json({
          message: 'Signup successful',
          user: {name: user.name, email: user.email}
        });
      }
      )(req, res, next);
    }
);

router.post(
    '/login',
    async (req, res, next) => {
      passport.authenticate(
        'login', { session: false, failureRedirect: '/signup', failureMessage: true },
        async (err, user, info) => {
          try {
            if (err || !user) {
              const error = new Error('An error occurred.');
                
              return next(error);
            }
  
            req.login(
              user,
              { session: false },
              async (error) => {
                if (error) return next(error);
  
                const body = { _id: user._id, email: user.email };
                const token = jwt.sign({ user: body }, secret);
  
                return res.json({ user: {name: user.name, email: user.email, token: token} });
              }
            );
          } catch (error) {
            return next(error);
          }
        }
      )(req, res, next);
    }
);


module.exports = router;