var c = document.getElementById("canvas");
var cx = c.getContext("2d");
var screenWidth = c.width = window.innerWidth;
var screenHeight = c.height = window.innerHeight;
c.focus();

var room = [];
var tileSize = 50;
var roomWidth = 1000;
var roomHeight = 1000;
var border = 100;
var view = {
  x: 0,
  y: 0
}
var offset = {
  x: 0,
  y: 0
}
var move = {
  up: false,
  down: false,
  left: false,
  right: false
}
var oldtime = new Date().getTime(), time = new Date().getTime();

window.onload = function(){
  start();
  var xclick = 0, yclick = 0, click = false;
  c.addEventListener("mousedown", function(event){
    click = true;
    xclick = (event.pageX + offset.x)/tileSize >> 0;
    yclick = (event.pageY + offset.y)/tileSize >> 0;
    room[yclick][xclick] ^= 1;
  });

  c.addEventListener("mouseup", function(event){
    click = false;
  });

  c.addEventListener("mousemove", function(event){
    var xtemp = (event.pageX + offset.x)/tileSize >> 0;
    var ytemp = (event.pageY + offset.y)/tileSize >> 0;
    if(click && (xtemp !== xclick || ytemp !== yclick)){
      xclick = xtemp;
      yclick = ytemp;
      room[yclick][xclick] ^= 1;
    }
    document.getElementById("tilex").innerHTML = "Tile X: "+xtemp;
    document.getElementById("tiley").innerHTML = "Tile Y: "+ytemp;

    document.getElementById("mousex").innerHTML = "Mouse X: "+event.x;
    document.getElementById("mousey").innerHTML = "Mouse Y: "+event.y;
    move.left = event.x < border;
    move.right = event.x > screenWidth-border;
    move.up = event.y < border;
    move.down = event.y > screenHeight-border;
  });

  c.addEventListener("keydown", function(event){
    var key = event.which || event.keyCode;
    if(key === 87 || key == 38) move.up = true;
    if(key === 83 || key === 40) move.down = true;
    if(key === 65 || key === 37) move.left = true;
    if(key === 68 || key === 39) move.right = true;

    if(key == 79){
      var input = prompt("Input new JSON", "");
      if(input !== null){
        parseRoom(JSON.parse(input));
      }
    }
    if(key == 80) prompt("New JSON for room", roomToJSON());
  });

  c.addEventListener("keyup", function(event){
    var key = event.which || event.keyCode;
    if(key === 87 || key == 38) move.up = false;
    if(key === 83 || key === 40) move.down = false;
    if(key === 65 || key === 37) move.left = false;
    if(key === 68 || key === 39) move.right = false;
  });
}
window.requestAnimFrame = (function(){
  return  window.requestAnimationFrame       ||
          window.webkitRequestAnimationFrame ||
          window.mozRequestAnimationFrame    ||
          function(callback){
            window.setTimeout(callback, 1000 / 30);
          };
})();
window.addEventListener('resize', function() {
  screenWidth = c.width = window.innerWidth;
  screenHeight = c.height = window.innerHeight;
});

function clamp(num, min, max){
  return Math.min(Math.max(num, min), max);
}

function parseRoom(newRoom){
  room = [];
  for(var i=0;i<newRoom.length;i++){
    var row = [];
    for(var j=0;j<newRoom[i].length;j++){
      row.push(parseInt(newRoom[i][j]));
    }
    room.push(row);
  }
  roomWidth = newRoom[0].length*tileSize;
  roomHeight = newRoom.length*tileSize;
}

function roomToJSON(){
  var json = "[\n";
  for(var i=0;i<room.length;i++){
    json += "\"";
    for(var j=0;j<room[i].length;j++){
      json += room[i][j];
    }
    if(i === room.length-1) json += "\"\n]";
    else json += "\",\n";
  }
  return json;
}

function start(){
  var roomtemp = [
    "11111111111111111111111111111111111111111111111111",
    "10001000000010000000100000000000000000000000000001",
    "10001000000010000000100000000000000000000000000001",
    "10001000000010000000100000000000000000000000000001",
    "10001000100010001000100000000000000000000000000001",
    "10001000100010001000100000000000000000000000000001",
    "10001000100010001000100000000000000000000000000001",
    "10001000100000001000100000000000000000000111111111",
    "10001000100000001000100000000000000000000100000001",
    "10001000100000001000100000000000000000000100000001",
    "10001000111111111000100000000000010100000100000001",
    "10001000100000000000100000000000110111111100010001",
    "10001000100000000000100000000000100000000000010001",
    "10001000100000000000100000000000100000000000010001",
    "10001000100011111111100000000000100000000000010001",
    "10001000100011111111111111111111111111111111110001",
    "10000000100000000000000000000000000000000000000001",
    "10000000100000000000000000000000000000000000000001",
    "10000000100000000000000000000000000000000000000001",
    "11111111111111111111111111111111111111111111111111"
  ];
  parseRoom(roomtemp);
  animloop();
}

function animloop(){
  requestAnimFrame(animloop);

  reposition();
  drawRoom();
  oldtime = time;
  time = new Date().getTime();
}

function reposition(){
  if(move.up) offset.y -= 15;
  if(move.down) offset.y += 15;
  if(move.left) offset.x -= 15;
  if(move.right) offset.x += 15;

  offset.x = clamp(offset.x, 0, roomWidth-screenWidth-1);
  offset.y = clamp(offset.y, 0, roomHeight-screenHeight-1);
}

function drawRoom(){
  var topTile = offset.y/tileSize >> 0;
  var bottomTile = (offset.y+screenHeight)/tileSize >> 0;
  var leftTile = offset.x/tileSize >> 0;
  var rightTile = (offset.x+screenWidth)/tileSize >> 0;
  var xshift = offset.x % tileSize;
  var yshift = offset.y % tileSize;
  for(var i=0;i<bottomTile-topTile+1;i++){
    for(var j=0;j<rightTile-leftTile+1;j++){
      if(room[i+topTile][j+leftTile] === 1) cx.fillStyle = "#ff0000";
      else cx.fillStyle = "#00ff00";
      cx.fillRect(-xshift+j*tileSize, -yshift+i*tileSize, tileSize, tileSize);
    }
  }
}
setInterval(function(){
  document.getElementById("fps").innerHTML = "FPS: "+Math.round(1000/(time-oldtime));
}, 250);
