import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { storage } from "./storage";
import { api, ws } from "@shared/routes";
import { z } from "zod";
import { generateCityBoard } from "./lib/game-utils";
import { db } from "./db";
import { rooms } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    cors: {
      origin: "*",
    },
  });

  // API Routes
  app.get("/api/city-suggestions", async (req, res) => {
    const { input } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return res.json([]);
    
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input as string)}&types=(cities)&key=${apiKey}`
      );
      const data = await response.json();
      res.json(data.predictions || []);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch suggestions" });
    }
  });

  app.post(api.rooms.create.path, async (req, res) => {
    try {
      const { city, nickname, clientId } = api.rooms.create.input.parse(req.body);
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const room = await storage.createRoom({
        city,
        code,
        hostId: clientId,
        status: "waiting",
        gameState: {}
      });

      // Create player immediately with clientId
      const player = await storage.createPlayer({
        roomId: room.id,
        clientId,
        socketId: null,
        nickname,
        color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
        isHost: true
      });

      console.log(`[API] Room ${code} created by ${nickname} (playerId: ${player.id})`);
      
      res.status(201).json({ 
        roomCode: code, 
        token: `token-${player.id}`, 
        playerId: player.id 
      });
    } catch (err) {
      console.error("Create room error:", err);
      res.status(500).json({ message: "Failed to create room" });
    }
  });

  app.post(api.rooms.join.path, async (req, res) => {
    try {
      const { code, nickname, clientId } = api.rooms.join.input.parse(req.body);
      const room = await storage.getRoomByCode(code);
      
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      if (room.status !== "waiting") {
        return res.status(403).json({ message: "Game already started" });
      }

      const existingPlayers = await storage.getPlayersInRoom(room.id);
      
      if (existingPlayers.length >= 4) {
        return res.status(403).json({ message: "Room is full" });
      }

      // Upsert player (update if exists, create if not)
      const player = await storage.upsertPlayer({
        clientId,
        roomId: room.id,
        nickname,
        socketId: null,
        color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
        isHost: false
      });

      console.log(`[API] Player ${nickname} joined room ${code} (playerId: ${player.id})`);
      
      res.status(200).json({ 
        roomCode: room.code, 
        token: `token-${player.id}`, 
        playerId: player.id 
      });
    } catch (err) {
      console.error("Join room error:", err);
      res.status(500).json({ message: "Failed to join room" });
    }
  });

  app.get(api.rooms.get.path, async (req, res) => {
    const room = await storage.getRoomByCode(req.params.code);
    if (!room) return res.status(404).json({ message: "Room not found" });
    
    const players = await storage.getPlayersInRoom(room.id);
    res.json({ room, players, gameState: room.gameState });
  });

  // Socket.io Logic
  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    socket.on(ws.events.JOIN_ROOM, async (data: any) => {
      try {
        const { code, playerId, clientId, nickname } = data;
        console.log(`[WS] join_room: playerId=${playerId}, clientId=${clientId}, code=${code}`);
        
        const room = await storage.getRoomByCode(code);
        if (!room) {
          console.log(`[WS] Room ${code} not found`);
          socket.emit(ws.events.ERROR, { code: "ROOM_NOT_FOUND", message: "Room not found" });
          return;
        }

        // Validate player exists and matches clientId
        const player = await storage.getPlayerById(playerId);
        if (!player) {
          console.log(`[WS] Player ${playerId} not found`);
          socket.emit(ws.events.ERROR, { code: "INVALID_PLAYER", message: "Player not found" });
          return;
        }

        if (player.clientId !== clientId) {
          console.log(`[WS] Client ID mismatch for player ${playerId}`);
          socket.emit(ws.events.ERROR, { code: "INVALID_PLAYER", message: "Client ID mismatch" });
          return;
        }

        if (player.roomId !== room.id) {
          console.log(`[WS] Player ${playerId} not in room ${code}`);
          socket.emit(ws.events.ERROR, { code: "INVALID_PLAYER", message: "Player not in this room" });
          return;
        }

        // Update player's socketId
        await storage.updatePlayerSocket(playerId, socket.id);
        console.log(`[WS] Updated socketId for player ${player.nickname} (${playerId})`);

        socket.join(code);
        const allPlayers = await storage.getPlayersInRoom(room.id);
        
        // Emit to everyone in the room
        io.to(code).emit(ws.events.PLAYER_JOINED, {
          player: { ...player, socketId: socket.id },
          players: allPlayers
        });
      } catch (err) {
        console.error("[WS] join_room error:", err);
        socket.emit(ws.events.ERROR, { code: "INTERNAL_ERROR", message: "Failed to join room" });
      }
    });

    socket.on(ws.events.START_GAME, async ({ code }) => {
      const room = await storage.getRoomByCode(code);
      if (!room) return;
      
      const players = await storage.getPlayersInRoom(room.id);
      const player = players.find(p => p.socketId === socket.id);
      
      if (!player?.isHost) return;

      // Generate Board
      const board = await generateCityBoard(room.city);
      const initialState = {
        board,
        currentPlayerIndex: 0,
        dice: [0, 0],
        logs: [`Game started in ${room.city}!`],
        winnerId: undefined,
        timestamp: Date.now()
      };

      await storage.updateRoomStatus(room.id, "playing");
      await storage.updateRoomState(room.id, initialState);

      io.to(code).emit(ws.events.GAME_STARTED, { gameState: initialState });
    });

    socket.on(ws.events.ROLL_DICE, async ({ code }) => {
      const room = await storage.getRoomByCode(code);
      if (!room || !room.gameState || room.status !== "playing") return;
      
      const gameState = room.gameState as any;
      const players = await storage.getPlayersInRoom(room.id);
      const currentPlayer = players[gameState.currentPlayerIndex];
      
      if (currentPlayer.socketId !== socket.id) return;

      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const total = d1 + d2;
      
      const newPosition = (currentPlayer.position! + total) % 40;
      const property = gameState.board[newPosition];
      
      const newLogs = [...gameState.logs, `${currentPlayer.nickname} rolled ${total} and landed on ${property.name}`];
      
      // Update player position
      await storage.updatePlayer(currentPlayer.id, { position: newPosition });
      
      const newState = {
        ...gameState,
        dice: [d1, d2],
        logs: newLogs,
        timestamp: Date.now()
      };
      
      await storage.updateRoomState(room.id, newState);
      io.to(code).emit(ws.events.GAME_UPDATE, { gameState: newState });
    });

    socket.on(ws.events.BUY_PROPERTY, async ({ code }) => {
      const room = await storage.getRoomByCode(code);
      if (!room || !room.gameState || room.status !== "playing") return;
      
      const gameState = room.gameState as any;
      const players = await storage.getPlayersInRoom(room.id);
      const currentPlayer = players[gameState.currentPlayerIndex];
      
      if (currentPlayer.socketId !== socket.id) return;
      
      const property = gameState.board[currentPlayer.position!];
      if (property.type !== 'street' || property.ownerId || (currentPlayer.money || 0) < (property.price || 0)) return;
      
      // Update player money
      const newMoney = (currentPlayer.money || 0) - property.price;
      await storage.updatePlayer(currentPlayer.id, { money: newMoney });
      
      // Update board
      const newBoard = [...gameState.board];
      newBoard[currentPlayer.position!] = { ...property, ownerId: currentPlayer.id };
      
      const newLogs = [...gameState.logs, `${currentPlayer.nickname} bought ${property.name} for ${property.price}`];
      
      const newState = {
        ...gameState,
        board: newBoard,
        logs: newLogs,
        timestamp: Date.now()
      };
      
      await storage.updateRoomState(room.id, newState);
      io.to(code).emit(ws.events.GAME_UPDATE, { gameState: newState });
    });

    socket.on(ws.events.END_TURN, async ({ code }) => {
      const room = await storage.getRoomByCode(code);
      if (!room || !room.gameState || room.status !== "playing") return;
      
      const gameState = room.gameState as any;
      const players = await storage.getPlayersInRoom(room.id);
      
      if (players[gameState.currentPlayerIndex].socketId !== socket.id) return;
      
      const nextIndex = (gameState.currentPlayerIndex + 1) % players.length;
      const nextPlayer = players[nextIndex];
      
      const newLogs = [...gameState.logs, `It is now ${nextPlayer.nickname}'s turn`];
      
      const newState = {
        ...gameState,
        currentPlayerIndex: nextIndex,
        logs: newLogs,
        timestamp: Date.now()
      };
      
      await storage.updateRoomState(room.id, newState);
      io.to(code).emit(ws.events.GAME_UPDATE, { gameState: newState });
    });
    
    socket.on(ws.events.HEARTBEAT, async (data: any) => {
      try {
        const { playerId } = data;
        if (playerId) {
          await storage.updatePlayer(playerId, { lastSeen: Date.now() });
        }
      } catch (err) {
        console.error("[WS] heartbeat error:", err);
      }
    });

    socket.on("disconnect", async () => {
      try {
        console.log(`[WS] Socket ${socket.id} disconnected`);
        const player = await storage.getPlayerBySocket(socket.id);
        
        if (!player) {
          console.log(`[WS] No player found for socket ${socket.id}`);
          return;
        }

        console.log(`[WS] Player ${player.nickname} (${player.id}) disconnected`);
        
        // Update socketId to null
        await storage.updatePlayerSocket(player.id, null);
        
        // Get room to emit to
        const room = await storage.getRoomByCode(
          (await storage.getPlayersInRoom(player.roomId))[0] ? 
          (await db.select().from(rooms).where(eq(rooms.id, player.roomId)))[0]?.code : ""
        );
        
        if (room) {
          // Emit player disconnected
          io.to(room.code).emit(ws.events.PLAYER_DISCONNECTED, {
            playerId: player.id,
            nickname: player.nickname
          });

          // Check if disconnected player was host
          if (player.isHost) {
            const allPlayers = await storage.getPlayersInRoom(player.roomId);
            const otherPlayers = allPlayers.filter(p => p.id !== player.id && p.socketId !== null);
            
            if (otherPlayers.length > 0) {
              // Promote first connected player to host
              const newHost = otherPlayers[0];
              await storage.updatePlayer(player.id, { isHost: false });
              await storage.updatePlayer(newHost.id, { isHost: true });
              
              console.log(`[WS] Promoted ${newHost.nickname} to host`);
              io.to(room.code).emit(ws.events.HOST_CHANGED, {
                newHostId: newHost.id,
                nickname: newHost.nickname
              });
            }
          }

          // Schedule cleanup after 60 seconds if not reconnected
          setTimeout(async () => {
            const updatedPlayer = await storage.getPlayerById(player.id);
            if (updatedPlayer && updatedPlayer.socketId === null) {
              console.log(`[WS] Cleaning up player ${player.nickname} after 60s`);
              await storage.deletePlayer(player.id);
            }
          }, 60000);
        }
      } catch (err) {
        console.error("[WS] disconnect error:", err);
      }
    });
  });

  return httpServer;
}
