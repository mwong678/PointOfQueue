const querystring = require('querystring'),
      mongo = require('../db/mongo'),
      logger = require('../util/logger');
      spotify = require('../util/spotify');

const stateKey = 'spotify_auth_state';

const callback = async (req, res) => {

  const code = req.query.code || null;
  const state = req.query.state || null;
  const storedState = req.cookies ? req.cookies[stateKey] : null;

  try {
    if (state === null || state !== storedState) {
     logger.log('ERROR WITH SPOTIFY STATE', 'error');
     res.redirect('/createroom' +
      querystring.stringify({ error: 'state_mismatch' }));
    } else {
      res.clearCookie(stateKey);
      spotify.getBearer(res, code);
    }
  }catch(e){
    logger.log(`ERROR WITH SPOTIFY STATE -> ${e.message}`, 'error');
  }
}

const search = async (req, res) => {
 const searchResult = await spotify.search(req.session.access_token, req.body.query);

 if (!searchResult) return res.status(404).send({result: 'Error searching'});

 return res.send({ result: searchResult });
}

const addToQueue = async (req, res) => {
   let songInfo = {};
   songInfo.song = req.body.song;
   songInfo.artist = req.body.artist;
   songInfo.uri = req.body.uri;
   const access_token = req.session.access_token
   const playlist_id = req.session.playlist;

   addToQueueResult = await spotify.addSongToQueue(access_token,
                                                   playlist_id,
                                                   req.body.uri,
                                                   songInfo);

   if (!addToQueueResult) return res.sendStatus(404);

   return res.sendStatus(200);
}

module.exports = {
  callback,
  search,
  addToQueue
}
