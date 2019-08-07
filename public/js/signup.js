$(document).ready(function() {
  $('.box').hide().fadeIn(1000);
});

$(".btn").on("touchstart", function(event) {
  $(this).css("background", "#2CC06B");
});

$(".btn").on("touchend", function(event) {
  $(this).css("background", "#2ecc71");
});

$('.logIn').submit(function() {
  signUp();
  return false;
});

function goBack() {
  window.location.replace("/");
}

function signUp() {
  var username = document.getElementById("usernameField").value;
  var password = document.getElementById("passwordField").value;
  var confirmPassword = document.getElementById("confirmPasswordField").value;
  var usernameError = document.getElementById('usernameError');
  var passwordError = document.getElementById('passwordError');
  var confirmPasswordError = document.getElementById('confirmPasswordError');
  var successMsg = document.getElementById('successMsg');
  var errorMsg = document.getElementById('errorMsg');

  if (!username) {
    usernameError.innerHTML = "Please enter a username.";
    return;
  } else if (username.length < 4) {
    usernameError.innerHTML = "Username must be at least 4 characters.";
    return;
  } else {
    usernameError.innerHTML = "";
  }

  if (!password) {
    passwordError.innerHTML = "Please enter a password.";
    return;
  } else if (password.length < 6) {
    passwordError.innerHTML = "Password must be at least 6 characters.";
    return;
  } else {
    passwordError.innerHTML = "";
  }

  if (!confirmPassword) {
    confirmPasswordError.innerHTML = "Please confirm your password.";
    return;
  } else if (password != confirmPassword) {
    confirmPasswordError.innerHTML = "Passwords don't match";
    return;
  } else {
    confirmPasswordError.innerHTML = "";
  }

  $.ajax({
    type: "POST",
    url: '/signup',
    data: {
      username: username,
      password: password
    },
    dataType: 'json',
    success: function(data) {
      successMsg.innerHTML = data.result;
      errorMsg.innerHTML = "";
      window.location.replace("/");
    },
    error: function(res, error) {
      var result = JSON.parse(res.responseText);
      successMsg.innerHTML = "";
      errorMsg.innerHTML = result.result;
    }
  });
}
