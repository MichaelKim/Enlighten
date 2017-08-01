function setupInput() {
  var move = {
    up: false,
    down: false,
    left: false,
    right: false
  };

  ct.addEventListener("keydown", function(event){ //press key down
    var key = event.which || event.keyCode;
    var updated = false;
    if((key === 87 || key === 38) && !move.up) {
      updated = true;
      move.up = true;
    }
    if((key === 83 || key === 40) && !move.down) {
      updated = true;
      move.down = true;
    }
    if((key === 65 || key === 37) && !move.left) {
      updated = true;
      move.left = true;
    }
    if((key === 68 || key === 39) && !move.right) {
      updated = true;
      move.right = true;
    }

    if(updated) {
      socket.emit("playerMove", moveEncode());
    }
  });

  ct.addEventListener("keyup", function(event){ //depress key
    var key = event.which || event.keyCode;
    if(key === 87 || key === 38) move.up = false;
    if(key === 83 || key === 40) move.down = false;
    if(key === 65 || key === 37) move.left = false;
    if(key === 68 || key === 39) move.right = false;
    socket.emit("playerMove", moveEncode());
  });

  function moveEncode(){ //encode move into 4-bit
    var result = 0;
    if(move.up) result += 1;
    if(move.down) result += 2;
    if(move.left) result += 4;
    if(move.right) result += 8;
    return result;
  }
}
