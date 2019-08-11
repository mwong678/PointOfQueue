$(document).ready(function() {

  $('ul.tabs li').click(function() {
    var tab_id = $(this).attr('data-tab');

    $('ul.tabs li').removeClass('current');
    $('.tab-content').removeClass('current');

    $(this).addClass('current');
    $("#" + tab_id).addClass('current');
  });

  $('.searchBar').submit(function() {
    searchSongs();
    return false;
  });

  $('#searchText').focus(
    function(){
      $(this).val('');
  });

  $('#findRoomForm').submit(function() {
    findRoom();
    return false;
  });

  $(".btn, .deleteexitbtn, #findRoomBtn").on("touchstart", function(event) {
    $(this).css("background", "#2CC06B");
  });

  $(".btn, .deleteexitbtn, #findRoomBtn").on("touchend", function(event) {
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

  poq = getCookie("poq");
  if (poq == "") {
    $("#loginBox").css("display", "block");
    $("#loginBox").hide().fadeIn(1000);
    return;
  }

  poq = atob(poq).split(":");
  room_code = poq[0];
  playlist_id = poq[1];
  role = poq[2];

  //verify room code/owner?

  document.getElementById("labelCode").textContent = room_code;

  if (role == "owner") {
    newA = document.createElement('a');
    newA.appendChild(document.createTextNode("Open playlist in Spotify"));
    newA.href = "https://open.spotify.com/playlist/" + playlist_id;
    $("#playlistLabel").append(newA);
    $("#ownerInstructions").css("display", "block");
    $("#userInstructions").css("display", "none");
    $("#directions").css("display", "block");
    $("#deleteRoom").css("display", "block");
    $("#exitRoom").css("display", "none");
  } else {
    $("#ownerInstructions").css("display", "none");
    $("#userInstructions").css("display", "block");
    $("#directions").css("display", "none");
    $("#deleteRoom").css("display", "none");
    $("#exitRoom").css("display", "block");
  }

  $("#loginBox").css("display", "none");
  $(".container").css("display", "block");
  $(".container").hide().fadeIn(1000);

  setInterval(async () => {await getQueue()}, 1000);

});


function createRoom() {
  $.ajax({
    type: "GET",
    url: '/createroom',
    dataType: 'json',
    success: function(data) {
      console.log(data);
    },
    error: function(res, error) {
      var result = JSON.parse(res.responseText);
      toastr.error(result);
    }
  });
}

function deleteRoom() {
  if (confirm("Are you sure?")) {
    $.ajax({
      type: "GET",
      url: '/deleteroom',
      success: function(data) {
        deleteCookie("poq");
        location.reload();
      },
      error: function(res, error) {
        toastr.error("Couldn't delete room");
      }
    });
  }
}

function exitRoom() {
  if (confirm("Are you sure?")) {
    deleteCookie("poq");
    location.reload();
  }
}

function findRoom() {
  let code = document.getElementById('roomField').value;
  if (code == "") {
    toastr.error("Please enter a code");
    return;
  }
  $.ajax({
    type: "POST",
    url: '/findroom',
    data: {
      code: code
    },
    success: function(data) {
      location.reload();
    },
    error: function(res, error) {
      toastr.error("Couldn't find room");
    }
  });
}

function searchSongs() {
  var query = document.getElementById('searchText').value;

  if (query.length == 0) return;

  $.ajax({
    type: "POST",
    url: '/search',
    data: {
      query: query
    },
    dataType: 'json',
    success: function(data) {
      if (data.result.length == 0) return;
      $('#resultList').empty();
      var resultList = document.getElementById('resultList');
      var i;
      for (i = 0; i < data.result.length; i++) {
        var newLI = document.createElement("li");
        var songP = document.createElement("p");
        var artistP = document.createElement("p");
        var artistString = "";
        var j;

        for (j = 0; j < data.result[i].artists.length; j++) {
          if (j > 0) {
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
          if (!computerTapped) {
            computerTapped = setTimeout(function() {
              computerTapped = null
            }, 300); //wait 300ms then run single click code
          } else { //tapped within 300ms of last tap. double tap
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

      $(".resultItem").on("touchstart", function(event) {
        if (!tapped) {
          tapped = setTimeout(function() {
            tapped = null;
          }, 300);
        } else {
          clearTimeout(tapped);
          tapped = null;
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



function addToQueue(uri, song, artist) {
  if (!uri || !song || !artist) {
    return;
  }

  $.ajax({
    type: "POST",
    url: '/addtoqueue',
    data: {
      uri: uri,
      song: song,
      artist: artist
    },
    success: function(data) {
      toastr.success("Added " + song + " by " + artist + " to the queue");
    },
    error: function(res, error) {
      toastr.error("Error adding to queue");
    }
  });

}



function getQueue() {
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
      if (data.result.queue.length == 0) {
        $('#queueMsg').text('Queue is Empty');
        $('#queueMsg').css('display', 'block');
        $('#queueList').css('display', 'none');
      } else {
        $('#queueMsg').text('');
        $('#queueMsg').css('display', 'none');
        $('#queueList').css('display', 'block');
        for (var i = 0; i < data.result.queue.length; i++) {
          let song = data.result.queue[i];
          var newLI = document.createElement("li");
          var songP = document.createElement("p");
          var artistP = document.createElement("p");

          songP.setAttribute("class", "songP");
          artistP.setAttribute("class", "artistP");
          songP.appendChild(document.createTextNode(song.name));
          artistP.appendChild(document.createTextNode(song.artists));
          if (i == 0) {
            newLI.setAttribute("id", 'progressDiv');
            newLI.style.background = 'linear-gradient(to right, #2ecc71 ' + (percent) + '%, #ededed ' + (percent) + '%)';
          }
          newLI.appendChild(songP);
          newLI.appendChild(artistP);
          newLI.setAttribute("class", "queueItem");
          queueList.appendChild(newLI);
        }
      }

    },
    error: function(res, error) {
      if (JSON.parse(res.responseText).result == "DELETED") {
        deleteCookie("poq");
        location.reload();
      }
    }
  });
}
