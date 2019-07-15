const properties = require('./properties.json');
const MongoClient = require('mongodb').MongoClient;
const dbURI = properties.dbURI;

var _db;

module.exports = {

  connectToServer: function( callback ) {
    MongoClient.connect( dbURI,  { useNewUrlParser: true }, function( err, client ) {
      _db  = client.db('poq');
      return callback( err );
    } );
  },

  getDb: function() {
    return _db;
  }
};
