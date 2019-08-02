$(document).ready(function(){

  $('ul.tabs li').click(function(){
    var tab_id = $(this).attr('data-tab');

    $('ul.tabs li').removeClass('current');
    $('.tab-content').removeClass('current');

    $(this).addClass('current');
    $("#" + tab_id).addClass('current');
  });

  $('.searchBar').submit(function () {
   searchSongs();
   return false;
  });

  $('#findRoomForm').submit(function () {
   findRoom();
   return false;
  });

  $(".btn, .logoutbtn, .deleteexitbtn, #findRoomBtn, #searchBtn").on("touchstart",function(event){
      $(this).css("background", "#2CC06B");
  });

  $(".btn, .logoutbtn, .deleteexitbtn, #findRoomBtn, #searchBtn").on("touchend",function(event){
      $(this).css("background", "#2ecc71");
  });

  toastr.options = {
    "closeButton": false,
    "debug": false,
    "newestOnTop": false,
    "progressBar": false,
    "positionClass": "toast-bottom-center",
    "preventDuplicates": false,
    "onclick": null,
    "showDuration": "500",
    "hideDuration": "500",
    "timeOut": "1000",
    "extendedTimeOut": "2000",
    "showEasing": "swing",
    "hideEasing": "linear",
    "showMethod": "fadeIn",
    "hideMethod": "fadeOut"
  };

  let username = getCookie('username');
  if (username == ""){
    $("#signedIn").text("");
    $("#accountInfo").css("display", "none");
    deleteAllCookies();
    window.location.replace("/");
    return;
  }

  //verify username?

  $("#signedIn").text("Signed in as: " + username);
  $("#accountInfo").css("display", "block");
  $("#accountInfo").hide().fadeIn(1000);

  let room_code = getCookie("room_code");
  if (room_code == ""){
    $.ajax({
            type: "GET",
            url: '/checkforroom',
            dataType: 'json',
            success: function(data) {
              if (data.result == "Found"){
                location.reload();
              }
            },
            error: function(res, error) {
                var result = JSON.parse(res.responseText);
                toastr.error(result);
            }
    });
    $("#roomError").css('display', 'none');
    $(".container").css("display", "none");
    $("#loginBox").css("display", "block");
    $("#loginBox").hide().fadeIn(1000);
    return;
  }

  document.getElementById("labelCode").textContent = room_code;
  $("#accountInfo").css("display", "none");

  let room_owner = getCookie('room_owner');
  if (username == room_owner){
    newA = document.createElement('a');
    newA.appendChild(document.createTextNode("Open playlist in Spotify"));
    newA.href = "https://open.spotify.com/playlist/" + getCookie('playlist');
    $("#playlistLabel").append(newA);
    $("#ownerInstructions").css("display", "block");
    $("#userInstructions").css("display", "none");
    $("#directions").css("display", "block");
    $("#deleteRoom").css("display", "block");
    $("#exitRoom").css("display", "none");
  }else{
    document.getElementById('owner').textContent = room_owner;
    $("#ownerInstructions").css("display", "none");
    $("#userInstructions").css("display", "block");
    $("#directions").css("display", "none");
    $("#deleteRoom").css("display", "none");
    $("#exitRoom").css("display", "block");
  }

  var access_token = getCookie('access_token');
  var refresh_token = getCookie('refresh_token');
  var error = getCookie('error');

  if (error) {
    toastr.error('There was an error during the authentication');
  } else {
    if (access_token && refresh_token) {
      setInterval(getQueue, 1000);
      $("#loginBox").css("display", "none");
      $(".container").css("display", "block");
      $(".container").hide().fadeIn(1000);

    } else {
      $(".container").css("display", "none");
      $("#loginBox").css("display", "block");
      $("#loginBox").hide().fadeIn(1000);
    }
  }

});

function setErrors(json){
  var nameError = document.getElementById('nameError');
  var passwordError = document.getElementById('passwordError');
  var successMsg = document.getElementById('successMsg');

  if (json.name){
    nameError.innerHTML = json.name;
  }else{
    nameError.innerHTML = '';
  }

  if (json.password){
    passwordError.innerHTML = json.password;
  }else{
    passwordError.innerHTML = '';
  }

  if (json.success){
    successMsg.innerHTML = json.success;
  }else{
    successMsg.innerHTML = '';
  }
}

function copyRoomCode(){
  var copyText = document.getElementById("labelCode");
  var $temp = $("<input>");
  $("body").append($temp);
  $temp.val($(copyText).text()).select();
  document.execCommand("copy");
  $temp.remove();
  toastr.info("Copied to clipboard!");
}

function createRoom(){
  $.ajax({
          type: "GET",
          url: '/createroom',
          dataType: 'json',
          success: function(data) {},
          error: function(res, error) {
              var result = JSON.parse(res.responseText);
              toastr.error(result);
          }
  });
}

