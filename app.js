const express = require('express');
const request = require('request');
const fs = require('fs')
const https = require('https')
const cors = require('cors');
const properties = require('./properties.json');

var mongo = require('./mongo.js');
var myDB, userCollection, roomCollection;
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

const {
 check,
 validationResult
} = require('express-validator');
const client_id = properties.client_id;
const client_secret = properties.client_secret;
const redirect_uri = (process.env.PORT) ? properties.redirect_uri_deploy : properties.redirect_uri_local;

var generateRandomString = function(length) {
 var text = '';
 var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

 for (var i = 0; i < length; i++) {
  text += possible.charAt(Math.floor(Math.random() * possible.length));
 }
 return text;
};

async function isUserNameInDB(username) {
 let result = await userCollection.findOne({
  username: username
 });
 return result;
}

async function isRoomCodeInDB(code) {
 let result = await roomCollection.findOne({
  code: code
 });
 return result == null ? false : true;
}

async function getAllRooms() {
 let result = await roomCollection.find().toArray();
 return result;
}

async function getUserInDB(username) {
 let result = await userCollection.findOne({
  username: username
 });
 return result;
}

async function getRoomCodeInDB(code) {
 let result = await roomCollection.findOne({
  code: code
 });
 return result;
}

async function addUserInDB(username, password) {
 let result = await userCollection.insertOne({
  username: username,
  password: password
 });
 return result ? true : false;
}

async function updateRoomCodesInDB(code, access_token, refresh_token) {
 let query = {
  code: code
 };
 let updated = {
  $set: {
   access_token: access_token,
   refresh_token: refresh_token
  }
 };
 let result = await roomCollection.updateOne(query, updated);
 return result;
}


async function updateCurrTrack(code, newCurrTrack) {
 let query = {
  code: code
 };
 let updated = {
  $set: {
   currentTrack: newCurrTrack
  }
 };
 let result = await roomCollection.updateOne(query, updated);
 return result;
}

async function updateRoomLock(code, lock) {
 let query = {
  code: code
 };
 let updated = {
  $set: {
   queueLock: lock
  }
 };
 let result = await roomCollection.updateOne(query, updated);
 return result;
}

async function updateRoomQueue(code, newQueue) {
 let query = {
  code: code
 };
 let updated = {
  $set: {
   queue: newQueue
  }
 };
 let result = await roomCollection.updateOne(query, updated);
 return result;
}

async function addRoomInDB(username, playlistURI, playlistName, access_token, refresh_token) {
 var code;
 var findResult = true;
 while (findResult) {
  code = generateRandomString(4);
  findResult = await isRoomCodeInDB(code);
 }
 var item = {
  code: code,
  owner: username,
  playlist: playlistURI,
  playlist_name: playlistName,
  queueLock: false,
  queue: [],
  currentTrack: {
   progress: '',
   duration: '',
   id: ''
  },
  access_token: access_token,
  refresh_token: refresh_token
 }
 let insertResult = await roomCollection.insertOne(item);
 return insertResult ? code : null;
}

async function deleteRoom(code) {
 let result = await roomCollection.deleteOne({
  code: code
 });
 return result;
}

function refreshToken(refresh_token, callback) {
 var authOptions = {
  url: 'https://accounts.spotify.com/api/token',
  headers: {
   'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64'))
  },
  form: {
   grant_type: 'refresh_token',
   refresh_token: refresh_token
  },
  json: true
 };

 request.post(authOptions, function(error, response, body) {
  if (!error && response.statusCode === 200) {
   callback(body.access_token);
  }
 });
}


var stateKey = 'spotify_auth_state';
var app = express();

app.use(express.static(__dirname + '/public'))
 .use(cors())
 .use(cookieParser())
 .use(express.urlencoded({
  extended: true
 }))
 .use(bodyParser.json());

app.post('/', [
 check('username').not().isEmpty(),
 check('password').not().isEmpty()
], function(req, res) {
 const errors = validationResult(req);

 if (!errors.isEmpty()) {
  const errorArray = errors.array();
  var errorResponse = {};
  for (var i = 0; i < errorArray.length; i++) {
   if (errorArray[i].param == 'username') {
    errorResponse.username = 'Please enter a name'
   } else if (errorArray[i].param == 'password') {
    errorResponse.password = 'Please enter a password'
   }
  }
  res.status(400);
  res.send(errorResponse);
  return;
 }

 const post = req.body;
 const username = post.username;
 const password = post.password;

 isUserNameInDB(username).then(function(result) {
  if (result == null) {
   res.status(404);
   res.send({
    username: "Username not found"
   });
   return;
  }

  if (password === result.password) {
   res.cookie("username", username);
   res.status(200);
   res.send({
    username: username
   });
   return;
  } else {
   res.status(400);
   res.send({
    password: "Incorrect Password"
   });
   return;
  }
 });

});

