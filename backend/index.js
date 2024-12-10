const { Server } = require("socket.io");
const io = new Server({
  cors: {
    // origin: "http://192.168.1.127:5173", // Update to your frontend's actual URL
    origin: ["http://192.168.1.127:5173", "http://localhost:3001", "https://d3c0-2600-6c40-75f0-98a0-dc8-485d-6f7a-6e28.ngrok-free.app"],
    // origin: ["http://10.178.6.45:5173", "http://localhost:3001"],
    methods: ["GET", "POST"],
    },
});

io.on("connection", (socket) => {
  console.log("A user connected");

  // Listen for 'canvasImage' events and broadcast to all clients
  socket.on("canvasImage", (data) => {
    socket.broadcast.emit("canvasImage", data);
  });

  // Listen for 'chatMessage' events and broadcast to all clients
  socket.on("chatMessage", (data) => {
    console.log("Message received on server:", data);
    io.emit("chatMessage", data); // Use io.emit to send to all clients
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

io.listen(5001);
