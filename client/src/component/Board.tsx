import React, { useRef, useEffect, useState } from "react";
import io, { Socket } from "socket.io-client";
import {
  FaPencilAlt,
  FaEraser,
  FaUndo,
  FaRedo,
  FaDownload,
  FaRegSquare,
  FaPlay,
  FaRegCircle,
  FaSlash,
  FaRegStar,
} from "react-icons/fa";
import { AiOutlineClear } from "react-icons/ai";
import { BiText } from "react-icons/bi";

interface MyBoard {
  initialBrushColor: string;
  initialBrushSize: number;
}

interface TextBox {
  id: number;
  x: number;
  y: number;
  text: string;
  isDragging: boolean;
}

interface ChatMessage {
  username: string;
  message: string;
}

const Board: React.FC<MyBoard> = ({ initialBrushColor, initialBrushSize }) => {
  const [username, setUsername] = useState<string | null>(null);
  const [inputUsername, setInputUsername] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [brushColor, setBrushColor] = useState(initialBrushColor);
  const [brushSize, setBrushSize] = useState(initialBrushSize);
  const [isErasing, setIsErasing] = useState(false);
  const [isDrawingShape, setIsDrawingShape] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);
  const [draggedBoxId, setDraggedBoxId] = useState<number | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  useEffect(() => {
    if (username) {
      const newSocket = io(
        "https://d3c0-2600-6c40-75f0-98a0-dc8-485d-6f7a-6e28.ngrok-free.app",
        {
          // const newSocket = io("http://10.178.6.45:5001", {
          transports: ["websocket"], // Use WebSocket transport only
          query: { username },
          reconnectionAttempts: 5, // Retry connection a few times
          timeout: 10000, // Set connection timeout
        }
      );
      console.log("Connected to socket:", newSocket);
      setSocket(newSocket);
      console.log("Connected to server with ID:", newSocket.id);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [username]);

  useEffect(() => {
    if (socket) {
      // Listener for 'canvasImage' to sync drawings across devices
      socket.on("canvasImage", (data: string) => {
        const image = new Image();
        image.src = data;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        image.onload = () => {
          ctx?.drawImage(image, 0, 0);
        };
      });

      // Listener for 'chatMessage' to sync chat messages across devices
      socket.on(
        "chatMessage",
        (data: { username: string; message: string }) => {
          console.log("Message received on client:", data); // Log for debugging
          setChatMessages((prevMessages) => [...prevMessages, data]);
        }
      );

      // Cleanup function to remove listeners on unmount
      return () => {
        socket.off("canvasImage");
        socket.off("chatMessage");
      };
    }
  }, [socket]);

  useEffect(() => {
    let isDrawing = false;
    let startX = 0;
    let startY = 0;

    const startDrawing = (e: MouseEvent) => {
      isDrawing = true;
      startX = e.offsetX;
      startY = e.offsetY;
    };

    const draw = (e: MouseEvent) => {
      if (!isDrawing) return;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = isErasing ? "white" : brushColor;
        ctx.lineWidth = brushSize;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.stroke();
        startX = e.offsetX;
        startY = e.offsetY;
      }
    };

    const drawStar = (
      ctx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      spikes: number,
      outerRadius: number,
      innerRadius: number
    ) => {
      const step = Math.PI / spikes;
      ctx.beginPath();
      for (let i = 0; i < Math.PI * 2; i += step) {
        const x = cx + Math.cos(i) * outerRadius;
        const y = cy - Math.sin(i) * outerRadius;
        ctx.lineTo(x, y);
        i += step;
        const x2 = cx + Math.cos(i) * innerRadius;
        const y2 = cy - Math.sin(i) * innerRadius;
        ctx.lineTo(x2, y2);
      }
      ctx.closePath();
      ctx.stroke();
    };

    const drawShape = (e: MouseEvent) => {
      if (!isDrawing || !isDrawingShape) return;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx) {
        // Clear the canvas or restore the last saved state
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (history.length > 0) {
          restoreCanvas(history[history.length - 1]); // Restore the last saved state
        }

        ctx.strokeStyle = brushColor;
        ctx.lineWidth = brushSize;

        const currentX = e.offsetX;
        const currentY = e.offsetY;

        ctx.beginPath(); // Start a new shape path

        switch (isDrawingShape) {
          case "rectangle":
            ctx.strokeRect(
              startX,
              startY,
              currentX - startX,
              currentY - startY
            );
            break;
          case "circle":
            const radius = Math.sqrt(
              (currentX - startX) ** 2 + (currentY - startY) ** 2
            );
            ctx.arc(startX, startY, radius, 0, Math.PI * 2);
            break;
          case "line":
            ctx.moveTo(startX, startY);
            ctx.lineTo(currentX, currentY);
            break;
          case "triangle":
            ctx.moveTo(startX, startY);
            ctx.lineTo(currentX, currentY);
            ctx.lineTo(startX * 2 - currentX, currentY);
            ctx.closePath();
            break;
          case "star":
            drawStar(
              ctx,
              startX,
              startY,
              5,
              Math.abs(currentX - startX),
              Math.abs(currentY - startY) / 2
            );
            break;
          default:
            break;
        }

        ctx.stroke(); // Complete the stroke for the shape
      }
    };

    const endDrawing = () => {
      isDrawing = false;
      const canvas = canvasRef.current;
      if (canvas) {
        saveState(canvas); // Save the final shape state
        socket?.emit("canvasImage", canvas.toDataURL());
      }
    };

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener("mousedown", startDrawing);
      canvas.addEventListener("mousemove", isDrawingShape ? drawShape : draw);
      canvas.addEventListener("mouseup", endDrawing);
      canvas.addEventListener("mouseout", endDrawing);
    }

    return () => {
      if (canvas) {
        canvas.removeEventListener("mousedown", startDrawing);
        canvas.removeEventListener(
          "mousemove",
          isDrawingShape ? drawShape : draw
        );
        canvas.removeEventListener("mouseup", endDrawing);
        canvas.removeEventListener("mouseout", endDrawing);
      }
    };
  }, [brushColor, brushSize, isErasing, socket, isDrawingShape, history]);

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputUsername.trim()) {
      setUsername(inputUsername.trim());
      setIsAuthenticated(true);
    }
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message && socket) {
      const newMessage: ChatMessage = {
        username: username || "Guest",
        message,
      };

      // Send the message to the server
      socket.emit("chatMessage", newMessage);

      // Update the chat messages state immediately to display the new message
      // setChatMessages((prevMessages) => [...prevMessages, newMessage]);
      setMessage("");
    }
  };

  if (!isAuthenticated) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: "50px",
        }}
      >
        <h2>Login</h2>
        <form onSubmit={handleUsernameSubmit}>
          <input
            type="text"
            placeholder="Enter your username"
            value={inputUsername || ""}
            onChange={(e) => setInputUsername(e.target.value)}
            required
            style={{ marginBottom: "10px", padding: "5px" }}
          />
          <button type="submit" style={{ padding: "5px 10px" }}>
            Join Chat
          </button>
        </form>
      </div>
    );
  }

  const saveState = (canvas: HTMLCanvasElement) => {
    const dataURL = canvas.toDataURL();
    setHistory([...history, dataURL]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (history.length > 0) {
      const prevState = history.pop();
      setRedoStack([...(redoStack || []), canvasRef.current!.toDataURL()]);
      setHistory(history);
      restoreCanvas(prevState);
      setIsErasing(false);
      setIsDrawingShape("");
    }
  };

  const handleRedo = () => {
    if (redoStack.length > 0) {
      const nextState = redoStack.pop();
      setHistory([...history, canvasRef.current!.toDataURL()]);
      restoreCanvas(nextState);
      setIsErasing(false);
      setIsDrawingShape("");
    }
  };

  //   const restoreCanvas = (dataURL: string | undefined) => {
  //     const canvas = canvasRef.current;
  //     const ctx = canvas?.getContext("2d");
  //     if (ctx && dataURL) {
  //       const image = new Image();
  //       image.src = dataURL;
  //       image.onload = () => {
  //         ctx.clearRect(0, 0, canvas.width, canvas.height);
  //         ctx.drawImage(image, 0, 0);
  //         ctx.strokeStyle = brushColor;
  //         ctx.lineWidth = brushSize;
  //       };
  //     }
  //   };
  const restoreCanvas = (imageData: string) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx && canvas) {
      const img = new Image();
      img.src = imageData;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
    }
  };

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      socket?.emit("canvasImage", canvas.toDataURL());
    }
  };

  // const handleSave = () => {
  //   const canvas = canvasRef.current;
  //   const link = document.createElement("a");
  //   link.download = "canvas.png";
  //   link.href = canvas.toDataURL();
  //   link.click();
  // };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create a temporary canvas to draw the white background
    const tempCanvas = document.createElement("canvas");
    const tempContext = tempCanvas.getContext("2d");

    if (!tempContext) return;

    // Set the temporary canvas size to match the original
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    // Draw a white rectangle as the background
    tempContext.fillStyle = "white";
    tempContext.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw the original canvas content on top
    tempContext.drawImage(canvas, 0, 0);

    // Create the download link
    const link = document.createElement("a");
    link.download = "canvas.png";
    link.href = tempCanvas.toDataURL("image/png");
    link.click();
  };

  // Helper function to get a random position around the center
  const getRandomPosition = (canvasWidth: number, canvasHeight: number) => {
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const offsetX = Math.floor(Math.random() * 100 - 50);
    const offsetY = Math.floor(Math.random() * 100 - 50);
    return { x: centerX + offsetX, y: centerY + offsetY };
  };

  // Function to add a centered text box with slight random offset
  const addCenteredTextBox = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const randomPosition = getRandomPosition(rect.width, rect.height);

      const newTextBox: TextBox = {
        id: Date.now(),
        x: randomPosition.x,
        y: randomPosition.y,
        text: "Click to edit text",
        isDragging: false,
      };

      setTextBoxes([...textBoxes, newTextBox]);
    }
  };

  // Function to handle text change in the text box
  const handleTextChange = (id: number, newText: string) => {
    setTextBoxes(
      textBoxes.map((box) => (box.id === id ? { ...box, text: newText } : box))
    );
  };

  // Function to delete a text box
  const deleteTextBox = (id: number) => {
    setTextBoxes(textBoxes.filter((box) => box.id !== id));
  };

  // Function to initiate dragging
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, id: number) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      setDraggedBoxId(id);
      const selectedBox = textBoxes.find((box) => box.id === id);
      if (selectedBox) {
        setOffset({
          x: e.clientX - rect.left - selectedBox.x,
          y: e.clientY - rect.top - selectedBox.y,
        });
      }
    }
  };

  // Function to stop dragging
  const handleMouseUp = () => {
    setDraggedBoxId(null);
  };

  // Function to handle dragging
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggedBoxId !== null) {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const updatedTextBoxes = textBoxes.map((box) => {
          if (box.id === draggedBoxId) {
            return {
              ...box,
              x: e.clientX - rect.left - offset.x,
              y: e.clientY - rect.top - offset.y,
            };
          }
          return box;
        });
        setTextBoxes(updatedTextBoxes);
      }
    }
  };

  return (
    <div style={{ display: "flex" }}>
      <div
        style={{
          marginRight: "20px",
          padding: "5px 0", // Top/bottom padding minimized
          border: "1px solid #000",
          borderRadius: "5px",
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "5px", // Uniform gap without excess padding
        }}
      >
        <label
          style={{ display: "flex", alignItems: "center", marginBottom: "5px" }}
        >
          <input
            type="color"
            value={brushColor}
            onChange={(e) => setBrushColor(e.target.value)}
            style={{ marginLeft: "5px" }}
          />
        </label>

        <label
          style={{ display: "flex", alignItems: "center", marginBottom: "5px" }}
        >
          <input
            type="range"
            min="1"
            max="20"
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            style={{ marginLeft: "5px", width: "70px" }}
          />
        </label>

        <button
          onClick={() => {
            setIsErasing(false);
            setIsDrawingShape("");
          }}
          style={{
            display: "block",
            marginBottom: "5px",
            padding: "5px",
            fontSize: "16px",
          }}
        >
          <FaPencilAlt size={20} />
        </button>

        <button
          onClick={() => setIsErasing(true)}
          style={{
            display: "block",
            marginBottom: "5px",
            padding: "5px",
            fontSize: "16px",
          }}
        >
          <FaEraser size={20} />
        </button>

        <button
          onClick={handleUndo}
          style={{ display: "block", marginBottom: "5px", padding: "5px" }}
        >
          <FaUndo size={20} />
        </button>

        <button
          onClick={handleRedo}
          style={{ display: "block", marginBottom: "5px", padding: "5px" }}
        >
          <FaRedo size={20} />
        </button>

        <button
          onClick={handleClearCanvas}
          style={{ display: "block", marginBottom: "5px", padding: "5px" }}
        >
          <AiOutlineClear size={20} />
        </button>

        <button
          onClick={handleSave}
          style={{ display: "block", marginBottom: "5px", padding: "5px" }}
        >
          <FaDownload size={20} />
        </button>

        <button
          onClick={addCenteredTextBox}
          style={{ display: "block", marginBottom: "5px", padding: "5px" }}
        >
          <BiText size={20} />
        </button>

        <button
          onClick={() => setIsDrawingShape("rectangle")}
          style={{ display: "block", marginBottom: "5px", padding: "5px" }}
        >
          <FaRegSquare size={20} />
        </button>

        <button
          onClick={() => setIsDrawingShape("circle")}
          style={{ display: "block", marginBottom: "5px", padding: "5px" }}
        >
          <FaRegCircle size={20} />
        </button>

        <button
          onClick={() => setIsDrawingShape("line")}
          style={{ display: "block", marginBottom: "5px", padding: "5px" }}
        >
          <FaSlash size={20} />
        </button>

        <button
          onClick={() => setIsDrawingShape("triangle")}
          style={{ display: "block", marginBottom: "5px", padding: "5px" }}
        >
          <FaPlay size={20} />
        </button>

        <button
          onClick={() => setIsDrawingShape("star")}
          style={{ display: "block", marginBottom: "5px", padding: "5px" }}
        >
          <FaRegStar size={20} />
        </button>
      </div>

      {/* <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        width={800}
        height={600}
        style={{ backgroundColor: "white", border: "1px solid #000" }}
      /> */}

      <div
        style={{
          width: "100%", // Full-width container
          height: "80vh", // Half the screen height (or adjust as needed)
          overflowY: "scroll", // Enable vertical scrolling
          overflowX: "hidden", // Disable horizontal scrolling
          // border: "4px solid #111", // Optional border for clarity
          backgroundColor: "#f9f9f9", // Optional light background
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          width={900} // Standard canvas width
          height={1200} // Larger height for scrollable content
          style={{
            backgroundColor: "white",
            // border: "4px solid #150",
          }}
        />
      </div>

      {textBoxes.map((box) => (
        <div
          key={box.id}
          style={{
            position: "absolute",
            left: box.x,
            top: box.y,
            padding: "5px",
            backgroundColor: "white",
            cursor: "move",
            border: "1px solid black",
            minWidth: "100px",
          }}
          onMouseDown={(e) => handleMouseDown(e, box.id)}
          onMouseUp={handleMouseUp}
        >
          <textarea
            value={box.text}
            onChange={(e) => handleTextChange(box.id, e.target.value)}
            style={{
              width: "100%",
              resize: "both", // Enable resizing of the text area
              overflow: "auto",
              border: "none",
              outline: "none",
              backgroundColor: "transparent",
            }}
          />
          <button
            onClick={() => deleteTextBox(box.id)}
            style={{
              position: "absolute",
              top: "-10px",
              right: "-10px",
              cursor: "pointer",
              background: "red",
              color: "white",
              border: "none",
              borderRadius: "50%",
              width: "20px",
              height: "20px",
            }}
            className="delete-button"
          >
            &times;
          </button>
        </div>
      ))}
      <style>{`
               div:hover .delete-button {
                   display: block;
               }
           `}</style>

      <div
        style={{
          width: "300px",
          padding: "10px",
          borderLeft: "2px solid #ccc",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <h3>Live Chat</h3>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            height: "400px", // Set a fixed height for the chat container
            border: "1px solid #ccc",
            borderRadius: "5px",
            marginBottom: "10px",
            overflow: "hidden", // Prevent overflow outside the container
          }}
        >
          <div
            style={{
              flex: 1,
              overflowY: "auto", // Enable vertical scrolling
              padding: "10px",
            }}
          >
            {chatMessages.map((msg, index) => (
              <div key={index}>
                <strong>{msg.username}: </strong>
                {msg.message}
              </div>
            ))}
          </div>
        </div>
        <form onSubmit={sendMessage}>
          <input
            type="text"
            placeholder="Type a message"
            value={message || ""}
            onChange={(e) => setMessage(e.target.value)}
            required
            style={{
              marginBottom: "10px",
              padding: "5px",
              width: "calc(100% - 60px)", // Ensure input field doesn't overlap button
            }}
          />
          <button
            type="submit"
            style={{
              padding: "5px 10px",
              marginLeft: "10px",
            }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default Board;