app.get('/signup', function(req, res) {
 res.redirect('/signup.html');
});

app.get('/room', function(req, res) {
    res.redirect('/room.html');
});

app.get('/checkforroom', function(req, res){
  var username = req.cookies["username"];
  var isFound = false;
  getAllRooms().then(function(rooms){
    if (rooms && rooms.length > 0) {
      for (var i = 0;i < rooms.length; i++){
        let currRoom = rooms[i];
        var code = currRoom.code;
        var owner = currRoom.owner;
        var access_token = currRoom.access_token;
        var refresh_token = currRoom.refresh_token;
        var playlistURI = currRoom.playlist;
        var playlistName = currRoom.playlist_name;
        if (username == owner){
          isFound = true;
          res.cookie("access_token", access_token);
          res.cookie("refresh_token", refresh_token);
          res.cookie("room_code", code);
          res.cookie("room_owner", owner);
          res.cookie("playlist_name", playlistName);
          res.cookie("playlist", playlistURI.split(":")[2]);
          res.status(200);
          res.send({
           result: "Found"
          });
        }
      }
      if (!isFound){
        res.send({
         result: "Not found"
        });
      }
    }
  });
});

app.get('/createroom', function(req, res) {
 if (!req.cookies["username"]) {
  res.redirect("/");
 }

 let username = req.cookies['username'];


 if (!req.cookies['access_token'] || !req.cookies['refresh_token']) {
  var state = generateRandomString(16);
  res.cookie(stateKey, state);
  var scope = 'user-read-private user-read-email playlist-modify-public playlist-modify-private user-read-currently-playing user-read-playback-state user-modify-playback-state';
  res.redirect('https://accounts.spotify.com/authorize?' +
   querystring.stringify({
    response_type: 'code',
    client_id: client_id,
    scope: scope,
    redirect_uri: redirect_uri,
    state: state
   }));
  return;
 }

 var access_token = req.cookies['access_token'];
 var refresh_token = req.cookies['refresh_token'];

 var getUserIdOptions = {
  url: 'https://api.spotify.com/v1/me',
  headers: {
   'Authorization': 'Bearer ' + access_token
  },
  json: true
 };

 var createPlaylistRequest = function(options) {
  request.post(options, function(error, response, body) {
   if (!error && (response.statusCode === 200 || response.statusCode === 201)) {
    let result = JSON.parse(body);
    let playlistName = result.name;
    let playlistURI = result.uri;

    addRoomInDB(username, playlistURI, playlistName, access_token, refresh_token).then(function(result) {
     if (result) {
      res.cookie("access_token", access_token);
      res.cookie("refresh_token", refresh_token);
      res.cookie("room_code", result);
      res.cookie("room_owner", username);
      res.cookie("playlist_name", playlistName);
      res.cookie("playlist", playlistURI.split(":")[2]);
      res.redirect("/room");
     } else {
      res.status(404);
      res.send({
       result: "Unable to create room"
      });
     }
     return;
    });
   } else {
    res.status(404);
    res.send({
     result: response.body.error.status + " " + response.body.error.message
    });
    return;
   }
  });
 }

 var createPlaylist = function(access_token) {
  request.get(getUserIdOptions, function(error, response, body) {
   if (!error && response.statusCode === 200) {
    if (body) {
     var createPlaylistOptions = {
      url: 'https://api.spotify.com/v1/users/' + body.id + '/playlists',
      headers: {
       'Authorization': 'Bearer ' + access_token,
       'Content-Type': 'application/json'
      },
      body: JSON.stringify({
       'name': 'POQ_' + generateRandomString(4)
      })
     };
     createPlaylistRequest(createPlaylistOptions);
    }
   } else {
    res.status(404);
    res.send({
     result: response.body.error.status + " " + response.body.error.message
    });
    return;
   }
  });
 };

 createPlaylist(access_token);

});

