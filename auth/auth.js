const passport = require('passport');
const localStrategy = require('passport-local').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const UserModel = require('../models/user');

const secret = process.env.JWT_SECRET;

passport.use(
  'signup',
  new localStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
      passReqToCallback: true,
    },
    async (req, email, password, done) => {
      const { name } = req.body;
      try {
        const user = await UserModel.create({ email, password, name });
        return done(null, user);
      } catch (error) {
        // Duplicate email produces code 11000
        if (error.code === 11000) {
          return done(null, false, { message: 'Email already registered' });
        }
        return done(error);
      }
    }
  )
);

passport.use(
  'login',
  new localStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
    },
    async (email, password, done) => {
      try {
        const user = await UserModel.findOne({ email });
        if (!user) {
          return done(null, false, { message: 'User not found' });
        }

        const validate = await user.isValidPassword(password);
        if (!validate) {
          return done(null, false, { message: 'Wrong password' });
        }

        return done(null, user, { message: 'Logged in successfully' });
      } catch (error) {
        return done(error);
      }
    }
  )
);

const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: secret,
};

passport.use(
  new JwtStrategy(opts, async (token, done) => {
    try {
      return done(null, token.user);
    } catch (error) {
      return done(error);
    }
  })
);
