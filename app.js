
//todo:
//refresh tokens

var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var fs = require('fs')
var https = require('https')
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var bodyParser  = require('body-parser');
var properties = require('./properties.json');
var users = [];
var userAddingFirst = {};

const { check, validationResult } = require('express-validator');
const client_id = properties.client_id;
const client_secret = properties.client_secret;
const redirect_uri = (process.env.PORT) ? properties.redirect_uri_deploy : properties.redirect_uri_local;
const queue_password = properties.queue_password;
const playlist_id = properties.playlist_id;
const phone_id = properties.phone_id;
const mac_id = properties.mac_id;

var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};


var stateKey = 'spotify_auth_state';
var app = express();

app.use(express.static(__dirname + '/public'))
   .use(cors())
   .use(cookieParser())
   .use(express.urlencoded({ extended: true }))
   .use(bodyParser.json());

function getUsers(){
  console.log("Users currently logged in:")
  var i;
  for (i = 0;i < users.length; i++){
    console.log(users[i]);
  }
}

function printError(body, code){
  console.log("Error, " + code + ": "+ body);
}



app.post('/',[
  check('name').not().isEmpty(),
  check('password').not().isEmpty()
], function (req, res) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorArray = errors.array();
    var i;
    var errorResponse = {};
    for (i = 0; i < errorArray.length; i++){
      if (errorArray[i].param == 'name'){
        errorResponse.name = 'Please enter a name'
      }else if (errorArray[i].param == 'password'){
        errorResponse.password = 'Please enter a password'
      }
    }
    res.status(400);
    res.send(errorResponse);
    return;
  }
  const post = req.body;
  const name = post.name;
  const password = post.password;

  if (password === queue_password) {
    var response = {};
    response.user_id = name;
    res.cookie("user_id", response.user_id);
    res.status(200);
    res.send(response);
    return;
  } else {
    var errorResponse = {};
    errorResponse.password = "Incorrect Password";
    res.status(400);
    res.send(errorResponse);
    return;
  }
});




app.get('/login', function(req, res) {
  if (!req.cookies["user_id"]){
    res.status(400);
    res.send('you are not logged in');
    return;
  }
  var username = req.cookies["user_id"];
  users.push(username);
  userAddingFirst[username] = false;

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'user-read-private user-read-email playlist-modify-public user-read-currently-playing user-read-playback-state user-modify-playback-state';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', function(req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  getUsers();

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
            refresh_token = body.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        //console.log("access: " + access_token);
        //console.log("refresh: " + refresh_token);
        // we can also pass the token to the browser to make requests from there
        res.cookie("access_token", access_token);
        res.cookie("refresh_token", refresh_token);
        res.redirect('/#');
      } else {
        res.cookie("error", "invalid_token");
        res.redirect('/#');
      }
    });
  }
});

app.get('/refresh_token', function(req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});

app.post('/search', function(req, res) {
  if (!req.body.query){
    console.log('query is empty');
    return;
  }
  if (!req.body.access_token){
    console.log('no access token');
    return;
  }
  var query = querystring.stringify({
    q: req.body.query,
    type: 'track'
  });
  var access_token = req.body.access_token;

  console.log('performing search...' + query);

  var authOptions = {
    url: 'https://api.spotify.com/v1/search?' + query,
    headers: { 'Authorization': 'Bearer ' + access_token },
    json: true
  };

  request.get(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var songResults = body.tracks.items;
      var i;
      var finalResult = [];
      for (i = 0;i < songResults.length; i++){
        var songName = songResults[i].name;
        var songURI = songResults[i].uri;
        var artists = songResults[i].artists;
        var artistList = [];
        var j;
        for (j = 0;j < artists.length; j++){
          artistList.push(artists[j].name);
        }
        finalResult.push({name: songName, uri: songURI, artists: artistList});
      }
      res.send({
        result: finalResult
      });
    }else{
      console.log("Search error")
      printError(response.body, response.statusCode);
    }
  });

  return;
});

app.post('/addtoqueue', function(req, res) {
  if (!req.body.uri || !req.body.song || !req.body.artist){
    res.status(404);
    res.send({
      result: "Parameters empty"
    });
    return;
  }
  if (!req.body.access_token){
    res.status(404);
    res.send({
      result: "No access token"
    });
    return;
  }
  if (!req.cookies["user_id"]){
    res.status(404);
    res.send({
      result: "No user logged in"
    });
    return;
  }
  //temp fix, once db is up make sure this field is part of it and you can call it every time
  if (!users.includes(req.cookies["user_id"])){
    var username = req.cookies["user_id"];
    users.push(username);
    userAddingFirst[username] = false;
  }
  var query = querystring.stringify({
    uris: req.body.uri
  });
  var access_token = req.body.access_token;
  var song = req.body.song;
  var artist = req.body.artist;
  var username = req.cookies["user_id"];

  var addToQueueOptions = {
    url: 'https://api.spotify.com/v1/playlists/' + playlist_id + '/tracks?' + query,
    headers: { 'Authorization': 'Bearer ' + access_token },
    json: true
  };

  var getCurrentOptions = {
    url: 'https://api.spotify.com/v1/me/player/currently-playing',
    headers: { 'Authorization': 'Bearer ' + access_token },
    json: true
  };


  var getDeviceOptions = {
    url: 'https://api.spotify.com/v1/me/player/devices',
    headers: { 'Authorization': 'Bearer ' + access_token },
    json: true
  };

  var getCurrentlyPlaying = function() {
    request.get(getCurrentOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {
          //if body is null that means no avail devices
          if (body){
            addSongToQueue(body.is_playing);
          }else{
            res.status(404);
            res.send({
              result: "No available devices. Turn one on"
            });
          }
      }else if (!error && response.statusCode === 204) {
          console.log("No track is playing");
          addSongToQueue(false);
      }else{
        res.status(404);
        res.send({
          result: response.body.error.status + " " + response.body.error.message
        });
      }
      return;
    });
  };

  var addSongToQueue = function(isPlaying) {
    request.post(addToQueueOptions, function(error, response, body) {
        console.log("Adding " + song + " by " + artist + " to the queue");
        if (!error && response.statusCode === 201) {
          if (!isPlaying){
            userAddingFirst[username] = true;
            var playSongOptions = {
              url: 'https://api.spotify.com/v1/me/player/play',
              headers: { 'Authorization': 'Bearer ' + access_token },
              body:{"context_uri": "spotify:playlist:3MuLvWOj8FjiTywcjpE1IA"},
              json: true
            };
            playSong(playSongOptions);
          }else{
            res.send({
              result: "Added " + song + " by " + artist + " to the queue"
            });
          }
        }else{
          res.status(404);
          res.send({
            result: response.body.error.status + " " + response.body.error.message
          });
        }
        return;
    });
  };


  var playSong = function(playSongOptions){
    request.put(playSongOptions, function(error, response, body) {
      if (!error && response.statusCode === 204) {
        console.log("Playing " + song + " by " + artist + " from the queue");
        userAddingFirst[username] = false;
        res.send({
          result: "Added and now playing " + song + " by " + artist + " to the queue"
        });
      }else{
        res.status(404);
        res.send({
          result: response.body.error.status + " " + response.body.error.message + ", turn one on."
        });
      }
      return;
    });
  };


  getCurrentlyPlaying();
  return;
});

