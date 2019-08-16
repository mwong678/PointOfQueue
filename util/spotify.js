const querystring = require('querystring'),
      util = require('../util'),
      properties = (process.env.PORT) ? '' : require('../properties.json'),
      request = require('request-promise'),
      logger = require('./logger'),
      request_old = require('request');


const client_id = (process.env.PORT) ? process.env.client_id : properties.client_id,
      client_secret = (process.env.PORT) ? process.env.client_secret :  properties.client_secret,
      redirect_uri = (process.env.PORT) ? process.env.redirect_uri : properties.redirect_uri_local,
      scope = 'user-read-private user-read-email playlist-modify-public playlist-modify-private user-read-currently-playing user-read-playback-state user-modify-playback-state';

function authorize(state){
  return 'https://accounts.spotify.com/authorize?' +
   querystring.stringify({
    response_type: 'code',
    client_id: client_id,
    scope: scope,
    redirect_uri: redirect_uri,
    state: state
  });
}

function getBearer(res, code){
  const authOptions = {
   url: 'https://accounts.spotify.com/api/token',
   form: {
    code: code,
    redirect_uri: redirect_uri,
    grant_type: 'authorization_code'
   },
   headers: {
    'Authorization': 'Basic ' + util.base64Encode(`${client_id}:${client_secret}`)
   },
   json: true
  };

  request_old.post(authOptions, function(error, response, body) {
   if (!error && response.statusCode === 200) {
    res.cookie('access_token', body.access_token);
    res.cookie('refresh_token', body.refresh_token);
    res.redirect('/createroom');
   } else {
    res.cookie('error', 'invalid_token');
    res.redirect('/');
   }
  });
}

async function getUserId(access_token){
    const getUserIdOptions = {
      url: 'https://api.spotify.com/v1/me',
      headers: {
       'Authorization': 'Bearer ' + access_token
      },
      json: true
     };

     try{
       const user_id = await request.get(getUserIdOptions);
       return user_id.id;
     }catch(e){
       logger.log(`ERROR GETTING USER ID -> ${e.message}`, 'error');
       return null;
     }
}

async function createPlaylist(access_token, user_id){
  const createPlaylistOptions = {
   url: 'https://api.spotify.com/v1/users/' + user_id + '/playlists',
   headers: {
    'Authorization': 'Bearer ' + access_token,
    'Content-Type': 'application/json'
   },
   body: JSON.stringify({
    'name': 'PointOfQueue'
   })
  };

  try{
    let response = {};
    const playlistResponse = await request.post(createPlaylistOptions);
    const result = JSON.parse(playlistResponse);
    response.playlistName = result.name;
    response.playlistURI = result.uri;
    return response;
  }catch(e){
    logger.log(`ERROR CREATING PLAYLIST -> ${e.message}`, 'error');
    return null;
  }
}

async function deletePlaylist(access_token, playlist){
  const deleteOptions = {
   url: 'https://api.spotify.com/v1/playlists/' + playlist + '/followers',
   headers: {
    'Authorization': 'Bearer ' + access_token
   },
   json: true
  };

  try{
    await request.delete(deleteOptions);
    return true;
  }catch(e){
    logger.log(`ERROR DELETING PLAYLIST -> ${e.message}`, 'error');
    return false;
  }
}

async function search(access_token, query){
  const queryURL = querystring.stringify({
   q: query,
   type: 'track'
  });

  const authOptions = {
   url: 'https://api.spotify.com/v1/search?' + queryURL,
   headers: {
    'Authorization': 'Bearer ' + access_token
   },
   json: true
  };

  try{
    const searchResults = await request.get(authOptions);

    const songResults = searchResults.tracks.items;
    let finalResult = [];
    for (let i = 0; i < songResults.length; i++) {
     const songName = songResults[i].name,
           songURI = songResults[i].uri,
           artists = songResults[i].artists;
     let artistList = [];
     for (let j = 0; j < artists.length; j++) artistList.push(artists[j].name);

     finalResult.push({
      name: songName,
      uri: songURI,
      artists: artistList
     });
    }

    return finalResult;
  }catch(e){
    logger.log(`ERROR SEARCHING -> ${e.message}`, 'error');
    return null;
  }
}

