var express = require("express");
var app     = express();
var comp    = require("compression");
var http    = require("http").createServer(app);
var io      = require("socket.io").listen(http);
var rooms   = require("./room.json");

app.use(comp());
app.use(express.static(__dirname + '/../client'));
var port = process.env.PORT  || 5000;
http.listen(port, function(){
  console.log("listening on:" + port);
});

var config = {
  "tileSize": 50,
  "radius": 100,
  "border": 300,
  "playerSize": 24
};
var speed = 0.2;
var lightLength = 5*60*1000; //5 minutes
var plightDecay = 0.0005;

var sockets = {};
var players = [];
var lights = [];
var campfires = [];
for(var i=0;i<rooms.length;i++){
  lights.push([]);
  campfires.push([]);
  for(var j=0;j<rooms[i].campfire.length;j++){
    campfires[i].push(rooms[i].campfire[j]);
  }
}

io.on("connection", function(socket){
  var currPlayer = {
    id: socket.id,
    x: rooms[0].startx * config.tileSize,
    y: rooms[0].starty * config.tileSize,
    xoffset: 0,
    yoffset: 0,
    hue: Math.round(Math.random() * 360),
    light: 1.0,
    move:{
      up: false,
      down: false,
      left: false,
      right: false,
    },
    room: 0,
    roomWidth: rooms[0].grid[0].length * config.tileSize,
    roomHeight: rooms[0].grid.length * config.tileSize,
    dead: false
  };

  socket.on("startClient", function(){
    var index = findID(currPlayer.id);
    if(index > -1) players.splice(index, 1);
    socket.emit("startServer", currPlayer, players, rooms[0].grid, campfires[0]);
  });

  socket.on("confirm", function(data){
    currPlayer = data;
    currPlayer.x = rooms[currPlayer.room].startx * config.tileSize;
    currPlayer.y = rooms[currPlayer.room].starty * config.tileSize;
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

  socket.on("respawn", function(){
    currPlayer.x = rooms[currPlayer.room].startx * config.tileSize;
    currPlayer.y = rooms[currPlayer.room].starty * config.tileSize;
    currPlayer.move = {
      up: false,
      down: false,
      left: false,
      right: false
    };
    currPlayer.dead = false;
    socket.emit("startServer", currPlayer, players, rooms[currPlayer.room].grid, campfires[currPlayer.room]);
  });

  socket.on("addLight", function(data){ //only used in debug
    newLight(data.x, data.y, currPlayer.room);
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
    //sockets[currPlayer.id] = undefined;
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

function findLight(id, room){
  for(var i=0;i<lights[room].length;i++){
    if(id === lights[room].id) return i;
  }
  return -1;
}

function newLight(xx, yy, room){
  var newid = (xx + yy) * (xx + yy + 1) / 2 + yy;
  lights[room].push({x: xx, y: yy, id: newid, fade: 1.0});
  setTimeout(function(){
    var int = setInterval(function(){
      var index = findLight(newid, room);
      if(index > -1){
        lights[room][index].fade -= 0.02;
        if(lights[room][index].fade <= 0){
          lights[room].splice(index, 1);
          clearInterval(int);
        }
      }
    }, 20);
  }, lightLength);
}

/*function find(array, element, property){
  for(var i=0;i<array.length;i++){
    if(array[i][property] === element) return i;
  }
  return -1;
}*/

function loadNextLevel(player){
  player.room++;
  if(player.room >= rooms.length) player.room = rooms.length - 1;
  player.x = rooms[player.room].startx * config.tileSize;
  player.y = rooms[player.room].starty * config.tileSize;
  player.roomWidth = rooms[player.room].grid[0].length * config.tileSize;
  player.roomHeight = rooms[player.room].grid.length * config.tileSize;
  player.light = 1.0;
  sockets[player.id].emit("newRoom", player, rooms[player.room].grid, campfires[player.room]);
}

function movePlayers(){
  for(var i=0;i<players.length;i++){
    if(players[i].dead) continue;

    //decay player light
    if(players[i].light > 0) players[i].light -= plightDecay;
    if(players[i].light < 0) players[i].light = 0;

    //move player
    var pRoom = players[i].room;
    if(players[i].move.up) players[i].y -= 5;
    if(players[i].move.down) players[i].y += 5;
    if(players[i].move.left) players[i].x -= 5;
    if(players[i].move.right) players[i].x += 5;

    players[i].x = clamp(players[i].x, config.playerSize/2, players[i].roomWidth-config.playerSize/2-1);
    players[i].y = clamp(players[i].y, config.playerSize/2, players[i].roomHeight-config.playerSize/2-1);

    if(players[i].xoffset < players[i].x - players[i].sWidth + config.border){ //player too much to the right
      players[i].xoffset += (players[i].x - players[i].sWidth + config.border - players[i].xoffset) * speed;
    }
    else if(players[i].xoffset > players[i].x - config.border){ //player too much to the left
      players[i].xoffset += (players[i].x - config.border - players[i].xoffset) * speed;
    }

    if(players[i].yoffset < players[i].y - players[i].sHeight + config.border){ //player too much down
      players[i].yoffset += (players[i].y - players[i].sHeight + config.border - players[i].yoffset) * speed;
    }
    else if(players[i].yoffset > players[i].y - config.border){ //player too much up
      players[i].yoffset += (players[i].y - config.border - players[i].yoffset) * speed;
    }

    players[i].xoffset = clamp(players[i].xoffset, 0, players[i].roomWidth-players[i].sWidth-1);
    players[i].yoffset = clamp(players[i].yoffset, 0, players[i].roomHeight-players[i].sHeight-1);

    var top = (players[i].y-config.playerSize/2)/config.tileSize >> 0;
    var bottom = (players[i].y+config.playerSize/2)/config.tileSize >> 0;
    var left = (players[i].x-config.playerSize/2)/config.tileSize >> 0;
    var right = (players[i].x+config.playerSize/2)/config.tileSize >> 0;

    if(rooms[pRoom].grid[top][left] === "1" || rooms[pRoom].grid[top][right] === "1" || rooms[pRoom].grid[bottom][left] === "1" || rooms[pRoom].grid[bottom][right] === "1"){
      players[i].dead = true;
      sockets[players[i].id].emit("dead", players[i]);
      newLight(players[i].x, players[i].y, pRoom);

      var index = findID(players[i].id);
      if(index > -1) players.splice(index, 1);
    }

    for(var j=0;j<campfires[pRoom].length;j++){ //refresh player light
      if((left === campfires[pRoom][j].x || right === campfires[pRoom][j].x) &&  (top === campfires[pRoom][j].y || bottom === campfires[pRoom][j].y)){
        players[i].light = 1.0;
      }
    }

    if(left >= rooms[pRoom].finishl && right <= rooms[pRoom].finishr && top >= rooms[pRoom].finishu && bottom <= rooms[pRoom].finishd){ //finish level
      loadNextLevel(players[i]);
    }
  }
}

function update(){
  players.forEach(function(p){
    if(p.dead) return;

    var playersSection = [];
    players.forEach(function(pp){
      if(p.id !== pp.id &&
        pp.x+config.playerSize/2 > p.xoffset &&
        pp.x-config.playerSize/2 < p.xoffset+p.sWidth &&
        pp.y+config.playerSize/2 > p.yoffset &&
        pp.y-config.playerSize/2 < p.yoffset+p.sHeight &&
        p.room === pp.room) playersSection.push({x: pp.x, y: pp.y, hue: pp.hue, light: pp.light});
    });
    var player = {x: p.x, y: p.y, xoffset: p.xoffset, yoffset: p.yoffset, light: p.light};
    sockets[p.id].emit("newPosition", player, playersSection, players.length);

    var lightsSection = [];
    for(var j=0;j<lights[p.room].length;j++){
      if(lights[p.room][j].x+config.radius > p.xoffset &&
         lights[p.room][j].x-config.radius < p.xoffset+p.sWidth &&
         lights[p.room][j].y+config.radius > p.yoffset &&
         lights[p.room][j].y-config.radius < p.yoffset+p.sHeight) lightsSection.push(lights[p.room][j]);
    }
    sockets[p.id].emit("newLights", lightsSection);
  });
}

setInterval(movePlayers, 16);
setInterval(update, 16);