app.post('/findroom', function(req, res) {
 getRoomCodeInDB(req.body.code).then(function(roomResult) {
  if (roomResult) {
   let owner = roomResult.owner;
   let playlist = roomResult.playlist;
   let playlistName = roomResult.playlist_name;
   let access_token = roomResult.access_token;
   let refresh_token = roomResult.refresh_token;
   getUserInDB(owner).then(function(userResult) {
    if (userResult) {
     res.cookie("access_token", access_token);
     res.cookie("refresh_token", refresh_token);
     res.cookie("room_code", req.body.code);
     res.cookie("room_owner", owner);
     res.cookie("playlist", playlist.split(":")[2]);
     res.cookie("playlist_name", playlistName);
     res.send({
      result: "Found"
     });
    } else {
     res.status(404);
     res.send({
      result: "Error finding room owner"
     });
    }
   });
  } else {
   res.status(404);
   res.send({
    result: "Error finding room code"
   });
  }
 });
});

app.post('/signup', function(req, res) {
 const request = req.body;
 const username = request.username;
 const password = request.password;

 isUserNameInDB(username).then(function(results) {
  let userNameInDB = (results == null) ? false : true;
  if (!userNameInDB) {
   addUserInDB(username, password).then(function(response) {
    if (response) {
     res.cookie("username", username);
     res.send({
      result: "Success! Redirecting..."
     });
    } else {
     res.status(404);
     res.send({
      result: "Error creating user"
     });
    }
   });
  } else {
   res.status(404);
   res.send({
    result: "Username already exists"
   });
  }
 });

 return;
});


app.get('/callback', function(req, res) {

 // your application requests refresh and access tokens
 // after checking the state parameter

 var code = req.query.code || null;
 var state = req.query.state || null;
 var storedState = req.cookies ? req.cookies[stateKey] : null;
 if (state === null || state !== storedState) {
  res.redirect('/createroom' +
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
    'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64'))
   },
   json: true
  };

  request.post(authOptions, function(error, response, body) {
   if (!error && response.statusCode === 200) {

    var access_token = body.access_token,
     refresh_token = body.refresh_token;

    var options = {
     url: 'https://api.spotify.com/v1/me',
     headers: {
      'Authorization': 'Bearer ' + access_token
     },
     json: true
    };
    res.cookie("access_token", access_token);
    res.cookie("refresh_token", refresh_token);
    res.redirect('/createroom');
   } else {
    res.cookie("error", "invalid_token");
    res.redirect('/createroom');
   }
  });
 }
});

app.post('/search', function(req, res) {
 var query = querystring.stringify({
  q: req.body.query,
  type: 'track'
 });
 var access_token = req.body.access_token;
 var refresh_token = req.body.refresh_token;
 var username = req.body.username;

 var authOptions = {
  url: 'https://api.spotify.com/v1/search?' + query,
  headers: {
   'Authorization': 'Bearer ' + access_token
  },
  json: true
 };

 request.get(authOptions, function(error, response, body) {
  if (!error && response.statusCode === 200) {
   var songResults = body.tracks.items;
   var i;
   var finalResult = [];
   for (i = 0; i < songResults.length; i++) {
    var songName = songResults[i].name;
    var songURI = songResults[i].uri;
    var artists = songResults[i].artists;
    var artistList = [];
    var j;
    for (j = 0; j < artists.length; j++) {
     artistList.push(artists[j].name);
    }
    finalResult.push({
     name: songName,
     uri: songURI,
     artists: artistList
    });
   }
   res.send({
    result: finalResult
   });
  } else {
    res.status(response.body.error.status);
    res.send({
     result: response.body.error.status + " " + response.body.error.message
    });
  }
 });

 return;
});

app.get('/deleteroom', function(req, res) {
 let code = req.cookies["room_code"];
 let playlist = req.cookies["playlist"];
 let access_token = req.cookies["access_token"];

 var deleteOptions = {
  url: 'https://api.spotify.com/v1/playlists/' + playlist + '/followers',
  headers: {
   'Authorization': 'Bearer ' + access_token
  },
  json: true
 };

 request.delete(deleteOptions, function(error, response, body) {
  if (!error && response.statusCode == 200) {
   deleteRoom(code).then(function(deleteResult) {
    if (deleteResult) {
     res.cookie("access_token", '');
     res.cookie("refresh_token", '');
     res.cookie("room_code", '');
     res.cookie("room_owner", '');
     res.cookie("playlist_name", '');
     res.cookie("playlist", '');
     res.send({
      result: "Success"
     });
    } else {
     res.status(500);
     res.send({
      result: "Error Deleting Room"
     });
    }
   });
  } else {
   res.status(500);
   res.send({
    result: "Error Deleting Playlist"
   });
  }
 });

});

