import io from 'socket.io-client';

const socketURL = 'http://localhost:5000';
const options ={
  transports: ['websocket'],
  'force new connection': true
};

// store open sockets here for cleanup
let openSockets = [];
let client1;
let client2;
let client3;

beforeAll((done) => {
  client1 = io.connect(socketURL, options);

  client1.on('connect', () => {
    client2 = io.connect(socketURL, options);

    client2.on('connect', () => {
      client3 = io.connect(socketURL, options);

      client3.on('connect', () => {
        done();
      });
    });
  });
});

afterAll((done) => {
  // disconnect all open sockets
  openSockets.forEach(socket => {
    if (socket.connected) socket.disconnect();
  });

  // clear open sockets list
  openSockets = [];
  done();
});


describe("Room Creation and Auto Join", () => {
  test('should create room, and broadcast to all users', (done) => {
    // Definition of data to be passed
    const createRoomData = {
      roomData: { name: 'Room!', side: '0' },
      playerName: 'Sam'
    };

    // Definition of data to be expected
    let expectedRoomData = {
      id: 0,
      name: 'Room!',
      players: {
        "0": {
          name: 'Sam',
          socket: client1.id,
          skin: null
        },
        "1": {
          name: null,
          socket: null,
          skin: null
        }
      },
      secret: 0,
      status: 'waiting',
      isMultiplayer: true,
      turn: 0
    };

    // Handler for Client 2 when a room is created
    client2.on('room created', (rooms) => {
      expect(rooms).toContainEqual(expectedRoomData);
    });

    // Handler for Client 3 when a room is created
    client3.on('room created', (rooms) => {
      expect(rooms).toContainEqual(expectedRoomData);
      done();
    });

    // Emit create room event
    client1.emit('create room', createRoomData);
  });
});

describe("Joining of Room", () => {
  test('should join room, and notify all users', (done) => {
    // Definition of data to be passed
    const joinRoomData = {
      id: 0,
      playerName: 'Dave'
    };

    // Definition of data to be expected
    let expectedRoomData = {
      id: 0,
      name: 'Room!',
      players: {
        "0": {
          name: 'Sam',
          socket: client1.id,
          skin: null
        },
        "1": {
          name: 'Dave',
          socket: client2.id,
          skin: null
        }
      },
      secret: 0,
      status: 'playing',  // change room status since it is full
      isMultiplayer: true,
      turn: 0
    };

    // Client 1 handler for when another player joins its created room
    client1.on('player joined', (updatedRoom) => {
      expect(updatedRoom).toEqual(expectedRoomData);
    });

    // Client 2 handler for when it joins Client 1's room
    client2.on('room joined', (joinedRoom) => {
      expect(joinedRoom).toEqual(expectedRoomData);
      done();
    });

    // Client 3 handler for when a room/game starts
    client3.on('room started', (updatedRoomList) => {
      expect(updatedRoomList).toContainEqual(expectedRoomData);
      done();
    });

    // Emit join room event
    client2.emit('join room', joinRoomData);
  });
});

describe("Game Movement", () => {
  test('should make move, and notify opponent only', (done) => {
    // Definition of data to be passed
    const moveData = {
      id: 0,
      type: 'addPiece',
      src: null,
      dest: 15
    };

    // Definition of data to be expected
    let expectedMoveData = { ...moveData };

    // Client 3 handler for when opponent makes a move (shouldn't be triggered)
    client3.on('opponent moved', (updatedRoomList) => {
      done.fail(new Error('Client 3 should not receive move data'));
    });

    // Client 2 handler for when Client 1 makes a move
    client2.on('opponent moved', (opponentMove) => {
      expect(opponentMove).toEqual(expectedMoveData);
      done();
    });

    // Emit make move event
    client1.emit('make move', moveData);
  });

  test('should only allow players in a room to broadcast moves', (done) => {
    // Client 1 and Client 2 are in Room 0, while Client 3 is not in any.
    // Therefore, Client 1 and 2 should not receive move broadcast from Client 3

    // Definition of data to be passed
    const moveData = {
      id: 0,
      type: 'addPiece',
      src: null,
      dest: 20
    };

    // Client 1 handler for when opponent makes a move (shouldn't be triggered by Client 3)
    client1.on('opponent moved', (opponentMove) => {
      done.fail(new Error('Client 1 should not receive move data from Client 3'));
    });

    // Client 2 handler for when opponent makes a move (shouldn't be triggered by Client 3)
    client2.on('opponent moved', (opponentMove) => {
      done.fail(new Error('Client 2 should not receive move data from Client 3'));
    });

    // Client 3 handler for when move is rejected
    client3.on('move rejected', () => {
      done();
    });

    // Emit make move event
    client3.emit('make move', moveData);
  });
});