import http from 'http';
import express from 'express';
import socketIO from 'socket.io';
import cors from 'cors';


const PORT = process.env.PORT || 5000;

const app = express();
app.use(cors())

app.get('/', (req, res) => res.json({msg: 'API is working!'}));

const server = http.createServer(app);

const io = socketIO(server);
io.on('connection', socket => {
  console.log('client connected on websocket');
});

server.listen(PORT, () => {
  console.log('server started and listening on port ' + PORT);
});