function deleteRoom(){
  if (confirm("Are you sure?")){
    $.ajax({
            type: "GET",
            url: '/deleteroom',
            dataType: 'json',
            success: function(data) {
                if (data.result == 'Success'){
                  location.reload();
                }
            },
            error: function(res, error) {
                var result = JSON.parse(res.responseText);
                toastr.error(result);
            }
    });
  }
}

function exitRoom(){
  if (confirm("Are you sure?")){
    $.ajax({
            type: "GET",
            url: '/exitroom',
            dataType: 'json',
            success: function(data) {
                if (data.result == 'Success'){
                  location.reload();
                }
            },
            error: function(res, error) {
                var result = JSON.parse(res.responseText);
                toastr.error(result);
            }
    });
  }
}

function logOut(){
  deleteAllCookies();
  location.reload();
}

function fetchDevices(){
  $.ajax({
          type: "GET",
          url: 'https://api.spotify.com/v1/me/player/devices',
          headers: { 'Authorization': 'Bearer ' +  getCookie('access_token')},
          dataType: 'json',
          success: function(data) {
            var deviceList = document.getElementById('deviceList');
            var device_id = getCookie('device_id');
            $("#deviceList").empty();
            var selected = -1;
              if (data && data.devices.length > 0){
                var devices = data.devices;
                for (var i = 0; i < devices.length; i++){
                  currDevice = devices[i];
                  console.log(currDevice);
                  deviceName = currDevice.name;
                  deviceId = currDevice.id;
                  if (currDevice.is_active){
                    selected = i;
                  }
                  option = document.createElement('option');
                  option.value = deviceId;
                  option.innerHTML = deviceName;
                  deviceList.appendChild(option);
                }
              }
              deviceList.selectedIndex = selected;

              if (selected == -1 || deviceList.options[deviceList.selectedIndex].value != device_id){

              }
          },
          error: function(res, error) {
              var result = JSON.parse(res.responseText);
              console.log(res);
          }
  });
}

function playSong(uri){
  var deviceList = document.getElementById('deviceList');
  var device_id = deviceList.options[deviceList.selectedIndex].value;
  console.log(device_id);
  $.ajax({
          type: "PUT",
          url: 'https://api.spotify.com/v1/me/player/play/?device_id='+device_id,
          headers: { 'Authorization': 'Bearer ' +  getCookie('access_token')},
          data: JSON.stringify({"uris": [uri]}),
          dataType: 'json',
          success: function(data) {
              console.log(data);
          },
          error: function(res, error) {
              console.log(res);
          }
  });
}

function findRoom(){
  let code = document.getElementById('roomField').value;
  if (code == ""){
    $("#roomError").text("Please enter a code");
    $("#roomError").css('display', 'block');
    return;
  }else{
    $("#roomError").text();
    $("#roomError").css('display', 'none');
  }

  $.ajax({
          type: "POST",
          url: '/findroom',
          data: {code: code},
          dataType: 'json',
          success: function(data) {
              $("#roomError").text();
              $("#roomError").css('display', 'none');
              location.reload();
          },
          error: function(res, error) {
              var result = JSON.parse(res.responseText);
              $("#roomError").text(result.result);
              $("#roomError").css('display', 'block');
          }
  });
}

function searchSongs(){
  var query = document.getElementById('searchText').value;
  var access_token = getCookie('access_token');
  var refresh_token = getCookie('refresh_token');
  var room_code = getCookie('room_code');
  var owner = getCookie('owner');
  var username = getCookie('username');

  if (query.length == 0){
    return;
  }
  if (!access_token || !refresh_token){
    location.reload();
    return;
  }
  if (!username){
    deleteAllCookies();
    location.reload();
    return;
  }
  $.ajax({
          type: "POST",
          url: '/search',
          data: {
                  query: query,
                  access_token: access_token,
                  refresh_token: refresh_token,
                  username: username
                },
          dataType: 'json',
          success: function(data) {
            if (data.result.length == 0){
              return;
            }
            $('#resultList').empty();
            var resultList = document.getElementById('resultList');
            var i;
            for (i = 0;i < data.result.length;i++){
              var newLI = document.createElement("li");
              var songP = document.createElement("p");
              var artistP = document.createElement("p");
              var artistString = "";
              var j;

              for (j = 0; j < data.result[i].artists.length; j++){
                if (j > 0){
                  artistString += ', ';
                }
                artistString += data.result[i].artists[j];
              }

              newLI.setAttribute("class", "resultItem");
              newLI.setAttribute("id", data.result[i].uri);
              songP.setAttribute("class", "songP");
              artistP.setAttribute("class", "artistP");
              songP.appendChild(document.createTextNode(data.result[i].name));
              artistP.appendChild(document.createTextNode(artistString));
              newLI.appendChild(songP);
              newLI.appendChild(artistP);
              resultList.appendChild(newLI);
            }


            var isTouchDevice = 'ontouchstart' in document.documentElement;
            var computerTapped = false;
            $(".resultItem").mousedown(function(event) {
                if (isTouchDevice == false) {
                  if(!computerTapped){
                    computerTapped = setTimeout(function(){
                        computerTapped=null
                    }, 300);   //wait 300ms then run single click code
                  } else {    //tapped within 300ms of last tap. double tap
                    clearTimeout(computerTapped); //stop single tap callback
                    computerTapped = null
                    var touchedItem = $(this);
                    var uri = event.currentTarget.id;
                    var song = event.currentTarget.children[0].innerHTML;
                    var artist = event.currentTarget.children[1].innerHTML;
                    addToQueue(uri, song, artist);
                  }
                }
            });

            var tapped = false;

            $(".resultItem").on("touchstart",function(event){
                if(!tapped){
                  tapped = setTimeout(function(){
                      tapped=null
                  }, 300);   //wait 300ms then run single click code
                } else {    //tapped within 300ms of last tap. double tap
                  clearTimeout(tapped); //stop single tap callback
                  tapped = null
                  var touchedItem = $(this);
                  var uri = event.currentTarget.id;
                  var song = event.currentTarget.children[0].innerHTML;
                  var artist = event.currentTarget.children[1].innerHTML;
                  addToQueue(uri, song, artist);
                }
            });

          },
          error: function(res, error) {
              var message = JSON.parse(res.responseText);
              toastr.error(message.result);
          }
  });
}

