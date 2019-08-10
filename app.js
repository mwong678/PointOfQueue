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


var port = process.env.PORT || 8081;

var app = express();

var https_redirect = function (req, res, next) {
  if (req.headers["x-forwarded-proto"] === "https") {
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
  keys: [(isProduction) ? process.env.secret : properties.secret]
}));
/*
app.use(session({
  secret: (isProduction) ? process.env.secret : properties.secret,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: isProduction },
  store: new MongoStore()
}));
*/

app.use('/', routes);

mongo.connectToServer(function(err, client) {
 if (err) console.log(err);
 myDB = mongo.getDb();
 userCollection = myDB.collection("users");
 roomCollection = myDB.collection("rooms");

 var deleteRoomHelper = async function(code) {
  await roomCollection.deleteOne({
   code: code
  }, (err, result) => {
   if (err) {
    throw err;
   }
  });
 }

 //deleteRoom2('nEIV');
 //deleteRoom2('wcLN');
 //deleteRoomHelper('lCu7');

/*
 userCollection.find().toArray((err, items) => {
  //console.log(items);
 });
 */

 roomCollection.find().toArray((err, items) => {
  console.log(items);
 });

 setInterval(async () => {await background.updateQueues()}, 1000);
 app.listen(port, () => console.log('Listening on ' + port));
});
