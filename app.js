/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */

var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var bodyParser  = require('body-parser');
var properties = require('./properties.json');
var users = [];

const { check, validationResult } = require('express-validator');
const client_id = properties.client_id;
const client_secret = properties.client_secret;
const redirect_uri = properties.redirect_uri;
const queue_password = properties.queue_password;
const playlist_id = properties.playlist_id;
const phone_id = properties.phone_id;

var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};


var stateKey = 'spotify_auth_state';
var addingState = false;

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
    response.user_id = name + "_" + generateRandomString(3);
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

  users.push(req.cookies["user_id"]);

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
      printError(response.body, response.statusCode);
    }
  });

  return;
});

app.post('/addtoqueue', function(req, res) {
  if (!req.body.uri || !req.body.song || !req.body.artist){
    console.log('parameters empty');
    return;
  }
  if (!req.body.access_token){
    console.log('no access token');
    return;
  }
  var query = querystring.stringify({
    uris: req.body.uri
  });
  var access_token = req.body.access_token;
  var song = req.body.song;
  var artist = req.body.artist;

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

  var playSongOptions = {
    url: 'https://api.spotify.com/v1/me/player/play',
    headers: { 'Authorization': 'Bearer ' + access_token },
    body:{"context_uri": "spotify:playlist:44nsrEcSso0RZ9DiOWRmEk"},
    json: true
  };

  request.get(getCurrentOptions, function(error, response, body) {
    if (!error && response.statusCode === 200 || response.statusCode === 204) {
        var isPlaying = (body) ? body.is_playing : null;
        request.post(addToQueueOptions, function(error, response, body) {

          //hypothetically, if the time between adding to the queue and
          //playing it is too long, then the song will be deleted
          // (time between adding/playing) needs to be < (time to get queuelist + time to getcurrentsong)
          //this is observed and expected, however
          console.log("Adding " + song + " by " + artist + " to the queue");
          addingState = true;

          if (!error && response.statusCode === 201) {
            if (!isPlaying){
              request.put(playSongOptions, function(error, response, body) {
                if (!error && response.statusCode === 204) {
                  console.log("Playing " + song + " by " + artist + " from the queue");
                }else{
                  console.log(response.body);
                  printError(response.body, response.statusCode);
                }
              });
            }else{
              console.log("Song added, queue continues");
            }

            res.send({
              result: "Added " + song + " by " + artist + " to the queue"
            });
          }else{
            printError(response.body, response.statusCode);
          }
          addingState = false;
        });
    }else{
      printError(response.body, response.statusCode);
    }
  });

  return;
});

app.post('/queue', function(req, res) {
  if (!req.body.access_token) {
    console.log('no access token');
    return;
  }
  var access_token = req.body.access_token;
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
  request.get(getQueueOptions, function(error, response, body) {

    if (!error && response.statusCode === 200) {
      var queueBody = body;

      request.get(getCurrentOptions, function(error, response, body) {
        if (!error && (response.statusCode === 200 || response.statusCode === 204)) {

          if (body && body.is_playing && body.item != null) {
            //sets information to whether or not something is playing right now
            duration = body.item.duration_ms;
            progress = body.progress_ms;
            id = body.item.id;
            //console.log("SOMETHING IS PLAYING");
            //console.log("id: " + id);
            //console.log("duration: " + duration);
            //console.log("progress: " + progress);
          }else{
            //console.log("NOTHING IS PLAYING");
            //console.log(body);
          }

          var finalResult = [];
          var toDelete = [];
          var passed = false;

          finalResult.push({
              duration: duration,
              progress: progress,
              id: id
            });

          for (var i = 0; i < queueBody.items.length; i++) {
            var currTrack = queueBody.items[i].track;
            if (passed) {
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
                passed = true;
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

          if (toDelete.length > 0 && !addingState){
            request.delete(deleteOptions, function(error, response, body){
              if (!error && response.statusCode === 200) {
                  console.log("Successfully deleted songs!");
              }else{
                printError(response.body, response.statusCode);
              }
            });
          }

        } else {
          printError(response.body, response.statusCode);
        }
      });

    } else {
      printError(response.body, response.statusCode);
    }
  });

});


console.log('Listening on 8888');
app.listen(8888);