async function addSongToQueue(access_token, playlist_id, uri, songInfo){
  const query = querystring.stringify({ uris: uri });

  const addToQueueOptions = {
    url: 'https://api.spotify.com/v1/playlists/' + playlist_id + '/tracks?' + query,
    headers: {
     'Authorization': 'Bearer ' + access_token
    },
    json: true
  };

  const turnOffShuffleOptions = {
   url: 'https://api.spotify.com/v1/me/player/shuffle?state=false',
   headers: {
    'Authorization': 'Bearer ' + access_token
   },
   json: true
  };

  const turnOffRepeatOptions = {
   url: 'https://api.spotify.com/v1/me/player/repeat?state=off',
   headers: {
    'Authorization': 'Bearer ' + access_token
   },
   json: true
  };

  try {
    await request.post(addToQueueOptions);
    request_old.put(turnOffShuffleOptions);
    request_old.put(turnOffRepeatOptions);
    logger.log(`Added ${songInfo.song} by ${songInfo.artist} to the queue`);
    return true;
  }catch(e){
    logger.log(`ERROR ADDING TO QUEUE -> ${e.message}`, 'error');
    return null;
  }

}

async function getQueue(access_token, playlist_id){
  const getQueueOptions = {
   url: 'https://api.spotify.com/v1/playlists/' + playlist_id + '/tracks',
   headers: {
    'Authorization': 'Bearer ' + access_token
   },
   json: true
  };

  try {
    const getQueueResponse = await request.get(getQueueOptions);
    return getQueueResponse;
  }catch(e){
    if (e.statusCode == 401 && e.message.includes('expired')){
      return 'EXPIRED';
    }else{
      logger.log(`ERROR GETTING QUEUE -> ${e.message}`, 'error');
      return null;
    }
  }
}

async function refreshToken(refresh_token, callback) {
 const authOptions = {
  url: 'https://accounts.spotify.com/api/token',
  headers: {
   'Authorization': 'Basic ' + util.base64Encode(client_id + ':' + client_secret)
  },
  form: {
   grant_type: 'refresh_token',
   refresh_token: refresh_token
  },
  json: true
 };

 try{
   const tokenResponse = await request.post(authOptions);
   return tokenResponse.access_token;
 }catch(e){
   logger.log(`ERROR REFRESHING TOKEN -> ${e.message}`, 'error');
   return null;
 }
}

async function getCurrentlyPlaying(access_token){
  const getCurrentOptions = {
   url: 'https://api.spotify.com/v1/me/player/currently-playing',
   headers: {
    'Authorization': 'Bearer ' + access_token
   },
   json: true
  };

  try{
    const getCurrentResponse = await request.get(getCurrentOptions);
    return getCurrentResponse;
  }catch(e){
    logger.log(`ERROR GETTING CURRENT SONG -> ${e.message}`, 'error');
    return null;
  }
}

async function deleteFromPlaylist(access_token, playlist_id, toDelete){
  const deleteOptions = {
   url: 'https://api.spotify.com/v1/playlists/' + playlist_id + '/tracks',
   body: {
    'tracks': toDelete
   },
   headers: {
    'Authorization': 'Bearer ' + access_token
   },
   json: true
  }

  try{
    await request.delete(deleteOptions);
    return true;
  }catch(e){
    logger.log(`ERROR DELETING SONG -> ${e.message}`, 'error');
    return false;
  }
}

module.exports = {
  getUserId,
  getBearer,
  authorize,
  createPlaylist,
  deletePlaylist,
  search,
  addSongToQueue,
  getQueue,
  refreshToken,
  getCurrentlyPlaying,
  deleteFromPlaylist
}
