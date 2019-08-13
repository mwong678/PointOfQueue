const mongo = require('../db/mongo'),
      util = require('../util'),
      spotify = require('../util/spotify');

const DAY_IN_MILLIS = 24 * 60 * 60 * 1000,
      isProduction = (process.env.NODE_ENV === 'production');

const createRoom = async (req, res) => {
  access_token = req.cookies["access_token"];
  refresh_token = req.cookies["refresh_token"];

  if (!access_token || !refresh_token) {
    state = util.generateRandomString(16);
    res.cookie("spotify_auth_state", state);
    return res.redirect(spotify.authorize(state));
  }

  user_id = await spotify.getUserId(access_token);

  if (!user_id){
    req.session = null;
    return res.redirect("/");
  }

  create_playlist = await spotify.createPlaylist(access_token, user_id);

  dbResult = await mongo.addRoomInDB(create_playlist.playlistURI,
                                     create_playlist.playlistName,
                                     access_token,
                                     refresh_token);

  if (!dbResult || !create_playlist) {
    req.session = null;
    return res.redirect("/");
  }

  req.session.access_token = access_token;
  req.session.refresh_token = refresh_token;
  req.session.room_code = dbResult;
  req.session.playlist_name = create_playlist.playlistName;
  req.session.playlist = create_playlist.playlistURI.split(":")[2];
  res.clearCookie("access_token");
  res.clearCookie("refresh_token");
  res.cookie("poq", util.base64Encode(dbResult + ':' +  req.session.playlist + ":owner"), { maxAge: DAY_IN_MILLIS, secure: isProduction });
  return res.redirect("/");
}


const findRoom = async (req, res) => {
  roomResult = await mongo.getRoomCodeInDB(req.body.code);
  if (roomResult == null) return res.sendStatus(404)

  req.session.access_token = roomResult.access_token;
  req.session.refresh_token = roomResult.refresh_token;
  req.session.room_code = req.body.code;
  req.session.playlist_name = roomResult.playlist_name;;
  req.session.playlist = roomResult.playlist.split(":")[2];
  res.cookie("poq", util.base64Encode(req.body.code + ':' + req.session.playlist + ":user"), { maxAge: DAY_IN_MILLIS, secure: isProduction});
  return res.sendStatus(200);
}

const deleteRoom = async (req, res) => {
 code = req.session.room_code;
 playlist = req.session.playlist;
 access_token = req.session.access_token;

 delete_playlist = await spotify.deletePlaylist(access_token, playlist);
 if (!delete_playlist) return res.sendStatus(404);

 dbResult = await mongo.deleteRoom(code);
 if (!dbResult) return res.sendStatus(404);

 req.session = null;
 return res.sendStatus(200);
}

const queue = async (req, res) => {
 result = {};

 roomResult = await mongo.getRoomCodeInDB(req.session.room_code);
 if (!roomResult){
   req.session = null;
   return res.status(404).send({result: "DELETED"});
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
