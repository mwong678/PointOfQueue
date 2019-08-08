const mongo = require('../db/mongo'),
      util = require('../util'),
      spotify = require('../util/spotify');

const SECOND_IN_MILLIS = 1000;
const MINUTE_IN_MILLIS = 60 * SECOND_IN_MILLIS;
const HOUR_IN_MILLIS = 60 * MINUTE_IN_MILLIS;
const EXPIRE_TIME_IN_MILLIS = 3 * HOUR_IN_MILLIS;

async function updateQueues(){
  var rooms = await mongo.getAllRooms();

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
     if (!new_access_token) return;

     updateResult = await mongo.updateRoomCodesInDB(code, new_access_token, refresh_token);
     if (!updateResult) console.log("Error: unable to update new room access code");

     return;
   }

   if (Date.now() > created_at + EXPIRE_TIME_IN_MILLIS){
     delete_playlist = await spotify.deletePlaylist(access_token, playlist_id);

     if (!delete_playlist){
       console.log("Error deleting playlist");
       return;
     }

     dbResult = await mongo.deleteRoom(code);

     if (!dbResult) console.log("Error deleting room");

     return;
   }

   //if (queueBody.items.length == 0) return;

   body = await spotify.getCurrentlyPlaying(access_token);
   if (!body){
     await pausedQueue(queueBody, code);
     return;
   }

   isPlaying = (body) ? body.is_playing : null;
   currentSongExists = body && body.item;
   currPlaylistArray = (body.context) ? body.context.uri.split(":") : null;
   currPlaylist = (currPlaylistArray) ? currPlaylistArray[currPlaylistArray.length - 1] : null;
   id = body.item.id;
   progress = body.progress_ms;
   duration = body.item.duration_ms;

   if (!currentSongExists || playlist_id != currPlaylist){
     //if no current song playing or not same playlist skip
     await pausedQueue(queueBody, code);
     return;
   }


   currSongFound = findCurrentInQueue(body.item.id, queueBody);
   if (!currSongFound){
     await pausedQueue(queueBody, code);
     return;
   }

   mongo.updateCurrTrack(code, { progress: progress, duration: duration, uri: id});

   finalResult = [];
   toDelete = [];
   currTrackFound = false;

   for (var i = 0; i < queueBody.items.length; i++) {
    currTrack = queueBody.items[i].track;
    if (currTrackFound) {
     artistString = joinArtists(currTrack.artists);
     finalResult.push({ name: currTrack.name, uri: currTrack.uri, artists: artistString });
   }else if (currTrack.id == id && progress > 0) {
     //edge case, if playlist ends, if progress is 0 delete it
     currTrackFound = true;
     i--;
    }else {
      toDelete.push({ "uri": currTrack.uri });
    }
   }

   mongo.updateRoomQueue(code, finalResult);

   if (toDelete.length > 0) {
     delete_songs = await spotify.deleteFromPlaylist(access_token, playlist_id, toDelete);
     if (!delete_songs) console.log("Error deleting songs");
   }
 }

}

function findCurrentInQueue(id, queueBody){
  for (var i = 0; i < queueBody.items.length; i++) {
   var currTrack = queueBody.items[i].track;
   if (currTrack.id == id) {
     return true;
   }
  }
  return false;
}

async function pausedQueue(queueBody, code){
  var finalResult = [];

  if (!queueBody.items) return;

  for (var i = 0; i < queueBody.items.length; i++) {
   currTrack = queueBody.items[i].track;
   artistString = joinArtists(currTrack.artists);
   finalResult.push({ name: currTrack.name, uri: currTrack.uri, artists: artistString });
  }

  await mongo.updateRoomQueue(code, finalResult);
}

function joinArtists(artists){
  artistString = "";
  for (var j = 0; j < artists.length; j++) {
   if (j > 0) {
    artistString += ', ';
   }
   artistString += artists[j].name;
  }
  return artistString;
}

module.exports = {
  updateQueues
}
