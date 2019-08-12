const properties = (process.env.PORT) ? '' : require('../properties.json');
const MongoClient = require('mongodb').MongoClient,
      util = require('../util');
const dbURI = (process.env.PORT) ? process.env.dbURI : properties.dbURI;

var db, roomCollection;

function connectToServer(callback) {
  MongoClient.connect(dbURI, { useNewUrlParser: true }, function(err, client) {
    db = client.db('poq');
    roomCollection = db.collection("rooms");
    return callback(err);
  } );
}

function getDb() {
  return db;
}

async function isRoomCodeInDB(code) {
 let result = await roomCollection.findOne({
  code: code
 });
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
 let insertResult = await roomCollection.insertOne(item);
 return insertResult ? code : null;
}

async function deleteRoom(code){
  let result = await roomCollection.deleteOne({
   code: code
  });
  return result;
}

async function getRoomCodeInDB(code) {
 let result = await roomCollection.findOne({
  code: code
 });
 return result;
}

async function getAllRooms() {
 let result = await roomCollection.find().toArray();
 return result;
}

async function updateRoomCodesInDB(code, access_token, refresh_token) {
 let query = {
  code: code
 };
 let updated = {
  $set: {
   access_token: access_token,
   refresh_token: refresh_token
  }
 };
 let result = await roomCollection.updateOne(query, updated);
 return result;
}

async function updateCurrTrack(code, newCurrTrack) {
 let query = {
  code: code
 };
 let updated = {
  $set: {
   currentTrack: newCurrTrack
  }
 };
 let result = await roomCollection.updateOne(query, updated);
 return result;
}

async function updateRoomQueue(code, newQueue) {
 let query = {
  code: code
 };
 let updated = {
  $set: {
   queue: newQueue
  }
 };
 let result = await roomCollection.updateOne(query, updated);
 return result;
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
