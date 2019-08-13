const MongoClient = require('mongodb').MongoClient,
      logger = require('../util/logger'),
      util = require('../util'),
      properties = (process.env.PORT) ? '' : require('../properties.json'),
      dbURI = (process.env.PORT) ? process.env.dbURI : properties.dbURI;

var db, roomCollection;

function connectToServer(callback) {
  MongoClient.connect(dbURI, { useNewUrlParser: true }, function(err, client) {
    db = client.db('poq');
    roomCollection = db.collection("rooms");
    return callback(err);
  });
}

function getDb() {
  return db;
}

async function isRoomCodeInDB(code) {
 result = await roomCollection.findOne({ code: code });
 return result == null ? false : true;
}

async function addRoomInDB(playlistURI, playlistName, access_token, refresh_token){
 var code;
 var findResult = true;
 while (findResult) {
  code = util.generateRandomString(4);
  findResult = await isRoomCodeInDB(code);
 }
 var item = {
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
   insertResult = await roomCollection.insertOne(item);
   return code;
 }catch(e){
   logger.log("ERROR CREATING ROOM IN DB -> " + e.message, 'error');
   return null;
 }
}

async function deleteRoom(code){
  try{
    result = await roomCollection.deleteOne({ code: code });
    return result;
  }catch(e){
    logger.log("ERROR DELETING ROOM IN DB -> " + e.message, 'error');
    return null;
  }
}

async function getRoomCodeInDB(code) {
  try{
    result = await roomCollection.findOne({ code: code });
    return result;
  }catch(e){
    logger.log("ERROR GETTING ROOM IN DB -> " + e.message, 'error');
    return null;
  }
}

async function getAllRooms() {
  try{
     result = await roomCollection.find().toArray();
     return result;
  }catch(e){
    logger.log("ERROR GETTING ALL ROOMS IN DB -> " + e.message, 'error');
    return null;
  }
}

async function updateRoomCodesInDB(code, access_token, refresh_token) {
 query = { code: code };
 updated = { $set: { access_token: access_token, refresh_token: refresh_token } };
 try{
   result = await roomCollection.updateOne(query, updated);
   return result;
 }catch(e){
   logger.log("ERROR UPDATING ROOM IN DB -> " + e.message, 'error');
   return null;
 }
}

async function updateCurrTrack(code, newCurrTrack) {
 query = { code: code };
 updated = { $set: { currentTrack: newCurrTrack } };
 try{
   result = await roomCollection.updateOne(query, updated);
   return result;
 }catch(e){
   logger.log("ERROR UPDATING CURR TRACK IN DB -> " + e.message, 'error');
   return null;
 }
}

async function updateRoomQueue(code, newQueue) {
 query = { code: code };
 updated = { $set: { queue: newQueue } };
 try{
   result = await roomCollection.updateOne(query, updated);
   return result;
 }catch(e){
   logger.log("ERROR UPDATING ROOM QUEUE IN DB -> " + e.message, 'error');
   return null;
 }
}

module.exports = {
  connectToServer,
  getDb,
  isRoomCodeInDB,
  addRoomInDB,
  deleteRoom,
  getRoomCodeInDB,
  getAllRooms,
  updateRoomCodesInDB,
  updateCurrTrack,
  updateRoomQueue
};
