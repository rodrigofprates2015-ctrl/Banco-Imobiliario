import { db } from "./db";
import { rooms, players, type Room, type Player, type InsertRoom, type InsertPlayer } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  createRoom(room: InsertRoom): Promise<Room>;
  getRoomByCode(code: string): Promise<Room | undefined>;
  updateRoomStatus(id: number, status: string): Promise<Room>;
  updateRoomState(id: number, state: any): Promise<Room>;
  
  createPlayer(player: InsertPlayer): Promise<Player>;
  getPlayersInRoom(roomId: number): Promise<Player[]>;
  getPlayerBySocket(socketId: string): Promise<Player | undefined>;
  updatePlayer(id: number, updates: Partial<Player>): Promise<Player>;
}

export class DatabaseStorage implements IStorage {
  async createRoom(room: InsertRoom): Promise<Room> {
    const [newRoom] = await db.insert(rooms).values(room).returning();
    return newRoom;
  }

  async getRoomByCode(code: string): Promise<Room | undefined> {
    const [room] = await db.select().from(rooms).where(eq(rooms.code, code));
    return room;
  }

  async updateRoomStatus(id: number, status: string): Promise<Room> {
    const [updated] = await db.update(rooms)
      .set({ status })
      .where(eq(rooms.id, id))
      .returning();
    return updated;
  }

  async updateRoomState(id: number, state: any): Promise<Room> {
    const [updated] = await db.update(rooms)
      .set({ gameState: state })
      .where(eq(rooms.id, id))
      .returning();
    return updated;
  }

  async createPlayer(player: InsertPlayer): Promise<Player> {
    const [newPlayer] = await db.insert(players).values(player).returning();
    return newPlayer;
  }

  async getPlayersInRoom(roomId: number): Promise<Player[]> {
    return db.select().from(players).where(eq(players.roomId, roomId));
  }

  async getPlayerBySocket(socketId: string): Promise<Player | undefined> {
    const [player] = await db.select().from(players).where(eq(players.socketId, socketId));
    return player;
  }

  async updatePlayer(id: number, updates: Partial<Player>): Promise<Player> {
    const [updated] = await db.update(players)
      .set(updates)
      .where(eq(players.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
