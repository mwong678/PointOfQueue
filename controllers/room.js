const mongo = require('../db/mongo'),
      util = require('../util'),
      spotify = require('../util/spotify');

const DAY_IN_MILLIS = 24 * 60 * 60 * 1000,
      isProduction = (process.env.NODE_ENV === 'production');

const createRoom = async (req, res) => {
  const access_token = req.cookies['access_token'],
        refresh_token = req.cookies['refresh_token'];

  if (!access_token || !refresh_token) {
    const state = util.generateRandomString(16);
    res.cookie('spotify_auth_state', state);
    return res.redirect(spotify.authorize(state));
  }

  const user_id = await spotify.getUserId(access_token);

  if (!user_id){
    req.session = null;
    return res.redirect('/');
  }

  const create_playlist = await spotify.createPlaylist(access_token, user_id);

  const dbResult = await mongo.addRoomInDB(create_playlist.playlistURI,
                                           create_playlist.playlistName,
                                           access_token,
                                           refresh_token);

  if (!dbResult || !create_playlist) {
    req.session = null;
    return res.redirect('/');
  }

  req.session.access_token = access_token;
  req.session.refresh_token = refresh_token;
  req.session.room_code = dbResult;
  req.session.playlist_name = create_playlist.playlistName;
  req.session.playlist = create_playlist.playlistURI.split(':')[2];

  const cookieString = `${dbResult}:${req.session.playlist}:owner`;
  const cookieOptions = { maxAge: DAY_IN_MILLIS, secure: isProduction };

  res.cookie('poq', util.base64Encode(cookieString), cookieOptions);
  return res.redirect('/');
}


const findRoom = async (req, res) => {
  const roomResult = await mongo.getRoomCodeInDB(req.body.code);
  if (!roomResult) return res.sendStatus(404);

  req.session.access_token = roomResult.access_token;
  req.session.refresh_token = roomResult.refresh_token;
  req.session.room_code = req.body.code;
  req.session.playlist_name = roomResult.playlist_name;;
  req.session.playlist = roomResult.playlist.split(':')[2];

  const cookieString = `${req.body.code}:${req.session.playlist}:user`;
  const cookieOptions = { maxAge: DAY_IN_MILLIS, secure: isProduction };

  res.cookie('poq', util.base64Encode(cookieString), cookieOptions);
  return res.sendStatus(200);
}

const deleteRoom = async (req, res) => {
 const code = req.session.room_code;
 const playlist = req.session.playlist;
 const access_token = req.session.access_token;

 const delete_playlist = await spotify.deletePlaylist(access_token, playlist);
 if (!delete_playlist) return res.sendStatus(404);

 dbResult = await mongo.deleteRoom(code);
 if (!dbResult) return res.sendStatus(404);

 req.session = null;
 return res.sendStatus(200);
}

const queue = async (req, res) => {
 let result = {};

 const roomResult = await mongo.getRoomCodeInDB(req.session.room_code);
 if (!roomResult){
   req.session = null;
   return res.status(404).send({result: 'DELETED'});
 }

 result.currentTrack = roomResult.currentTrack;
 result.queue = roomResult.queue;

 if (req.session.access_token != roomResult.access_token) {
  req.session.access_token = roomResult.access_token;
 }

 return res.send({ result: result });
}

module.exports = {
  createRoom,
  findRoom,
  deleteRoom,
  queue
}
