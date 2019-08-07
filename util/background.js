const mongo = require('../db/mongo'),
      util = require('../util'),
      spotify = require('../util/spotify');

const SECOND_IN_MILLIS = 1000;
const MINUTE_IN_MILLIS = 60 * SECOND_IN_MILLIS;
const HOUR_IN_MILLIS = 60 * MINUTE_IN_MILLIS;
const EXPIRE_TIME_IN_MILLIS = 3 * HOUR_IN_MILLIS;

async function updateQueues(){

  rooms = await mongo.getAllRooms();

  if (!rooms || (rooms && rooms.length == 0)){
    return;
  }

  for (var i = 0; i < rooms.length; i++) {
   var currRoom = rooms[i];
   var code = currRoom.code;
   var queue = currRoom.queue;
   var owner = currRoom.owner;
   var created_at = currRoom.created_at;
   var access_token = currRoom.access_token;
   var refresh_token = currRoom.refresh_token;
   var playlistURI = currRoom.playlist;
   var playlist_id = playlistURI.split(":")[2];

   queueBody = await spotify.getQueue(access_token, playlist_id);
   if (!queueBody) return;

   if (queueBody == 'EXPIRED'){
     new_access_token = await spotify.refreshToken(refresh_token);
     if (!new_access_token){
       console.log("Error: unable to refresh code");
       return;
     }

     updateResult = await mongo.updateRoomCodesInDB(code, new_access_token, refresh_token);
     if (updateResult) {
      console.log("Code refreshed");
     } else {
      console.log("Error: unable to update new room access code");
     }
     return;
   }

   if (Date.now() > created_at + EXPIRE_TIME_IN_MILLIS){
     delete_playlist = await spotify.deletePlaylist(access_token, playlist_id);

     if (!delete_playlist){
       console.log("Error deleting playlist");
       return;
     }

     dbResult = await mongo.deleteRoom(code);

     if (!dbResult){
       console.log("Error deleting room");
     }

     return;
   }

   body = await spotify.getCurrentlyPlaying(access_token);
   if (!body) return;

   var isPlaying = (body) ? body.is_playing : null;
   var duration, progress, id, currPlaylistArray, currPlaylist;

   if (body && body.item) {
    currPlaylistArray = (body.context) ? body.context.uri.split(":") : null;
    currPlaylist = (currPlaylistArray) ? currPlaylistArray[currPlaylistArray.length - 1] : null;
    if (playlist_id != currPlaylist){
      return;
    }
    duration = body.item.duration_ms;
    progress = body.progress_ms;

    if (progress > 0 || (progress == 0 && isPlaying)) {
      //this is the criteria for a curr song not to be deleted
     id = body.item.id;
    }

    if (queueBody.items.length >= 1){
      firstSongArray = queueBody.items[0].track.uri.split(":");
      if  (firstSongArray[firstSongArray.length - 1] != body.item.id){
        id = body.item.id;
      }
    }

    let newCurrTrack = {
     progress: progress,
     duration: duration,
     uri: id
    };

    await mongo.updateCurrTrack(code, newCurrTrack);
   } else {
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

   await mongo.updateRoomQueue(code, finalResult);


   if (toDelete.length > 0 && (isPlaying || id === undefined)) {
     console.log("isPlaying: " + isPlaying);
     console.log("Progress: " + progress);
     console.log("ID: " + id);
     console.log("# songs to delete: " + toDelete.length);
     console.log("currTrackFound: " + currTrackFound);

     delete_songs = await spotify.deleteFromPlaylist(access_token, playlist_id, toDelete);

     if (delete_songs){
       console.log("Deleted songs");
       console.log();
     }else{
       console.log("Error deleting songs");
       console.log();
     }
   }
  }

}

module.exports = {
  updateQueues
}
