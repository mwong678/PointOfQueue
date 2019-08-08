const mongo = require('../db/mongo'),
      util = require('../util'),
      spotify = require('../util/spotify');

const createRoom = async (req, res) => {
  username = req.cookies['username'];
  access_token = req.cookies['access_token'];
  refresh_token = req.cookies['refresh_token'];

  if (!access_token|| !refresh_token) {
    spotify.authorize(res);
    return;
  }

  user_id = await spotify.getUserId(access_token);

  if (!user_id){
    res.clearCookie("access_token");
    res.clearCookie("refresh_token");
    console.log("Error getting User Info");
    res.redirect("/room.html");
    return;
  }

  create_playlist = await spotify.createPlaylist(access_token, user_id);

  if (!create_playlist){
    res.clearCookie("access_token");
    res.clearCookie("refresh_token");
    console.log("Error creating Playlist");
    res.redirect("/room.html");
    return;
  }

  dbResult = await mongo.addRoomInDB(username,
                                     create_playlist.playlistURI,
                                     create_playlist.playlistName,
                                     access_token,
                                     refresh_token);

  if (!dbResult) {
    res.clearCookie("access_token");
    res.clearCookie("refresh_token");
    console.log("Error creating room");
    res.redirect("/room.html");
    return;
  }

  res.cookie("room_code", dbResult);
  res.cookie("room_owner", username);
  res.cookie("playlist_name", create_playlist.playlistName);
  res.cookie("playlist", create_playlist.playlistURI.split(":")[2]);
  res.redirect("/room.html");
}


const findRoom = async (req, res) => {

  roomResult = await mongo.getRoomCodeInDB(req.body.code);
  if (!roomResult){
    res.status(404);
    res.send("Error finding room");
    return;
  }

  owner = roomResult.owner;
  playlist = roomResult.playlist;
  playlistName = roomResult.playlist_name;
  access_token = roomResult.access_token;
  refresh_token = roomResult.refresh_token;

  res.cookie("access_token", access_token);
  res.cookie("refresh_token", refresh_token);
  res.cookie("room_code", req.body.code);
  res.cookie("room_owner", owner);
  res.cookie("playlist", playlist.split(":")[2]);
  res.cookie("playlist_name", playlistName);
  res.send({ result: "OK" });
}

const deleteRoom = async (req, res) => {
 code = req.cookies["room_code"];
 playlist = req.cookies["playlist"];
 access_token = req.cookies["access_token"];

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

 res.send({ result: "Success" });
}

const checkRoom = async (req, res) => {
  username = req.cookies["username"];
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
      owner = currRoom.owner;
      access_token = currRoom.access_token;
      refresh_token = currRoom.refresh_token;
      playlistURI = currRoom.playlist;
      playlistName = currRoom.playlist_name;
      if (username == owner){
        isFound = true;
        res.cookie("access_token", access_token);
        res.cookie("refresh_token", refresh_token);
        res.cookie("room_code", code);
        res.cookie("room_owner", owner);
        res.cookie("playlist_name", playlistName);
        res.cookie("playlist", playlistURI.split(":")[2]);
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

const queue = async (req, res) => {

 room_code = req.cookies["room_code"];
 req_access_token = req.cookies["access_token"];
 req_refresh_token = req.cookies["refresh_token"];
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
  console.log("Changed to new access token in cookies!");
  res.cookie("access_token", roomResult.access_token);
 }

 res.send({
  result: result
 });
}

module.exports = {
  createRoom,
  findRoom,
  deleteRoom,
  checkRoom,
  queue
}
