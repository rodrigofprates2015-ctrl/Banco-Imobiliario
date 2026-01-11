import { pgTable, text, serial, integer, boolean, jsonb, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  city: text("city").notNull(),
  status: text("status").notNull().default("waiting"), // waiting, playing, finished
  hostId: text("host_id"), // socket id or unique client id
  gameState: jsonb("game_state"), // Stores the board, turn, etc.
});

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  clientId: text("client_id").notNull(),
  socketId: text("socket_id"),
  nickname: text("nickname").notNull(),
  money: integer("money").default(2000),
  position: integer("position").default(0),
  color: text("color").notNull(),
  isHost: boolean("is_host").default(false),
  isJailed: boolean("is_jailed").default(false),
  jailTurns: integer("jail_turns").default(0),
  lastSeen: integer("last_seen").default(Date.now()),
}, (table) => ({
  uniqueRoomClient: unique().on(table.roomId, table.clientId),
}));

export const insertRoomSchema = createInsertSchema(rooms).pick({
  city: true,
  code: true,
  hostId: true,
  status: true
});

export const insertPlayerSchema = createInsertSchema(players).pick({
  roomId: true,
  clientId: true,
  socketId: true,
  nickname: true,
  color: true,
  isHost: true
});

export type Room = typeof rooms.$inferSelect;
export type Player = typeof players.$inferSelect;

// Game State Types for JSONB
export interface Property {
  id: string; // unique id
  name: string;
  address: string;
  type: 'street' | 'utility' | 'railroad' | 'special' | 'tax' | 'chance' | 'jail' | 'start' | 'parking' | 'go_to_jail';
  price?: number;
  rent?: number;
  ownerId?: number; // player id
  group?: string; // e.g. 'brown', 'light_blue' (for streets)
  placeId?: string; // Google Place ID
}

export interface GameState {
  board: Property[];
  currentPlayerIndex: number; // Index in the players array
  dice: [number, number];
  logs: string[];
  winnerId?: number;
  timestamp?: number; // For conflict resolution
}
