var express = require("express");
var app     = express();
var http    = require("http").Server(app);
var io      = require("socket.io")(http);
var room    = require("./room.json");

app.use(express.static(__dirname + '/../client'));

var config = {
  "tileSize": 50,
  "radius": 100,
  "roomWidth": 2500,
  "roomHeight": 1000,
  "border": 200,
  "playerSize": 24
};
var finish = {
  x: 48,
  y: 18
}
var speed = 0.05;

var sockets = {};
var players = [];
var lights = [];

io.on("connection", function(socket){
  var currPlayer = {
    id: socket.id,
    x: 100,
    y: 100,
    xoffset: 0,
    yoffset: 0,
    hue: Math.round(Math.random() * 360),
    move:{
      up: false,
      down: false,
      left: false,
      right: false,
    }
  };

  socket.on("startClient", function(){
    var index = findID(currPlayer.id);
    if(index > -1) players.splice(index, 1);
    socket.emit("startServer", currPlayer, players);
  });

  socket.on("confirm", function(data){
    currPlayer = data;
    currPlayer.x = 100;
    currPlayer.y = 100;
    currPlayer.move = {
      up: false,
      down: false,
      left: false,
      right: false
    };
    players.push(currPlayer);
    sockets[currPlayer.id] = socket;
    console.log("New Player: " + currPlayer.id);
  });

  socket.on("addLight", function(data){
    newLight(data.x, data.y);
  });

  socket.on("playerMove", function(data){
    currPlayer.move.up = data & 1;
    currPlayer.move.down = data & 2;
    currPlayer.move.left = data & 4;
    currPlayer.move.right = data & 8;
  });

  socket.on("resize", function(sWidth, sHeight){
    currPlayer.sWidth = sWidth;
    currPlayer.sHeight = sHeight;
  });

  socket.on("ping", function(date){
    socket.emit("pong", date);
  });

  socket.on('disconnect', function(){
    var index = findID(currPlayer.id);
    if(index > -1) players.splice(index, 1);
    console.log("Player dc: " + currPlayer.id);
  });
});

function clamp(num, min, max){
  return Math.min(Math.max(num, min), max);
}

function findID(id){
  for(var i=0;i<players.length;i++){
    if(players[i].id === id) return i;
  }
  return -1;
}

function findLight(x, y){
  for(var i=0;i<lights.length;i++){
    if(lights[i].x === x && lights[i].y === y) return i;
  }
  return -1;
};

function newLight(xx, yy){
  lights.push({x: xx, y: yy, fade: 1.0});
  setTimeout(function(){
    var int = setInterval(function(){
      var index = findLight(xx, yy);
      if(index > -1){
        lights[index].fade -= .02;
        if(lights[index].fade <= 0){
          lights.splice(index, 1);
          clearInterval(int);
        }
      }
    }, 20);
  }, 60000);
}

function encodeRoom(values){
  var size = values.length / 16 + 1 >> 0, offset = 0, packed = "";
  for(var i=0;i<size;i++,offset+=16){
    packed += String.fromCharCode(parseInt(values.substring(offset, offset + 16), 2));
  }
  return packed;
}
/*function find(array, element, property){
  for(var i=0;i<array.length;i++){
    if(array[i][property] === element) return i;
  }
  return -1;
}*/

function movePlayers(){
  for(var i=0;i<players.length;i++){
    if(players[i].move.up) players[i].y -= 5;
    if(players[i].move.down) players[i].y += 5;
    if(players[i].move.left) players[i].x -= 5;
    if(players[i].move.right) players[i].x += 5;

    players[i].x = clamp(players[i].x, config.playerSize/2, config.roomWidth-config.playerSize/2-1);
    players[i].y = clamp(players[i].y, config.playerSize/2, config.roomHeight-config.playerSize/2-1);

    players[i].xoffset = clamp(players[i].xoffset, players[i].x-players[i].sWidth+config.border, players[i].x-config.border);
    players[i].yoffset = clamp(players[i].yoffset, players[i].y-players[i].sHeight+config.border, players[i].y-config.border);

    players[i].xoffset = clamp(players[i].xoffset, 0, config.roomWidth-players[i].sWidth-1);
    players[i].yoffset = clamp(players[i].yoffset, 0, config.roomHeight-players[i].sHeight-1);

    var top = (players[i].y-config.playerSize/2)/config.tileSize >> 0;
    var bottom = (players[i].y+config.playerSize/2)/config.tileSize >> 0;
    var left = (players[i].x-config.playerSize/2)/config.tileSize >> 0;
    var right = (players[i].x+config.playerSize/2)/config.tileSize >> 0;

    /*if(room[top][left] === "1" || room[top][right] === "1" || room[bottom][left] === "1" || room[bottom][right] === "1"){
      sockets[players[i].id].emit("dead");
      newLight(players[i].x, players[i].y);

      var index = findID(players[i].id);
      if(index > -1) players.splice(index, 1);
    }*/

    if((left === finish.x || right === finish.x) && (top === finish.y || bottom === finish.y)){
      sockets[players[i].id].emit("finish");
      players[i].x = 100;
      players[i].y = 100;
    }
  }
}

function update(){
  players.forEach(function(p){
    var playersSection = [];
    players.forEach(function(pp){
      if(p.id !== pp.id &&
        pp.x+config.playerSize/2 > p.xoffset &&
        pp.x-config.playerSize/2 < p.xoffset+p.sWidth &&
        pp.y+config.playerSize/2 > p.yoffset &&
        pp.y-config.playerSize/2 < p.yoffset+p.sHeight) playersSection.push({x: pp.x, y: pp.y, hue: pp.hue});
    });
    var player = {x: p.x, y: p.y, xoffset: p.xoffset, yoffset: p.yoffset};
    sockets[p.id].emit("newPosition", player, playersSection);

    var topTile = p.yoffset/config.tileSize >> 0;
    var bottomTile = (p.yoffset+p.sHeight)/config.tileSize >> 0;
    var leftTile = p.xoffset/config.tileSize >> 0;
    var rightTile = (p.xoffset+p.sWidth)/config.tileSize >> 0;
    var roomSection = "";
    for(var j=0;j<bottomTile-topTile+1;j++){
      roomSection += room[j+topTile].slice(leftTile, rightTile+1);
    }
    sockets[p.id].emit("newRoom", encodeRoom(roomSection));

    var lightsSection = [];
    for(var j=0;j<lights.length;j++){
      if(lights[j].x+config.radius > p.xoffset &&
         lights[j].x-config.radius < p.xoffset+p.sWidth &&
         lights[j].y+config.radius > p.yoffset &&
         lights[j].y-config.radius < p.yoffset+p.sHeight) lightsSection.push(lights[j]);
    }
    sockets[p.id].emit("newLights", lightsSection);
  });
}

setInterval(movePlayers, 16);
setInterval(update, 16);

var ipaddress = process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1";
var port = process.env.OPENSHIFT_NODEJS_PORT  || 8080;
http.listen(port, ipaddress, function(){
  console.log("listening on " + ipaddress + ":" + port);
});