app.get('/exitroom', function(req, res) {
  res.cookie("access_token", '');
  res.cookie("refresh_token", '');
  res.cookie("room_code", '');
  res.cookie("room_owner", '');
  res.cookie("playlist_name", '');
  res.cookie("playlist", '');
  res.send({
   result: "Success"
  });
});

app.post('/addtoqueue', function(req, res) {
 var query = querystring.stringify({
  uris: req.body.uri
 });

 var song = req.body.song;
 var artist = req.body.artist;
 var uri = req.body.uri;
 var username = req.cookies["username"];
 var access_token = req.cookies["access_token"];
 var refresh_token = req.cookies["refresh_token"];
 var playlist_id = req.cookies["playlist"];
 var room_code = req.cookies["room_code"];

 var addToQueueOptions = {
  url: 'https://api.spotify.com/v1/playlists/' + playlist_id + '/tracks?' + query,
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

 var getDeviceOptions = {
  url: 'https://api.spotify.com/v1/me/player/devices',
  headers: {
   'Authorization': 'Bearer ' + access_token
  },
  json: true
 };

 var turnOffShuffleOptions = {
  url: 'https://api.spotify.com/v1/me/player/shuffle?state=false',
  headers: {
   'Authorization': 'Bearer ' + access_token
  },
  json: true
 };

 var turnOffRepeatOptions = {
  url: 'https://api.spotify.com/v1/me/player/repeat?state=off',
  headers: {
   'Authorization': 'Bearer ' + access_token
  },
  json: true
 };

 var turnOffShuffle = function() {
  request.put(turnOffShuffleOptions);
 }

 var turnOffRepeat = function() {
  request.put(turnOffRepeatOptions);
 }

 var getCurrentlyPlaying = function() {
  request.get(getCurrentOptions, function(error, response, body) {
   if (!error && response.statusCode === 200) {
    //if body is null that means no avail devices
    if (body && body.item) {
     let currPlaylistArray = (body.context) ? body.context.uri.split(":") : null;
     let currPlaylist = (currPlaylistArray) ? currPlaylistArray[currPlaylistArray.length - 1] : null;
     let progress = body.progress_ms;
     let duration = body.item.duration_ms;
     let id = body.item.uri;
     let newCurrTrack = {
      progress: progress,
      duration: duration,
      uri: id
     };
     updateCurrTrack(room_code, newCurrTrack).then(function(roomResult) {
      if (roomResult) {
       updateRoomLock(room_code, true).then(function(lockResult) {
        if (lockResult) {
         console.log("*****************LOCKED*****************");
         if (playlist_id != currPlaylist) {
          console.log("Different context, changing");
          var stopMusicOptions = {
           url: 'https://api.spotify.com/v1/me/player/pause',
           headers: {
            'Authorization': 'Bearer ' + access_token
           },
           json: true
          };
          if (body.is_playing){
            stopMusic(stopMusicOptions);
          }else{
            addSongToQueue(body.is_playing);
          }
         } else {
           addSongToQueue(body.is_playing);
         }
        } else {
         console.log("Error locking room, try again.");
         res.status(404);
         res.send({
          result: "Error locking room, try again."
         });
        }
       });
      } else {
       console.log("Error updating current song, try again.");
       res.status(404);
       res.send({
        result: "Error updating current song, try again."
       });
      }
     });
    } else {
     console.log("No available devices. Turn one on");
     res.status(404);
     res.send({
      result: "No available devices. Turn one on"
     });
    }
   } else if (!error && response.statusCode === 204) {
    console.log("No track is playing");
    updateRoomLock(room_code, true).then(function(lockResult) {
     if (lockResult) {
      console.log("*****************LOCKED*****************");
      addSongToQueue(false);
     } else {
      console.log("Error locking room, try again.");
      res.status(404);
      res.send({
       result: "Error locking room, try again."
      });
     }
    });
   } else {
    console.log(response.body.error.status + " " + response.body.error.message);
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
   if (!error && response.statusCode === 201) {
    console.log("Added " + song + " by " + artist + " with this uri: " + uri + " to the queue");
    if (!isPlaying) {
     var playSongOptions = {
      url: 'https://api.spotify.com/v1/me/player/play',
      headers: {
       'Authorization': 'Bearer ' + access_token
      },
      body: {
       "context_uri": "spotify:playlist:" + playlist_id
      },
      json: true
     };
     playSong(playSongOptions);
    } else {
     updateRoomLock(room_code, false).then(function(lockResult) {
      if (lockResult) {
       console.log("*****************UNLOCKED*****************");
       res.send({
        result: "Added " + song + " by " + artist + " to the queue"
       });
      } else {
       console.log("Error unlocking room, try again.");
       res.status(404);
       res.send({
        result: "Error unlocking room, try again."
       });
      }
     });
    }
   } else {
    console.log(response.body.error.status + " " + response.body.error.message);
    res.status(404);
    res.send({
     result: response.body.error.status + " " + response.body.error.message
    });
   }
   return;
  });
 };


 var playSong = function(playSongOptions) {
  request.put(playSongOptions, function(error, response, body) {
   if (!error && response.statusCode === 204) {
    turnOffShuffle();
    turnOffRepeat();
    updateRoomLock(room_code, false).then(function(lockResult) {
     if (lockResult) {
      console.log("Playing " + song + " by " + artist + " from the queue");
      console.log("*****************UNLOCKED*****************");
      res.send({
       result: "Added and now playing " + song + " by " + artist + " to the queue"
      });
     } else {
      console.log("Error unlocking room, try again.");
      res.status(404);
      res.send({
       result: "Error unlocking room, try again."
      });
     }
    });
   } else {
    console.log(response.body.error.status + " " + response.body.error.message);
    res.status(404);
    res.send({
     result: response.body.error.status + " " + response.body.error.message
    });
   }
   return;
  });
 };

 var stopMusic = function(stopMusicOptions){
   request.put(stopMusicOptions, function(error, response, body) {
     if (!error && response.statusCode === 204) {
       console.log("Paused Music");
       addSongToQueue(false);
     }else{
       console.log(response.body.error.status + " " + response.body.error.message);
       res.status(404);
       res.send({
        result: response.body.error.status + " " + response.body.error.message
       });
     }
   });
 }

 getCurrentlyPlaying();
 return;
});

app.get('/queue', function(req, res) {
 var room_code = req.cookies["room_code"];
 var req_access_token = req.cookies["access_token"];
 var req_refresh_token = req.cookies["refresh_token"];
 var result = {};
 getRoomCodeInDB(room_code).then(function(roomResult) {
  if (roomResult) {
   result.currentTrack = roomResult.currentTrack;
   result.queue = roomResult.queue;
   if (req_access_token != roomResult.access_token) {
    console.log("Changed to new access token in cookies!");
    res.cookie("access_token", roomResult.access_token);
   }
   res.send({
    result: result
   });
  } else {
   console.log("Error getting room")
   res.status(404);
   res.cookie("access_token", '');
   res.cookie("refresh_token", '');
   res.cookie("room_code", '');
   res.cookie("room_owner", '');
   res.cookie("playlist_name", '');
   res.cookie("playlist", '');
   res.send({
    result: "Error getting room"
   });
  }
 });

});


function updateQueues() {
 getAllRooms().then(function(rooms) {
  if (rooms && rooms.length > 0) {
   for (var i = 0; i < rooms.length; i++) {
    var currRoom = rooms[i];
    var code = currRoom.code;
    var queue = currRoom.queue;
    var owner = currRoom.owner;
    var access_token = currRoom.access_token;
    var refresh_token = currRoom.refresh_token;
    var playlistURI = currRoom.playlist;
    var playlist_id = playlistURI.split(":")[2];

    getUserInDB(owner).then(function(userResult) {
     if (userResult) {

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

      var getQueue = function() {
       request.get(getQueueOptions, function(error, response, body) {
        if (!error && response.statusCode === 200) {
         getCurrentlyPlaying(body);
        } else {
         console.log("Error getting playlist");
         if (response) {
          if (response.body.error.status == 401 && response.body.error.message.includes('expired')) {
           console.log("Code expired. Refreshing code...");
           refreshToken(refresh_token, function(new_access_token) {
            updateRoomCodesInDB(code, new_access_token, refresh_token).then(function(updateResult) {
             if (updateResult) {
              console.log("Code refreshed");
             } else {
              console.log("Error: unable to refresh code");
             }
            });
           });
          } else {
           console.log(response.body.error.status + ": " + response.body.error.message);
          }

         }
        }
       });
      };

      var getCurrentlyPlaying = function(queueBody) {
       request.get(getCurrentOptions, function(error, response, body) {
        if (!error && response && (response.statusCode === 200 || response.statusCode === 204)) {
         var isPlaying = (body) ? body.is_playing : null;
         var duration, progress, id;
         if (body && body.item) {
          duration = body.item.duration_ms;
          progress = body.progress_ms;
          if (progress > 0 || (progress == 0 && isPlaying)) {
           id = body.item.id;
          }
          let newCurrTrack = {
           progress: progress,
           duration: duration,
           uri: id
          };
          updateCurrTrack(code, newCurrTrack);
         } else {
          console.log("No available devices. Turn on one.");
          return;
         }

         var finalResult = [];
         var toDelete = [];
         var currTrackFound = false;


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
           } else {
            toDelete.push({
             "uri": currTrack.uri
            });
           }
          }
         }
         updateRoomQueue(code, finalResult);

         var deleteOptions = {
          url: 'https://api.spotify.com/v1/playlists/' + playlist_id + '/tracks',
          body: {
           "tracks": toDelete
          },
          headers: {
           'Authorization': 'Bearer ' + access_token
          },
          json: true
         }
         if (!process.env.PORT) {
          console.log("isPlaying: " + isPlaying);
          console.log("Progress: " + progress);
          console.log("ID: " + id);
          console.log("# songs to delete: " + toDelete.length);
          console.log("currTrackFound: " + currTrackFound);
          console.log();
         }
         if (toDelete.length > 0 && (isPlaying || id === undefined)) {
          getRoomCodeInDB(code).then(function(roomResult) {
           if (roomResult) {
            var lock = roomResult.queueLock;
            if (process.env.PORT) {
             console.log("isPlaying: " + isPlaying);
             console.log("Progress: " + progress);
             console.log("ID: " + id);
             console.log("# songs to delete: " + toDelete.length);
             console.log("currTrackFound: " + currTrackFound);
            }
            console.log("isLocked: " + lock);
            console.log();
            if (!lock) {
             deleteFromPlaylist(deleteOptions);
            }
           }
          })
         }
        } else {
         console.log("Error getting current: ");
         if (response && response.body) {
          console.log(response.body.error.status + ": " + response.body.error.message);
         } else {
          console.log(response);
         }
        }
        return;
       });
      };

      var deleteFromPlaylist = function(deleteOptions) {
       request.delete(deleteOptions, function(error, response, body) {
        if (!error && response.statusCode === 200) {
         console.log("Successfully deleted songs!");
         console.log();
        } else {
         console.log("Error deleting songs: ");
         if (response.body.error) {
          console.log(response.body.error.status + ": " + response.body.error.message);
         } else {
          console.log(response);
         }
        }
        return;
       });
      };

      getQueue();

      return;
     }
    });


   }
  }
 });
}

