import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ws } from "@shared/routes";
import { io, Socket } from "socket.io-client";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";

// Types
import type { GameState, Player, Room } from "@shared/schema";

// --- REST API Hooks ---

export function useCreateRoom() {
  return useMutation({
    mutationFn: async (data: { city: string; nickname: string }) => {
      const res = await fetch(api.rooms.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create room");
      return api.rooms.create.responses[201].parse(await res.json());
    },
  });
}

export function useJoinRoom() {
  return useMutation({
    mutationFn: async (data: { code: string; nickname: string }) => {
      const res = await fetch(api.rooms.join.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        if (res.status === 404) throw new Error("Room not found");
        throw new Error("Failed to join room");
      }
      return api.rooms.join.responses[200].parse(await res.json());
    },
  });
}

export function useRoom(code: string) {
  return useQuery({
    queryKey: [api.rooms.get.path, code],
    queryFn: async () => {
      const url = api.rooms.get.path.replace(":code", code);
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch room");
      return api.rooms.get.responses[200].parse(await res.json());
    },
    enabled: !!code,
    refetchInterval: 5000, // Fallback polling
  });
}

// --- WebSocket Hook ---

export function useGameSocket(roomCode: string, currentPlayerId?: number) {
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!roomCode || !currentPlayerId) return;

    // Connect to WS
    const socket = io(window.location.origin);
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      // Join the specific room channel
      socket.emit("join_room", { code: roomCode, nickname: localStorage.getItem("nickname") });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    // --- Game Events ---

    socket.on(ws.events.PLAYER_JOINED, (data: { player: Player; players: Player[] }) => {
      toast({
        title: "Player Joined",
        description: `${data.player.nickname} has entered the lobby.`,
      });
      queryClient.setQueryData([api.rooms.get.path, roomCode], (old: any) => {
        if (!old) return old;
        return { ...old, players: data.players };
      });
    });

    socket.on(ws.events.GAME_STARTED, (data: { gameState: GameState }) => {
      toast({
        title: "Game Started!",
        description: "Good luck, tycoons!",
        className: "bg-primary text-primary-foreground border-none",
      });
      queryClient.setQueryData([api.rooms.get.path, roomCode], (old: any) => {
        if (!old) return old;
        return { ...old, gameState: data.gameState, room: { ...old.room, status: "playing" } };
      });
    });

    socket.on("dice_rolled", (data: { playerId: number; dice: [number, number]; newPosition: number }) => {
      // In a real app, you might animate this before refetching
      queryClient.invalidateQueries({ queryKey: [api.rooms.get.path, roomCode] });
    });

    socket.on("property_bought", (data: { nickname: string; propertyName: string }) => {
      toast({
        title: "Property Acquired",
        description: `${data.nickname} bought ${data.propertyName}`,
      });
      queryClient.invalidateQueries({ queryKey: [api.rooms.get.path, roomCode] });
    });

    socket.on("turn_ended", (data: { nextPlayerId: number }) => {
      queryClient.invalidateQueries({ queryKey: [api.rooms.get.path, roomCode] });
    });

    socket.on("game_update", (data: { gameState: GameState }) => {
      // Full state sync
      queryClient.setQueryData([api.rooms.get.path, roomCode], (old: any) => {
        if (!old) return old;
        return { ...old, gameState: data.gameState };
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [roomCode, currentPlayerId, queryClient, toast]);

  // Actions
  const startGame = () => socketRef.current?.emit("start_game", { roomCode });
  const rollDice = () => socketRef.current?.emit("roll_dice", { code: roomCode });
  const buyProperty = () => socketRef.current?.emit("buy_property", { code: roomCode });
  const endTurn = () => socketRef.current?.emit("end_turn", { code: roomCode });

  return { isConnected, startGame, rollDice, buyProperty, endTurn };
}
