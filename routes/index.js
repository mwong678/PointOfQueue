const express = require('express'),
      room = require('../controllers/room'),
      spotify = require('../controllers/spotify');

const router = express.Router();

//room controller
router.get('/createroom', room.createRoom);
router.post('/findroom', room.findRoom);
router.get('/deleteroom', room.deleteRoom);
router.get('/queue', room.queue);


//spotify controller
router.get('/callback', spotify.callback);
router.post('/search', spotify.search);
router.post('/addtoqueue', spotify.addToQueue);

module.exports = router;
