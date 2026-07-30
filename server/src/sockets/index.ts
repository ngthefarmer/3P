import type { Server, Socket } from "socket.io";
import { verifyToken } from "../auth/jwt.js";
import { getUserById, setChipBalance } from "../db.js";
import { createRoom, deleteRoomIfEmpty, getRoom } from "../game/rooms.js";
import type { TeenPattiTable } from "../game/table.js";
import type { PlayerAction } from "../game/types.js";

interface SocketData {
  userId: number;
  username: string;
  roomCode: string | null;
}

type AckFn<T = unknown> = (response: { ok: boolean; error?: string } & T) => void;

const MIN_SEATS = 2;
const MAX_SEATS = 10;
const MIN_BOOT = 1;
const MAX_BOOT = 100000;

function broadcastTableState(io: Server, table: TeenPattiTable) {
  for (const seat of table.seats) {
    if (seat && seat.socketId) {
      io.to(seat.socketId).emit("table:state", table.getStateForUser(seat.userId));
    }
  }
}

export function registerSocketHandlers(io: Server) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Missing auth token"));
    const payload = verifyToken(token);
    if (!payload) return next(new Error("Invalid or expired token"));
    const user = getUserById(payload.userId);
    if (!user) return next(new Error("User not found"));
    (socket.data as SocketData).userId = user.id;
    (socket.data as SocketData).username = user.username;
    (socket.data as SocketData).roomCode = null;
    next();
  });

  io.on("connection", (socket: Socket) => {
    const data = socket.data as SocketData;

    socket.on(
      "room:create",
      (
        input: { maxSeats: number; bootAmount: number },
        ack: AckFn<{ roomCode?: string }>
      ) => {
        const maxSeats = Math.round(input?.maxSeats);
        const bootAmount = Math.round(input?.bootAmount);
        if (!Number.isFinite(maxSeats) || maxSeats < MIN_SEATS || maxSeats > MAX_SEATS) {
          return ack({ ok: false, error: `Seats must be between ${MIN_SEATS} and ${MAX_SEATS}` });
        }
        if (!Number.isFinite(bootAmount) || bootAmount < MIN_BOOT || bootAmount > MAX_BOOT) {
          return ack({ ok: false, error: `Boot amount must be between ${MIN_BOOT} and ${MAX_BOOT}` });
        }
        const table = createRoom(maxSeats, bootAmount);
        ack({ ok: true, roomCode: table.roomCode });
      }
    );

    function joinRoom(roomCode: string, ack: AckFn) {
      const table = getRoom(roomCode);
      if (!table) return ack({ ok: false, error: "Room not found" });

      const user = getUserById(data.userId);
      if (!user) return ack({ ok: false, error: "User not found" });

      const result = table.seatPlayer(user.id, user.username, user.chip_balance, socket.id);
      if (!result.ok) return ack({ ok: false, error: result.error });

      data.roomCode = table.roomCode;
      socket.join(table.roomCode);
      ack({ ok: true });
      broadcastTableState(io, table);
    }

    socket.on("room:join", (input: { roomCode: string }, ack: AckFn) => {
      if (!input?.roomCode) return ack({ ok: false, error: "Room code required" });
      joinRoom(input.roomCode.toUpperCase(), ack);
    });

    socket.on("room:leave", (_input: unknown, ack: AckFn) => {
      if (!data.roomCode) return ack({ ok: true });
      const table = getRoom(data.roomCode);
      if (table) {
        table.removePlayer(data.userId);
        socket.leave(table.roomCode);
        broadcastTableState(io, table);
        deleteRoomIfEmpty(table.roomCode);
      }
      data.roomCode = null;
      ack({ ok: true });
    });

    socket.on("game:action", (action: PlayerAction, ack: AckFn) => {
      if (!data.roomCode) return ack({ ok: false, error: "Not seated at a table" });
      const table = getRoom(data.roomCode);
      if (!table) return ack({ ok: false, error: "Room not found" });

      const result = table.handleAction(data.userId, action);
      if (!result.ok) return ack({ ok: false, error: result.error });
      ack({ ok: true });
      broadcastTableState(io, table);
    });

    socket.on("disconnect", () => {
      if (!data.roomCode) return;
      const table = getRoom(data.roomCode);
      if (!table) return;
      table.markDisconnected(data.userId);
      // Persist balance immediately in case the player never reconnects.
      const idx = table.findSeatByUserId(data.userId);
      if (idx !== null) {
        const seat = table.seats[idx]!;
        setChipBalance(seat.userId, seat.chips);
      }
      broadcastTableState(io, table);
    });
  });
}
