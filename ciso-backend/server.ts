import express from "express";
import * as dotenv from "dotenv";
import cors from "cors";
import http from "http";
import { WebSocketServer } from "ws";
import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import askRoutes from "./routes/askRoutes.js";
import conversationRoutes from "./routes/conversationRoutes.js";
import uploadRoutes from "./routes/upload.js"; // ✅ Add this line
import { connectDB } from "./utils/db.js";
import { handleBotStream } from "./controllers/askController.js";

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

app.use(cors());
app.use(express.json());

// ✅ Serve uploaded files statically
app.use("/uploads", express.static("uploads"));

// ✅ Mount all routes
app.use("/auth", authRoutes);
app.use("/profiles", profileRoutes);
app.use("/ask", askRoutes);
app.use("/conversations", conversationRoutes);
app.use("/upload", uploadRoutes); // ✅ Add this

connectDB()
  .then(() => {
    wss.on("connection", (ws) => {
      console.log("✅ WebSocket client connected!");

      ws.on("message", async (msg) => {
        try {
          const { question, token, conversationId } = JSON.parse(
            msg.toString()
          );
          if (!token) {
            ws.send(
              JSON.stringify({ type: "error", data: "No token provided" })
            );
            return;
          }
          await handleBotStream(ws, question, token, conversationId);
        } catch (err) {
          console.error("WS Error:", err);
          ws.send(JSON.stringify({ error: "Invalid request" }));
        }
      });

      ws.on("close", () => console.log("❌ Client disconnected"));
    });

    server.listen(port, () =>
      console.log(
        `🚀 Server running with WebSocket on http://localhost:${port}`
      )
    );
  })
  .catch((err) => {
    console.error("Failed to connect DB:", err);
    process.exit(1);
  });
