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

  socket.on('create room', ({ roomData, playerName }) => {
    const { name, side } = roomData;
    let players = {
      "0": {
        name: null,
        skin: null
      },
      "1": {
        name: null,
        skin: null
      }
    };
    players[side].name = playerName;

    // basic validation
    if (name !== undefined && side !== undefined) {
      // auto increment room ID
      const id = rooms.length === 0 ? 0 : rooms[rooms.length-1].id + 1;

      const room = {
        id,
        name,
        players,
        secret: id, // temporarily use room id as secret key to verify following requests
        status: 'waiting',
      };

      rooms.push(room);

      socket.emit('room joined', {
        ...room,
        isMultiplayer: true
      });
      io.emit('room created', rooms);
    }
  });
});

server.listen(PORT, () => {
  console.log('server started and listening on port ' + PORT);
});
