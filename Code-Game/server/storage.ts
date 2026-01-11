import { db } from "./db";
import { rooms, players, type Room, type Player } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export type InsertRoom = typeof rooms.$inferInsert;
export type InsertPlayer = typeof players.$inferInsert;

export interface UpsertPlayer {
  clientId: string;
  roomId: number;
  nickname: string;
  socketId: string | null;
  color: string;
  isHost: boolean;
}

export interface IStorage {
  createRoom(room: InsertRoom): Promise<Room>;
  getRoomByCode(code: string): Promise<Room | undefined>;
  updateRoomStatus(id: number, status: string): Promise<Room>;
  updateRoomState(id: number, state: any): Promise<Room>;
  
  createPlayer(player: InsertPlayer): Promise<Player>;
  getPlayersInRoom(roomId: number): Promise<Player[]>;
  getPlayerBySocket(socketId: string): Promise<Player | undefined>;
  getPlayerByClientId(clientId: string, roomId: number): Promise<Player | undefined>;
  getPlayerById(playerId: number): Promise<Player | undefined>;
  upsertPlayer(player: UpsertPlayer): Promise<Player>;
  updatePlayer(id: number, updates: Partial<Player>): Promise<Player>;
  updatePlayerSocket(playerId: number, socketId: string | null): Promise<Player>;
  deletePlayer(playerId: number): Promise<void>;
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
    return db.select().from(players).where(eq(players.roomId, roomId)).orderBy(players.id);
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

  async getPlayerByClientId(clientId: string, roomId: number): Promise<Player | undefined> {
    const [player] = await db.select()
      .from(players)
      .where(and(eq(players.clientId, clientId), eq(players.roomId, roomId)));
    return player;
  }

  async getPlayerById(playerId: number): Promise<Player | undefined> {
    const [player] = await db.select()
      .from(players)
      .where(eq(players.id, playerId));
    return player;
  }

  async upsertPlayer(player: UpsertPlayer): Promise<Player> {
    const existing = await this.getPlayerByClientId(player.clientId, player.roomId);
    
    if (existing) {
      return await this.updatePlayer(existing.id, {
        socketId: player.socketId,
        nickname: player.nickname,
        lastSeen: Date.now()
      });
    }
    
    return await this.createPlayer(player);
  }

  async updatePlayerSocket(playerId: number, socketId: string | null): Promise<Player> {
    return await this.updatePlayer(playerId, { 
      socketId,
      lastSeen: Date.now()
    });
  }

  async deletePlayer(playerId: number): Promise<void> {
    await db.delete(players).where(eq(players.id, playerId));
  }
}

export const storage = new DatabaseStorage();
