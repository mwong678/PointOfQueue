const express = require('express'),
      user = require('../controllers/user'),
      room = require('../controllers/room'),
      spotify = require('../controllers/spotify');

const router = express.Router();

//user controller
router.post('/login', user.logIn);
router.post('/signup', user.signUp);

//room controller
router.get('/createroom', room.createRoom);
router.post('/findroom', room.findRoom);
router.get('/deleteroom', room.deleteRoom);
router.get('/checkforroom', room.checkRoom);
router.get('/queue', room.queue);

//spotify controller
router.get('/callback', spotify.callback);
router.post('/search', spotify.search);
router.post('/addtoqueue', spotify.addToQueue);

module.exports = router;