app.post('/queue', function(req, res) {
  if (!req.body.access_token) {
    console.log('no access token');
    return;
  }
  if (!req.cookies["user_id"]){
    res.status(404);
    res.send({
      result: "No user logged in"
    });
    return;
  }
  if (!users.includes(req.cookies["user_id"])){
    var username = req.cookies["user_id"];
    users.push(username);
    userAddingFirst[username] = false;
  }
  var access_token = req.body.access_token;
  var username = req.cookies["user_id"];
  var getQueueOptions = {
    url: 'https://api.spotify.com/v1/playlists/' + playlist_id + '/tracks',
    headers: {
      'Authorization': 'Bearer ' + access_token
    },
    json: true
  };

  var getCurrentOptions = {
    url: 'https://api.spotify.com/v1/me/player/currently-playing',
    headers: {
      'Authorization': 'Bearer ' + access_token
    },
    json: true
  };

  var duration, progress, id;

  var getQueue = function(){
    request.get(getQueueOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        getCurrentlyPlaying(body);
      }else{
        res.status(404);
        res.send({
          result: response.body.error.status + " " + response.body.error.message
        });
      }
      return;
    });
  };

  var getCurrentlyPlaying = function(queueBody) {
    request.get(getCurrentOptions, function(error, response, body) {
      if (!error && response.statusCode === 200 || response.statusCode === 204) {
        var isPlaying = (body) ? body.is_playing : null;
        if (body){
          duration = body.item.duration_ms;
          progress = body.progress_ms;
          if (progress > 0){
            id = body.item.id;
          }
        }else{
          res.status(400);
          res.send({
            result: "No available devices. Turn on one."
          });
          return;
        }

        if (body.is_playing && body.item != null){
          console.log("SOMETHING IS PLAYING");
        }else{
          console.log("NOTHING IS PLAYING");
        }

        var finalResult = [];
        var toDelete = [];
        var currTrackFound = false;

        finalResult.push({
            duration: duration,
            progress: progress,
            id: id
          });

        for (var i = 0; i < queueBody.items.length; i++) {
          var currTrack = queueBody.items[i].track;
          if (currTrackFound) {
            var songName = currTrack.name;
            var songURI = currTrack.uri;
            var artists = currTrack.artists;
            var artistString = "";
            for (var j = 0; j < artists.length; j++) {
              if (j > 0) {
                artistString += ', ';
              }
              artistString += artists[j].name;
            }
            finalResult.push({
              name: songName,
              uri: songURI,
              artists: artistString,
            });
          } else {
            if (currTrack.id == id) {
              currTrackFound = true;
              i--;
            }else{
              toDelete.push({"uri": currTrack.uri});
            }
          }
        }

        res.send({
          result: finalResult
        });

        var deleteOptions = {
          url: 'https://api.spotify.com/v1/playlists/' + playlist_id + '/tracks',
          body: {"tracks": toDelete},
          headers: {
            'Authorization': 'Bearer ' + access_token
          },
          json: true
        }

        console.log("addingFirstSong: " + userAddingFirst[username]);
        console.log("isPlaying: " + isPlaying);
        console.log("Progress: " + progress);
        console.log("ID: " + id);
        console.log("# songs to delete: " + toDelete.length);
        console.log("currTrackFound: " + currTrackFound);
        console.log();
        if (toDelete.length > 0 && !userAddingFirst[username] && (isPlaying || id === undefined)){
          deleteFromPlaylist(deleteOptions);
        }
      }else{
        res.status(404);
        res.send({
          result: response.body.error.status + " " + response.body.error.message
        });
      }
      return;
    });
  };

  var deleteFromPlaylist = function(deleteOptions){
    request.delete(deleteOptions, function(error, response, body){
      if (!error && response.statusCode === 200) {
          console.log("Successfully deleted songs!");
      }else{
        res.status(404);
        res.send({
          result: response.body.error.status + " " + response.body.error.message
        });
      }
      return;
    });
  };

  getQueue();
  return;
});

var port = process.env.PORT || 8081;
console.log('Listening on ' + port);
app.listen(port);
