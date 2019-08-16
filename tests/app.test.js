import io from 'socket.io-client';

const socketURL = 'http://localhost:5000';
const options ={
  transports: ['websocket'],
  'force new connection': true
};

/* Setup and Teardown

// beforeAll(() => {
// });

// afterAll(() => {
// });
*/

describe("Yonmoque Server", () => {
  test('should create room and broadcast to all users', (done) => {
    // Data definition
    const createRoomData = {
      roomData: { name: 'Room!', side: "0" },
      playerName: 'Sam'
    };
    let expectedRoomData = {
      id: 0,
      name: 'Room!',
      players: {
        "0": {
          name: 'Sam',
          socket: null,
          skin: null
        },
        "1": {
          name: null,
          socket: null,
          skin: null
        }
      },
      secret: 0,
      status: 'waiting'
    };

    const client1 = io.connect(socketURL, options);

    client1.on('connect', () => {
      // Set expected room data to contain client1's socket id
      expectedRoomData.players[0].socket = client1.id;

      // Client 1 is connected, connect Client 2
      const client2 = io.connect(socketURL, options);

      client2.on('connect', () => {
        // Make Client 1 create a game room
        client1.emit('create room', createRoomData);
      });

      client2.on('room created', (rooms) => {
        expect(rooms).toContainEqual(expectedRoomData);
        done();
      });
    });

    setTimeout(() => {
      done.fail(new Error('Reached timeout, test failed'))
    }, 150);
  });
});