const mongo = require('../db/mongo');

const logIn = async (req, res) => {
  const post = req.body;
  const username = post.username;
  const password = post.password;

  try {

    usernameQuery = await mongo.isUserNameInDB(username);
    if (usernameQuery == null){
      res.status(404);
      res.send({
       username: "Username not found"
      });
      return;
    }

    if (password === usernameQuery.password) {
     res.cookie("username", username);
     res.status(200);
     res.send({
      username: username
     });
     return;
    } else {
     res.status(404);
     res.send({
      password: "Incorrect Password"
     });
     return;
    }

  }catch(e){
    console.log("ERROR LOGGING IN -> " + e.message);
  }
}

const signUp = async (req, res) => {
  const request = req.body;
  const username = request.username;
  const password = request.password;

  try {

    usernameQuery = await mongo.isUserNameInDB(username);
    if (usernameQuery != null){
      res.status(404);
      res.send({
       result: "Username already exists"
      });
      return;
    }

    addUserResult = await mongo.addUserInDB(username, password);
    if (!addUserResult){
     res.status(404);
     res.send({
      result: "Error creating user"
     });
     return;
    }

    res.cookie("username", username);
    res.send({
      result: "Success! Redirecting..."
    });

  }catch(e){
    console.log("ERROR SIGNING UP -> " + e.message);
  }
}

module.exports = {
  logIn,
  signUp
}
