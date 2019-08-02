$(document).ready(function() {
  let username = getCookie('username');
  if (username != "") {
    window.location.replace("/room");
  }
  $('.box').hide().fadeIn(1000);
  $('#successMsg').css('display', 'none');
  $('#usernameError').css('display', 'none');
  $('#passwordError').css('display', 'none');
  $(".btn").on("touchstart", function(event) {
    $(this).css("background", "#2CC06B");
  });

  $(".btn").on("touchend", function(event) {
    $(this).css("background", "#2ecc71");
  });

  $('.logIn').submit(function() {
    submitCreds();
    return false;
  });
});

function setErrors(json) {
  var usernameError = document.getElementById('usernameError');
  var passwordError = document.getElementById('passwordError');
  var successMsg = document.getElementById('successMsg');

  if (json.username) {
    $('#usernameError').text(json.username);
    $('#usernameError').css('display', 'block');
  } else {
    $('#usernameError').text('');
    $('#usernameError').css('display', 'none');
  }

  if (json.password) {
    $('#passwordError').text(json.password);
    $('#passwordError').css('display', 'block');
  } else {
    $('#passwordError').text('');
    $('#passwordError').css('display', 'none');
  }

  if (json.success) {
    $('#successMsg').text(json.success);
    $('#successMsg').css('display', 'block');
  } else {
    $('#successMsg').text('');
    $('#successMsg').css('display', 'none');
  }
}

function submitCreds() {
  var username = document.getElementById('usernameField').value;
  var password = document.getElementById('passwordField').value;
  $.ajax({
    type: "POST",
    url: '/',
    data: {
      username: username,
      password: password
    },
    dataType: 'json',
    success: function(data) {
      setErrors({
        "success": "Success! Logging In..."
      });
      window.location.replace("/room");
    },
    error: function(res, error) {
      var result = JSON.parse(res.responseText);
      setErrors(result);
    }
  });
}
