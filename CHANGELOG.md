# Changelog

### v2.0.1
- Add two new levels
- Finish position is now rectangular

### v2.0.0
- Multiple levels added
  - Respawn logic updated
  - Each room has
    - Array of lights
    - Only shows players in it
    - Start / finish positions
- Basic start button added
- Displays number of players online

### v1.3.1
- Enable gzip compression
- socket.io CDN used

### v1.3.0
- New website: [Heroku Deploy](https://enlighten-game.herokuapp.com)
  - Lower ping, higher fps
- Remove Room Creator temporarily

### v1.2.0
- Completely remove room sending
  - Room only sent when client connects to server
  - Room drawn once to buffer, buffer drawn only when view offset is changed

### v1.1.1
- Remove Mouse/Player positions
- Save full light gradient for faster drawing
- Create buffer for `drawRoom()`
- Only emit `playerMove` when player moves (instead of `gameLoop()`)

### v1.1.0
- Fix crashing when player dies/disconnects
- Clean up `movePlayers()` using clamp
- More accurate light finding in `newLight()`
- Created simple room creator
- New starting room

### v1.0.0
- Initial upload
- Available at [nodejs-warblewarble.rhcloud.com](nodejs-warblewarble.rhcloud.com) (prone to change)
