import http from 'http';
import express from 'express';
import socketIO from 'socket.io';
import cors from 'cors';


const PORT = process.env.PORT || 5000;

const app = express();

app.use(cors())

// Temporarily serve fake data, with this variable
let rooms = [];

app.get('/', (req, res) => res.json({ msg: 'API is working!' }));
app.get('/rooms', (req, res) => res.json({ rooms }));

const server = http.createServer(app);

const io = socketIO(server);
io.on('connection', socket => {
  console.log('client connected on websocket');

  socket.on('create room', ({roomData, playerName}) => {
    const { name, side } = roomData;
    let players = {
      "0": {
        name: null
      },
      "1": {
        name: null
      }
    };
    players[side].name = playerName;

    // basic validation
    if (name !== undefined && side !== undefined) {
      const room = {
        name,
        players,
        status: 'waiting',
      };

      // temporarily use room index as secret key to verify following requests
      socket.emit('room joined', { ...room, secret: rooms.push(room) });
      socket.broadcast.emit('room created', rooms);
    }
  });
});

server.listen(PORT, () => {
  console.log('server started and listening on port ' + PORT);
});
