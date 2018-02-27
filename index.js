const serverless = require('serverless-http');
const express = require('express')
const morgan = require('morgan')
const bodyParser = require('body-parser')
const config = require('./config.json');
const http = require('http');
var session = require('express-session')
var passport = require('passport')
, util = require('util')
, Thirty7SignalsStrategy = require('passport-37signals').Strategy;

const { IncomingWebhook } = require('@slack/client');
const url = "https://hooks.slack.com/services/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";
const webhook = new IncomingWebhook(url);

const app = express();
app.use(morgan('combined'))
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(new Thirty7SignalsStrategy({
  clientID: config.THIRTY7SIGNALS_CLIENT_ID,
  clientSecret: config.THIRTY7SIGNALS_CLIENT_SECRET,
  callbackURL: "https://3txgz0knfb.execute-api.us-east-1.amazonaws.com/dev/auth/37signals/callback"
},
function(accessToken, refreshToken, profile, done) {
    process.nextTick(function () {

      // To keep the example simple, the user's 37signals profile is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the 37signals account with a user record in your database,
      // and return that user instead.
      return done(null, profile);
    });
  }
  ));


app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json());
app.use(session({resave: true, saveUninitialized: true, secret: 'very secret'}));
app.use(passport.initialize());
app.use(passport.session());

app.get('/auth/37signals',
  passport.authenticate('37signals'));

app.get('/auth/37signals/callback', 
  passport.authenticate('37signals', { failureRedirect: '/login' }),
  function(req, res) {
  });

app.post('/add', function (reqRelay, resRelay) {

  const options = {
    hostname: '3.basecampapi.com',
    port: 80,
    path: '/3959821/buckets/6735076/todolists/932727049',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  console.log(reqRelay.body);
  resRelay.send("Done");
/*const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  resRelay.sendStatus(res.statusCode);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
  res.on('end', () => {
    console.log('No more data in response.');
  });
});

req.on('error', (e) => {
  console.log(`problem with request: ${e.message}`);
});

// write dat  a to request body
req.write(reqRelay.body.text);
req.end();*/
});

app.post('/notif', function(reqRelay, resRelay) {
  const options = {
    hostname: 'hooks.slack.com',
    port: 80,
    path: '/services/T9EDMNGG2/B9EKSQ1GC/ivl9zH9MaWC2x1jIwKykojBp',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };
    if (reqRelay.body.kind === "todo_created"){
    var msg = 'To do created:'+reqRelay.body.recording.title;
    webhook.send(msg, function(err, res) {
    if (err) {
        console.log('Error:', err);
    } else {
        console.log('Message sent: ', res);
        resRelay.send({status: 200})
    }
   });
  } else {
    resRelay.send({status: 200});
  }
});

module.exports.handler = serverless(app);