function requireHTTPS(req, res, next) {
  // The 'x-forwarded-proto' check is for Heroku
  if (!req.secure && req.get('x-forwarded-proto') !== 'https' && process.env.PORT) {
    console.log('redirecting...');
    return res.redirect('https://' + req.get('host') + req.url);
  }else{
    console.log(!req.secure);
    console.log(req.get('x-forwarded-proto'));
    console.log(process.env.PORT);
  }
  next();
}

var port = process.env.PORT || 8081;
console.log('Listening on ' + port);
mongo.connectToServer(function(err, client) {
 if (err) console.log(err);
 myDB = mongo.getDb();
 userCollection = myDB.collection("users");
 roomCollection = myDB.collection("rooms");

 var deleteRoom2 = async function(code) {
  await roomCollection.deleteOne({
   code: code
  }, (err, result) => {
   if (err) {
    throw err;
   }
  });
 }

 var deleteUser = async function(username) {
  await userCollection.deleteOne({
   username: username
  }, (err, result) => {
   if (err) {
    throw err;
   }
  });
 };

 //deleteRoom('qzch');
 //deleteRoom('EqO9');
 //deleteUser('mwong678');
 //deleteUser('matt_wong');
 //clearQueue("Og7t");

 userCollection.find().toArray((err, items) => {
  console.log(items);
 });

 roomCollection.find().toArray((err, items) => {
  console.log(items);
 });

 setInterval(updateQueues, 1000);
 app.use(requireHTTPS);
 app.listen(port);
});
