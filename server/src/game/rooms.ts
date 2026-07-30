import { TeenPattiTable } from "./table.js";

const rooms = new Map<string, TeenPattiTable>();

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid ambiguity

function generateRoomCode(): string {
  let code: string;
  do {
    code = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
  } while (rooms.has(code));
  return code;
}

export function createRoom(maxSeats: number, bootAmount: number): TeenPattiTable {
  const code = generateRoomCode();
  const table = new TeenPattiTable(code, maxSeats, bootAmount);
  rooms.set(code, table);
  return table;
}

export function getRoom(roomCode: string): TeenPattiTable | undefined {
  return rooms.get(roomCode.toUpperCase());
}

export function deleteRoomIfEmpty(roomCode: string): void {
  const table = rooms.get(roomCode);
  if (table && table.seats.every((s) => s === null)) {
    rooms.delete(roomCode);
  }
}
