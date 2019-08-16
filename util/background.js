const mongo = require('../db/mongo'),
      spotify = require('../util/spotify');

const SECOND_IN_MILLIS = 1000,
      MINUTE_IN_MILLIS = 60 * SECOND_IN_MILLIS,
      HOUR_IN_MILLIS = 60 * MINUTE_IN_MILLIS,
      EXPIRE_TIME_IN_MILLIS = 3 * HOUR_IN_MILLIS;

async function updateQueues(){
  const rooms = await mongo.getAllRooms();

  if (!rooms || (rooms && rooms.length === 0)) return;

  for (let i = 0; i < rooms.length; i++) {
   const currRoom = rooms[i],
         code = currRoom.code,
         queue = currRoom.queue,
         owner = currRoom.owner,
         created_at = currRoom.created_at,
         access_token = currRoom.access_token,
         refresh_token = currRoom.refresh_token,
         playlistURI = currRoom.playlist,
         playlist_id = playlistURI.split(':')[2];

   const queueBody = await spotify.getQueue(access_token, playlist_id);
   if (!queueBody) return;

   if (queueBody === 'EXPIRED'){
     const new_access_token = await spotify.refreshToken(refresh_token);
     if (!new_access_token) return;

     const updateResult = await mongo.updateRoomCodesInDB(code,
                                                          new_access_token,
                                                          refresh_token);
     return;
   }

   if (Date.now() > created_at + EXPIRE_TIME_IN_MILLIS){
     const delete_playlist = await spotify.deletePlaylist(access_token,
                                                          playlist_id);

     if (!delete_playlist) return;

     const dbResult = await mongo.deleteRoom(code);

     return;
   }

   const body = await spotify.getCurrentlyPlaying(access_token);
   if (!body){
     pausedQueue(queueBody, code);
     return;
   }

   const isPlaying = (body) ? body.is_playing : null,
         currentSongExists = body && body.item,
         currPlaylistArray = (body.context) ? body.context.uri.split(':') : null,
         currPlaylist = (currPlaylistArray) ? currPlaylistArray[currPlaylistArray.length - 1] : null,
         id = body.item.id,
         progress = body.progress_ms,
         duration = body.item.duration_ms;

   if (!currentSongExists || playlist_id != currPlaylist){
     //if no current song playing or not same playlist skip
     pausedQueue(queueBody, code);
     return;
   }


   const currSongFound = findCurrentInQueue(body.item.id, queueBody);
   if (!currSongFound){
     pausedQueue(queueBody, code);
     return;
   }

   mongo.updateCurrTrack(code, { progress: progress,
                                 duration: duration,
                                 uri: id });

   let finalResult = [],
       toDelete = [],
       currTrackFound = false;

   for (let i = 0; i < queueBody.items.length; i++) {
    let currTrack = queueBody.items[i].track;
    if (currTrackFound) {
     const artistString = joinArtists(currTrack.artists);
     finalResult.push({ name: currTrack.name,
                        uri: currTrack.uri,
                        artists: artistString });
   }else if (currTrack.id == id && progress > 0) {
     //edge case, if playlist ends, if progress is 0 delete it
     currTrackFound = true;
     i--;
    }else {
      toDelete.push({ 'uri': currTrack.uri });
    }
   }

   mongo.updateRoomQueue(code, finalResult);

   if (toDelete.length > 0) spotify.deleteFromPlaylist(access_token,
                                                       playlist_id,
                                                       toDelete);
 }

}

async function pausedQueue(queueBody, code){
  let finalResult = [];

  if (!queueBody.items) return;

  for (let i = 0; i < queueBody.items.length; i++) {
   let currTrack = queueBody.items[i].track;
   const artistString = joinArtists(currTrack.artists);
   finalResult.push({ name: currTrack.name,
                      uri: currTrack.uri,
                      artists: artistString });
  }

  await mongo.updateRoomQueue(code, finalResult);
}

function findCurrentInQueue(id, queueBody){
  if (!queueBody.items) return;

  for (let i = 0; i < queueBody.items.length; i++) {
   let currTrack = queueBody.items[i].track;
   if (currTrack.id == id) return true;
  }
  return false;
}

function joinArtists(artists){
  let artistString = '';
  for (let j = 0; j < artists.length; j++) {
   if (j > 0) artistString += ', ';
   artistString += artists[j].name;
  }
  return artistString;
}


module.exports = {
  updateQueues
}
