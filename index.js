const express = require('express');
const passport = require('passport');
const compression = require('compression');
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
const handlers = require('./handlers.js');

const GOOGLE_STRATEGY_DATA = {
  clientID: '61830357-tpm9ldrcegn7u40llinlb0jh0ldem086.apps.googleusercontent.com',
  clientSecret: 'W9NWeKTtdpIqCUOThTA4mGkU',
  callbackURL: 'http://localhost:8080/auth/google/callback'
};

const GOOGLE_PERMISSION_SCOPES = [
  'email',
  'https://www.googleapis.com/auth/calendar.readonly'
];

const app = express();
app.set('query parser', 'simple');
app.use(compression());
app.use(passport.initialize());
passport.serializeUser((user, done) => { done(null, user); });
passport.deserializeUser((user, done) => { done(null, user); });
passport.use(new GoogleStrategy(GOOGLE_STRATEGY_DATA, handlers.handleStrategy));

// MAIN ENDPOINTS
app.use('/', express.static('public'));
app.get('/dashboard', (req, res) => res.send('very dashboard')); //remove?

// AUTH ENDPOINTS
app.get('/login', (req, res) => res.redirect('/auth/google'));
app.get('/auth/google', passport.authenticate('google', { scope: GOOGLE_PERMISSION_SCOPES }));
app.get('/auth/google/callback', passport.authenticate('google'), handlers.handleCallback);

// EVENT MANAGMENT ENDPOINTS
app.get('/create', handlers.createPost);
app.post('/create', (req, res) => res.send({ 'err': 'use GET instead' }));

// MEETING ENDPOINTS
app.get('/meeting/:id', handlers.handleMeetingData);
app.post('/meeting/:id/join', handlers.handleJoinEvent);
app.post('/meeting/:id/end', handlers.handleEndEvent);

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`App running at ${port}...`);
});
