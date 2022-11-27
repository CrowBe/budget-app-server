require("dotenv").config();
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cors = require('cors');

mongoose.connect("mongodb://127.0.0.1:27017/passport-jwt");
mongoose.connection.on('error', error => console.log(error) );
mongoose.Promise = global.Promise;

require('./auth/auth');

const routes = require('./routes/routes');
const secureRoutes = require('./routes/secure-routes');

const app = express();

app.use(morgan('combined'))

app.use(bodyParser.json());

app.use(cors())

app.use('/', routes);

// Plug in the JWT strategy as a middleware so only verified users can access this route.
app.use('/user', passport.authenticate('jwt', { session: false }), secureRoutes);


// Handle errors.
app.use(function(err, req, res, next) {
  console.log(err)
  res.status(err.status || 500);
  res.json({ error: err });
});

const port = process.env.PORT
app.listen(port, () => {
  console.log(`Server started on port ${port}.`)
});