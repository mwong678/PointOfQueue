const MongoClient = require('mongodb').MongoClient,
      logger = require('../util/logger'),
      util = require('../util'),
      properties = (process.env.PORT) ? '' : require('../properties.json'),
      dbURI = (process.env.PORT) ? process.env.dbURI : properties.dbURI;

let db, roomCollection;

function connectToServer(callback) {
  MongoClient.connect(dbURI, { useNewUrlParser: true }, function(err, client) {
    db = client.db('poq');
    roomCollection = db.collection('rooms');
    return callback(err);
  });
}

async function isRoomCodeInDB(code) {
 const result = await roomCollection.findOne({ code: code });
 return result == null ? false : true;
}

async function addRoomInDB(playlistURI, playlistName, access_token, refresh_token){
 let code;
 let findResult = true;
 while (findResult) {
  code = util.generateRandomString(4);
  findResult = await isRoomCodeInDB(code);
 }
 const item = {
  code: code,
  playlist: playlistURI,
  playlist_name: playlistName,
  queue: [],
  currentTrack: {
   progress: '',
   duration: '',
   id: ''
  },
  access_token: access_token,
  refresh_token: refresh_token,
  created_at: Date.now()
 }
 try {
   const insertResult = await roomCollection.insertOne(item);
   return code;
 }catch(e){
   logger.log(`ERROR CREATING ROOM IN DB -> ${e.message}`, 'error');
   return null;
 }
}

async function deleteRoom(code){
  try{
    const result = await roomCollection.deleteOne({ code: code });
    return result;
  }catch(e){
    logger.log(`ERROR DELETING ROOM IN DB -> ${e.message}`, 'error');
    return null;
  }
}

async function getRoomCodeInDB(code) {
  try{
    const result = await roomCollection.findOne({ code: code });
    return result;
  }catch(e){
    logger.log(`ERROR GETTING ROOM IN DB -> ${e.message}`, 'error');
    return null;
  }
}

async function getAllRooms() {
  try{
     const result = await roomCollection.find().toArray();
     return result;
  }catch(e){
    logger.log(`ERROR GETTING ALL ROOMS IN DB -> ${e.message}`, 'error');
    return null;
  }
}

async function updateRoomCodesInDB(code, access_token, refresh_token) {
 const query = { code: code };
 const updated = { $set: { access_token: access_token, refresh_token: refresh_token } };
 try{
   result = await roomCollection.updateOne(query, updated);
   return result;
 }catch(e){
   logger.log(`ERROR UPDATING ROOM IN DB -> ${e.message}`, 'error');
   return null;
 }
}

async function updateCurrTrack(code, newCurrTrack) {
 const query = { code: code };
 const updated = { $set: { currentTrack: newCurrTrack } };
 try{
   const result = await roomCollection.updateOne(query, updated);
   return result;
 }catch(e){
   logger.log(`ERROR UPDATING CURRENT TRACK IN DB -> ${e.message}`, 'error');
   return null;
 }
}

async function updateRoomQueue(code, newQueue) {
 const query = { code: code };
 const updated = { $set: { queue: newQueue } };
 try{
   const result = await roomCollection.updateOne(query, updated);
   return result;
 }catch(e){
   logger.log(`ERROR UPDATING ROOM QUEUE IN DB -> ${e.message}`, 'error');
   return null;
 }
}

module.exports = {
  connectToServer,
  isRoomCodeInDB,
  addRoomInDB,
  deleteRoom,
  getRoomCodeInDB,
  getAllRooms,
  updateRoomCodesInDB,
  updateCurrTrack,
  updateRoomQueue
};