function changeDevice(){
  var deviceList = document.getElementById('deviceList');
  var device_id = deviceList.value == "None" ? '' : deviceList.value;

  $.ajax({
          type: "POST",
          url: '/changedevice',
          data: {device_id: device_id},
          dataType: 'json',
          success: function(data) {
            console.log(data.result);
          },
          error: function(res, error) {
            var result = JSON.parse(res.responseText);
            console.log(result.result);
          }
    });
}



function addToQueue(uri, song, artist){
  var access_token = getCookie('access_token');
  var refresh_token = getCookie('refresh_token');
  var username = getCookie('username');
  var device_id = getCookie('device_id');

  if (!uri || !song || !artist){
    return;
  }

  if (!access_token || !refresh_token){
    toastr.error("You are unauthorized!");
    location.reload();
    return;
  }
  if (!username){
    toastr.error("You are not logged in!");
    deleteAllCookies();
    location.reload();
    return;
  }


  $.ajax({
          type: "POST",
          url: '/addtoqueue',
          data: {uri: uri, song: song, artist: artist},
          dataType: 'json',
          success: function(data) {
            toastr.success(data.result);
          },
          error: function(res, error) {
            var result = JSON.parse(res.responseText);
            toastr.error(result.result);
          }
  });

}


function getQueue(){
  var access_token = getCookie('access_token');
  var refresh_token = getCookie('refresh_token');
  var username = getCookie('username');
  if (!access_token || !refresh_token){
    toastr.error("You are unauthorized!");
    location.reload();
    return;
  }
  if (!username){
    toastr.error("You are not logged in!");
    deleteAllCookies();
    location.reload();
    return;
  }
  let room_code = getCookie("room_code");
  $.ajax({
          type: "GET",
          url: '/queue',
          dataType: 'json',
          success: function(data) {

            var duration = data.result.currentTrack.duration;
            var progress = data.result.currentTrack.progress;
            var id = data.result.currentTrack.uri;
            var percent = (duration && progress) ? (progress * 100 / duration) : 0;
            $('#queueList').empty();
            var queueList = document.getElementById('queueList');
            if (data.result.queue.length == 0){
              $('#queueMsg').text('Queue is Empty');
              $('#queueMsg').css('display', 'block');
              $('#queueList').css('display', 'none');
            }else{
              $('#queueMsg').text('');
              $('#queueMsg').css('display', 'none');
              $('#queueList').css('display', 'block');
              for (var i = 0;i < data.result.queue.length;i++){
                let song = data.result.queue[i];
                var newLI = document.createElement("li");
                var songP = document.createElement("p");
                var artistP = document.createElement("p");

                songP.setAttribute("class", "songP");
                artistP.setAttribute("class", "artistP");
                songP.appendChild(document.createTextNode(song.name));
                artistP.appendChild(document.createTextNode(song.artists));
                if (i == 0){
                  newLI.setAttribute("id", 'progressDiv');
                  newLI.style.background = 'linear-gradient(to right, #2ecc71 '+(percent)+'%, #ededed '+(percent)+'%)';
                }
                newLI.appendChild(songP);
                newLI.appendChild(artistP);
                newLI.setAttribute("class", "queueItem");
                queueList.appendChild(newLI);
              }
            }

          },
          error: function(res, error) {
              if (JSON.parse(res.responseText).result == "Error getting room"){
                toastr.error("Room doesn't exist!");
                location.reload();
              }
          }
  });
}
