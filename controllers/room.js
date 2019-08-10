const mongo = require('../db/mongo'),
      util = require('../util'),
      spotify = require('../util/spotify');

const createRoom = async (req, res) => {
  access_token = req.cookies["access_token"];
  refresh_token = req.cookies["refresh_token"];
  username = req.session.id;

  if (!access_token || !refresh_token) {
    spotify.authorize(res);
    return;
  }

  user_id = await spotify.getUserId(access_token);

  if (!user_id){
    console.log("Error getting User Info");
    req.session.destroy();
    res.redirect("/");
    return;
  }

  create_playlist = await spotify.createPlaylist(access_token, user_id, username);

  if (!create_playlist){
    console.log("Error creating Playlist");
    req.session.destroy();
    res.redirect("/");
    return;
  }

  dbResult = await mongo.addRoomInDB(username,
                                     create_playlist.playlistURI,
                                     create_playlist.playlistName,
                                     access_token,
                                     refresh_token);

  if (!dbResult) {
    console.log("Error creating room");
    res.redirect("/");
    return;
  }

  req.session.access_token = access_token;
  req.session.refresh_token = refresh_token;
  req.session.room_code = dbResult;
  req.session.room_owner = username;
  req.session.playlist_name = create_playlist.playlistName;
  req.session.playlist = create_playlist.playlistURI.split(":")[2];
  res.clearCookie("access_token");
  res.clearCookie("refresh_token");
  res.cookie("poq", util.base64Encode(dbResult + ':' + username));
  res.redirect("/");
}


const findRoom = async (req, res) => {

  roomResult = await mongo.getRoomCodeInDB(req.body.code);
  if (!roomResult){
    res.status(404);
    res.send("Error finding room");
    return;
  }

  req.session.access_token = roomResult.access_token;
  req.session.refresh_token = roomResult.refresh_token;
  req.session.room_code = req.body.code;
  req.session.room_owner = roomResult.owner;
  req.session.playlist_name = roomResult.playlist_name;;
  req.session.playlist = roomResult.playlist.split(":")[2];
  res.cookie("poq", util.base64Encode(req.body.code + ':'));
  res.send({ result: "OK" });
}

const deleteRoom = async (req, res) => {
 code = req.session.room_code;
 playlist = req.session.playlist;
 access_token = req.session.access_token;

 delete_playlist = await spotify.deletePlaylist(access_token, playlist);
 if (!delete_playlist){
   res.status(404);
   res.send("Error deleting playlist");
   return;
 }

 dbResult = await mongo.deleteRoom(code);
 if (!dbResult){
   res.status(404);
   res.send("Error deleting room");
   return;
 }

 req.session.destroy();
 res.send({ result: "Success" });
}

/*
const checkRoom = async (req, res) => {
  username = req.session.id;
  isFound = false;
  rooms = await mongo.getAllRooms();

  if (!rooms || (rooms && rooms.length == 0)){
    res.status(200);
    res.send({ result: "" });
    return;
  }

  if (rooms && rooms.length > 0) {
    for (var i = 0;i < rooms.length; i++){
      currRoom = rooms[i];
      code = currRoom.code;
      room_owner = currRoom.owner;
      access_token = currRoom.access_token;
      refresh_token = currRoom.refresh_token;
      playlistURI = currRoom.playlist;
      playlistName = currRoom.playlist_name;
      if (username == owner){
        isFound = true;
        req.session.access_token = access_token;
        req.session.refresh_token = refresh_token;
        req.session.room_code = code;
        req.session.room_owner = room_owner;
        req.session.playlist_name = playlistName;
        req.session.playlist = playlist.split(":")[2];
        res.cookie("poq", req.body.code + ':');
        res.status(200);
        res.send({ result: "OK" });
      }
    }
    if (!isFound){
      res.status(200);
      res.send({ result: "" });
    }
  }

  return;
}
*/

const queue = async (req, res) => {
 room_code = req.session.room_code;
 req_access_token = req.session.access_token;
 req_refresh_token = req.session.req_refresh_token;
 result = {};

 roomResult = await mongo.getRoomCodeInDB(room_code);
 if (!roomResult){
   res.status(404);
   res.send({result: "DELETED"});
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
