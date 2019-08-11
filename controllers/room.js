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
    res.redirect(spotify.authorize(state));
    return;
  }

  user_id = await spotify.getUserId(access_token);

  if (!user_id){
    console.log("Error getting User Info");
    req.session = null;
    res.redirect("/");
    return;
  }

  create_playlist = await spotify.createPlaylist(access_token, user_id);

  if (!create_playlist){
    console.log("Error creating Playlist");
    req.session = null;
    res.redirect("/");
    return;
  }

  dbResult = await mongo.addRoomInDB(create_playlist.playlistURI,
                                     create_playlist.playlistName,
                                     access_token,
                                     refresh_token);

  if (!dbResult) {
    console.log("Error creating room");
    req.session = null;
    res.redirect("/");
    return;
  }

  req.session.access_token = access_token;
  req.session.refresh_token = refresh_token;
  req.session.room_code = dbResult;
  req.session.playlist_name = create_playlist.playlistName;
  req.session.playlist = create_playlist.playlistURI.split(":")[2];
  res.clearCookie("access_token");
  res.clearCookie("refresh_token");
  res.cookie("poq", util.base64Encode(dbResult + ':' +  req.session.playlist + ":owner"), { maxAge: DAY_IN_MILLIS, secure: isProduction });
  res.redirect("/");
}


const findRoom = async (req, res) => {
  roomResult = await mongo.getRoomCodeInDB(req.body.code);
  if (!roomResult) res.sendStatus(404);

  req.session.access_token = roomResult.access_token;
  req.session.refresh_token = roomResult.refresh_token;
  req.session.room_code = req.body.code;
  req.session.playlist_name = roomResult.playlist_name;;
  req.session.playlist = roomResult.playlist.split(":")[2];
  res.cookie("poq", util.base64Encode(req.body.code + ':' + req.session.playlist + ":user"), { maxAge: DAY_IN_MILLIS, secure: isProduction});
  res.sendStatus(200);
}

const deleteRoom = async (req, res) => {
 code = req.session.room_code;
 playlist = req.session.playlist;
 access_token = req.session.access_token;

 delete_playlist = await spotify.deletePlaylist(access_token, playlist);
 if (!delete_playlist) res.sendStatus(404);

 dbResult = await mongo.deleteRoom(code);
 if (!dbResult) res.sendStatus(404);

 req.session = null;
 res.sendStatus(200);
}

const queue = async (req, res) => {
 room_code = req.session.room_code;
 req_access_token = req.session.access_token;
 req_refresh_token = req.session.req_refresh_token;
 result = {};

 roomResult = await mongo.getRoomCodeInDB(room_code);
 if (!roomResult){
   req.session = null;
   res.status(404).send({result: "DELETED"});
   return;
 }

 result.currentTrack = roomResult.currentTrack;
 result.queue = roomResult.queue;

 if (req_access_token != roomResult.access_token) {
  console.log("Changed to new access token!");
  req.session.access_token = roomResult.access_token;
 }

 res.send({ result: result });
}

module.exports = {
  createRoom,
  findRoom,
  deleteRoom,
  queue
}
