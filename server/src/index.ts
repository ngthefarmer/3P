import express from "express";
import cors from "cors";
import http from "node:http";
import { Server } from "socket.io";
import { authRouter } from "./auth/routes.js";
import { registerSocketHandlers } from "./sockets/index.js";
import "./db.js";

const PORT = Number(process.env.PORT) || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN },
});

registerSocketHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`Teen Patti server listening on port ${PORT}`);
});
