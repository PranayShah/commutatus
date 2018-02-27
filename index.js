const serverless = require('serverless-http');
const express = require('express')
const morgan = require('morgan')
const bodyParser = require('body-parser')
const config = require('./config.json');
const https = require('https');
var session = require('express-session')
var passport = require('passport')
, util = require('util')
, Thirty7SignalsStrategy = require('passport-37signals').Strategy;

const { IncomingWebhook } = require('@slack/client');
const url = "https://hooks.slack.com/services/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";
const webhook = new IncomingWebhook(url);

const AWS = require('aws-sdk');
const dynamoDb = new AWS.DynamoDB.DocumentClient();

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
}, function(accessToken, refreshToken, profile, done) {
  const params = {
    TableName: process.env.USERS_TABLE,
    Item: {
      id: '1', accessToken: accessToken, refreshToken: refreshToken
    }
  };
  dynamoDb.put(params, (error) => {
    if (error) console.error(error)
      else {
        done(null, profile);
      } 
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
  const addToBaseCamp = function(token) {
    const options = {
      hostname: '3.basecampapi.com',
      path: '/3959821/buckets/6735076/todolists/932727049/todos.json',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': 'Bearer '+ token,
        'User-Agent': 'Slackbot (pranayv.shah@st.niituniversity.in)'
      }
    };
    const req = https.request(options, (res) => {
      console.log(`STATUS: ${res.statusCode}`);
      console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
      if (res.statusCode < 400) resRelay.sendStatus(200);
      else {
        resRelay.send("Failed syncing with BaseCamp")
      }
    });

    req.on('error', (e) => {
      console.log(`problem with request: ${e.message}`);
    });
    req.write(JSON.stringify({'content':reqRelay.body.text}));
    req.end();
  }
  const getAuthorization = () => resRelay.send('You need to try again after authorizing yourself: https://launchpad.37signals.com/authorization/new?client_id=7fbcda1ca5ec67e91c22cd332896d29cbe8ca5f7&redirect_uri=https%3A%2F%2F3txgz0knfb.execute-api.us-east-1.amazonaws.com%2Fdev%2Fauth%2F37signals%2Fcallback&type=web_server');
  const params = {
    TableName: process.env.USERS_TABLE,
    Key: {
      id: '1',
    }
  };
  dynamoDb.get(params, (error, result) => {
    if (error || !result || !result.Item.accessToken) {
      console.error("Error",error);
      getAuthorization();
    }
    else {
      addToBaseCamp(result.Item.accessToken);
    }
  });
});

app.post('/notif', function(reqRelay, resRelay) {
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