const querystring = require('querystring'),
      mongo = require('../db/mongo'),
      logger = require('../util/logger');
      spotify = require('../util/spotify');

const stateKey = 'spotify_auth_state';

const callback = async (req, res) => {

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  try {
    if (state === null || state !== storedState) {
     res.redirect('/createroom' +
      querystring.stringify({ error: 'state_mismatch' }));
    } else {
      res.clearCookie(stateKey);
      spotify.getBearer(res, code);
    }
  }catch(e){
    logger.log("ERROR CALLING BACK -> " + e.message);
  }
}

const search = async (req, res) => {
 searchResult = await spotify.search(req.session.access_token, req.body.query);

 if (!searchResult) return res.status(404).send({result: "Error searching"});

 return res.send({ result: searchResult });
}

const addToQueue = async (req, res) => {
   songInfo = {};
   songInfo.song = req.body.song;
   songInfo.artist = req.body.artist;
   songInfo.uri = req.body.uri;
   access_token = req.session.access_token
   playlist_id = req.session.playlist;

   addToQueueResult = await spotify.addSongToQueue(access_token, playlist_id, req.body.uri, songInfo);

   if (!addToQueueResult) return res.sendStatus(404);

   return res.sendStatus(200);
}

module.exports = {
  callback,
  search,
  addToQueue
}
