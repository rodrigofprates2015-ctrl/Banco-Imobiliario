import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { storage } from "./storage";
import { api, ws } from "@shared/routes";
import { z } from "zod";
import { generateCityBoard } from "./lib/game-utils";

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
      const { city, nickname } = api.rooms.create.input.parse(req.body);
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const room = await storage.createRoom({
        city,
        code,
        hostId: "pending", // Will be updated when socket connects
        status: "waiting",
        gameState: {}
      });

      // We need to return a token and playerId for the frontend to store
      // Since we don't have the player yet, let's just return the code.
      // The frontend logic expects token and playerId.
      // Let's modify the frontend to not expect them immediately or mock them.
      
      res.status(201).json({ roomCode: code, token: "mock-token", playerId: 0 });
    } catch (err) {
      console.error("Create room error:", err);
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.post(api.rooms.join.path, async (req, res) => {
    try {
      const { code, nickname } = api.rooms.join.input.parse(req.body);
      const room = await storage.getRoomByCode(code);
      if (!room) return res.status(404).json({ message: "Room not found" });
      res.status(200).json({ roomCode: room.code, token: "mock-token", playerId: 0 });
    } catch (err) {
      console.error("Join room error:", err);
      res.status(400).json({ message: "Invalid input" });
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
      const { code, nickname } = data;
      console.log(`[WS] Player ${nickname} joining room ${code}`);
      const room = await storage.getRoomByCode(code);
      if (!room) {
        socket.emit("error", { message: "Room not found" });
        return;
      }

      // Check if player already exists for this socket
      const existingPlayer = await storage.getPlayerBySocket(socket.id);
      if (existingPlayer) {
        console.log(`[WS] Player ${nickname} already exists for socket ${socket.id}`);
        const allPlayers = await storage.getPlayersInRoom(room.id);
        socket.join(code);
        io.to(code).emit(ws.events.PLAYER_JOINED, {
          player: existingPlayer,
          players: allPlayers
        });
        return;
      }

      const existingPlayersInRoom = await storage.getPlayersInRoom(room.id);
      const isHost = existingPlayersInRoom.length === 0;

      const player = await storage.createPlayer({
        roomId: room.id,
        socketId: socket.id,
        nickname: nickname || "Anonymous",
        color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
        isHost
      });

      socket.join(code);
      
      console.log(`[WS] Player ${player.nickname} joined room ${code} (isHost: ${isHost})`);
      const allPlayersAfterJoin = await storage.getPlayersInRoom(room.id);

      io.to(code).emit(ws.events.PLAYER_JOINED, {
        player,
        players: allPlayersAfterJoin
      });
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
        winnerId: undefined
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
        logs: newLogs
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
        logs: newLogs
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
        logs: newLogs
      };
      
      await storage.updateRoomState(room.id, newState);
      io.to(code).emit(ws.events.GAME_UPDATE, { gameState: newState });
    });
    
    socket.on("disconnect", async () => {
        // Handle disconnect
    });
  });

  return httpServer;
}
