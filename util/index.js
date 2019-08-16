const btoa = require('btoa'),
      atob = require('atob');

function base64Encode(data){
  return btoa(data);
}

function base64Decode(data){
  return atob(data);
}

function generateRandomString(length){
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < length; i++) {
   text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}


module.exports = {
  generateRandomString,
  base64Encode,
  base64Decode
}
