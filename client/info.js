var infoPing = document.getElementById('ping');
var infoFps = document.getElementById('fps');
var infoRoom = document.getElementById('room');
var infoNumPlayer = document.getElementById('numPlayer');

var Info = {
  setPing: function(ping) {
    infoPing.innerHTML = "Ping: " + ping;
  },
  setFps: function(fps) {
    infoFps.innerHTML = "FPS: " + fps;
  },
  setRoom: function(room) {
    infoRoom.innerHTML = "Room: " + room;
  },
  setNumPlayer: function(num) {
    infoNumPlayer.innerHTML = "Players: " + num;
  }
}
