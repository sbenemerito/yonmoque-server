import http from 'http';
import express from 'express';
import socketIO from 'socket.io';
import cors from 'cors';


const PORT = process.env.PORT || 5000;

const app = express();

app.use(cors())

// Temporarily serve fake data, with this variable
let rooms = [];
let playingRooms = [];

app.get('/', (req, res) => res.json({ msg: 'API is working!' }));
app.get('/rooms', (req, res) => res.json({ rooms }));

const getSecret = () => [...Array(30)].map(() => Math.random().toString(36)[2]).join('');
const server = http.createServer(app);

const io = socketIO(server);
io.on('connection', socket => {
  console.log('client connected on websocket');

  // insert adding online players count?

  socket.on('create room', ({ roomData, playerName }) => {
    const { side } = roomData;

    // basic validation
    if (side !== undefined) {
      let players = {
        "0": {
          name: null,
          socket: null,
          skin: null
        },
        "1": {
          name: null,
          socket: null,
          skin: null
        }
      };
      players[side].name = `Player ${side + 1}`;
      players[side].socket = socket.id;

      // auto increment room ID
      const id = rooms.length === 0 ? 0 : rooms[rooms.length-1].id + 1;

      const room = {
        id,
        name: socket.id.substring(0, 6),
        players,
        secret: getSecret(), // will be used as socket room
        isMultiplayer: true,
        turn: 0,
        playersEnded: [false, false],
        startedTimestamp: null
      };

      rooms.push(room);
      socket.join(room.secret);

      socket.emit('room joined', room);
      io.emit('room created', rooms);
    }
  });

  socket.on('join room', ({ id, playerName }) => {
    // findIndex returns -1 when no match is found
    const roomIndex = rooms.findIndex(room => room.id === id);

    // only do something when a matching room is found
    if (roomIndex > -1) {
      let room = rooms[roomIndex];

      socket.join(room.secret);

      // update room object
      const playerSide = room.players[0].name === null ? 0 : 1;
      room.players[playerSide].name = `Player ${playerSide + 1}`;
      room.players[playerSide].socket = socket.id;
      room.startedTimestamp = new Date();

      // Move specific room to playingRooms
      rooms = rooms.filter(gameRoom => gameRoom.id !== id);
      playingRooms.push(room);

      socket.to(room.secret).emit('player joined', room);
      socket.emit('room joined', room);
      io.emit('room started', rooms);
    }
  });

  socket.on('make move', ({ id, type, src, dest }) => {
    // findIndex returns -1 when no match is found
    const roomIndex = playingRooms.findIndex(room => room.id === id);

    // only do something when a matching room is found
    if (roomIndex > -1) {
      const gameRoom = playingRooms[roomIndex];
      const roomSockets = [gameRoom.players[0].socket, gameRoom.players[1].socket];
      // indexOf returns -1 when no match is found
      const playerIndex = roomSockets.indexOf(socket.id);

      // only continue when player belongs to the room and his turn
      if (playerIndex > -1 && gameRoom.turn === playerIndex) {
        // emit move data to room
        socket.to(gameRoom.secret).emit('opponent moved', { id, type, src, dest });
        // update current turn in game room
        playingRooms[roomIndex].turn = (playingRooms[roomIndex].turn - 1) * -1;
      } else {
        socket.emit('move rejected');
      }
    }
  });

  socket.on('disconnect', () => {
    // declare opponent as winner, for ongoing games disconnected player was in
    const playingRoom = playingRooms.find(room => {
      const roomSockets = [room.players[0].socket, room.players[1].socket];
      return roomSockets.includes(socket.id);
    });

    if (playingRoom !== undefined) {
      socket.to(playingRoom.secret).emit('opponent left');
      playingRooms = playingRooms.filter(room => room.id !== playingRoom.id);
    }

    // remove waiting games disconnected player was in
    const waitingRoom = rooms.find(room => {
      const roomSockets = [room.players[0].socket, room.players[1].socket];
      return roomSockets.includes(socket.id);
    });

    if (waitingRoom !== undefined) {
      rooms = rooms.filter(room => room.id !== waitingRoom.id);
      io.emit('room ended');
    }
  });
});

// Remove playing rooms that have lasted for more than an hour
const hourInMilliseconds = 3600000;
const cleanRooms = setInterval(() => {
  const currentTimestamp = (new Date()).getTime();

  playingRooms = playingRooms.filter(room => {
    return currentTimestamp - room.startedTimestamp < hourInMilliseconds;
  });
}, hourInMilliseconds);

server.listen(PORT, () => {
  console.log('server started and listening on port ' + PORT);
});
