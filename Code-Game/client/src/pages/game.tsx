import { useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useRoom, useGameSocket } from "@/hooks/use-game";
import { GameBoard } from "@/components/game-board";
import { GameSidebar } from "@/components/game-sidebar";
import { Loader2 } from "lucide-react";

export default function Game() {
  const [match, params] = useRoute("/game/:code");
  const roomCode = params?.code || "";
  const [, setLocation] = useLocation();

  const playerId = Number(sessionStorage.getItem(`room_${roomCode}_playerId`));
  const { data, isLoading, error } = useRoom(roomCode);
  const { isConnected, rollDice, buyProperty, endTurn } = useGameSocket(roomCode, playerId);

  // Redirect if game isn't valid
  useEffect(() => {
    if (!isLoading && !data) {
      setLocation("/");
    }
  }, [data, isLoading, setLocation]);

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <span className="ml-4 text-lg font-medium">Loading game board...</span>
      </div>
    );
  }

  const { room, players, gameState } = data;

  // Safeguard against missing state
  if (!gameState || !gameState.board) {
    return <div>Initializing game state...</div>;
  }

  const currentPlayerId = players[gameState.currentPlayerIndex]?.id;
  const isMyTurn = currentPlayerId === playerId;

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col lg:flex-row bg-background text-foreground">
      
      {/* Main Board Area */}
      <div className="flex-1 flex items-center justify-center p-4 lg:p-8 overflow-auto bg-grid-white/[0.02]">
        <div className="w-full max-w-[90vh]">
          <GameBoard 
            board={gameState.board} 
            players={players} 
            currentPlayerId={currentPlayerId} 
          />
        </div>
      </div>

      {/* Sidebar Controls */}
      <div className="h-[30vh] lg:h-full lg:w-96 shrink-0 z-20 shadow-2xl">
        <GameSidebar 
          roomCode={roomCode}
          players={players}
          gameState={gameState}
          currentPlayerId={currentPlayerId}
          myPlayerId={playerId}
          onRollDice={rollDice}
          onBuyProperty={buyProperty}
          onEndTurn={endTurn}
          isMyTurn={isMyTurn}
        />
      </div>
    </div>
  );
}
