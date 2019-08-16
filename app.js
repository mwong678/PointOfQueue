const express = require('express'),
      request = require('request'),
      cors = require('cors'),
      querystring = require('querystring'),
      cookieParser = require('cookie-parser'),
      cookieSession = require('cookie-session'),
      bodyParser = require('body-parser');

const isProduction = process.env.NODE_ENV === 'production';
const routes = require('./routes');
const mongo = require('./db/mongo');
const background = require('./util/background');
const properties = (isProduction) ? '' : require('./properties.json');
const logger = require('./util/logger');


var port = process.env.PORT || 8081;

var app = express();

var https_redirect = function (req, res, next) {
  if (req.headers['x-forwarded-proto'] === 'https') {
    next();
  } else {
    if (isProduction){
      res.redirect('https://' + req.headers.host + req.url);
    }else{
      next();
    }
  }
};

app.use(cors());
app.use(https_redirect);
app.use(express.static(__dirname + '/public'));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('trust proxy', 1);
app.use(cookieSession({
  name: 'session',
  secret: (isProduction) ? process.env.secret : properties.secret,
  maxAge: 24 * 60 * 60 * 1000,
  cookies: {secure: isProduction}
}));
app.use('/', routes);

mongo.connectToServer(function(err, client) {
 if (err) logger.log(err, 'error');

 //mongo.deleteRoom('LjHo');
 mongo.getAllRooms().then(function(result){
   logger.log('START OF ROOM REPORT');
   result.forEach((room) => {
     logger.log(`${room.code} -> ${room.playlist}`);
   });
   if (result.length == 0) logger.log('NO ROOMS')
   logger.log('END OF ROOM REPORT');
 })

 setInterval(async () => {await background.updateQueues()}, 1000);
 app.listen(port, () => logger.log(`Started Point Of Queue on port: ${port}`));
});
