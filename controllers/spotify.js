const querystring = require('querystring'),
      mongo = require('../db/mongo'),
      util = require('../util'),
      spotify = require('../util/spotify');

const stateKey = 'spotify_auth_state';

const callback = async (req, res) => {

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  try {
    if (state === null || state !== storedState) {
     res.redirect('/createroom' +
      querystring.stringify({
       error: 'state_mismatch'
      }));
    } else {
      res.clearCookie(stateKey);
      spotify.getBearer(res, code);
    }
  }catch(e){
    console.log("ERROR CALLING BACK -> " + e.message);
  }
}

const search = async (req, res) => {
 access_token = req.session.access_token;
 refresh_token = req.session.refresh_token;

 searchResult = await spotify.search(access_token, req.body.query);

 if (!searchResult){
   res.status(404).send("Error searching");
   return;
 }

 res.send({ result: searchResult });

}

const addToQueue = async (req, res) => {
   songInfo = {};
   songInfo.song = req.body.song;
   songInfo.artist = req.body.artist;
   songInfo.uri = req.body.uri;
   access_token = req.session.access_token
   playlist_id = req.session.playlist;

   addToQueueResult = await spotify.addSongToQueue(access_token, playlist_id, req.body.uri, songInfo);

   if (!addToQueueResult){
     res.status(404).send("Error adding to queue");
     return;
   }

   res.send({ result: "Added " + songInfo.song + " by " + songInfo.artist + " to the queue" });

}

module.exports = {
  callback,
  search,
  addToQueue
}
