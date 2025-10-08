import express from "express";
import * as dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import askRoutes from "./routes/askRoutes.js";
import conversationRoutes from "./routes/conversationRoutes.js";
import { connectDB } from "./utils/db.js";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { handleBotStream } from "./controllers/askController.js";

dotenv.config();

const app = express();
app.use(express.json());

app.use(cors());

export const server = http.createServer(app);
export const wss = new WebSocketServer({ server, path: "/ws" });

const port = process.env.PORT || 3000;

app.use("/auth", authRoutes);
app.use("/profiles", profileRoutes);
app.use("/ask", askRoutes);
app.use("/conversations", conversationRoutes);

connectDB()
  .then(() => {
    wss.on("connection", (ws: WebSocket) => {
      console.log("Websocket client connected!");
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
        } catch (error) {
          console.error("WS Error", error);
          ws.send(JSON.stringify({ error: "Invalid request" }));
        }
      });
    });
    server.listen(port, () => console.log(`Server is running on port ${port}`));
  })
  .catch((error) => {
    console.error("Failed to connect!", error);
    process.exit(1);
  });
