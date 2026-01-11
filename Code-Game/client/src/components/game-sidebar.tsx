import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Player, Property, GameState } from "@shared/schema";
import { Dice5, DollarSign, Home, User } from "lucide-react";

interface GameSidebarProps {
  roomCode: string;
  players: Player[];
  gameState: GameState;
  currentPlayerId: number;
  myPlayerId: number;
  onRollDice: () => void;
  onBuyProperty: () => void;
  onEndTurn: () => void;
  isMyTurn: boolean;
}

export function GameSidebar({
  roomCode,
  players,
  gameState,
  currentPlayerId,
  myPlayerId,
  onRollDice,
  onBuyProperty,
  onEndTurn,
  isMyTurn,
}: GameSidebarProps) {
  const currentTileIndex = players.find(p => p.id === currentPlayerId)?.position || 0;
  const currentTile = gameState.board[currentTileIndex];
  
  const canBuy = isMyTurn && currentTile?.type === 'street' && !currentTile.ownerId;
  const canEndTurn = isMyTurn && gameState.dice[0] > 0; // simplistic check, real logic usually involves checking if moved

  return (
    <div className="w-full lg:w-80 h-full flex flex-col gap-4 bg-card/50 backdrop-blur-md border-l border-white/10 p-4">
      
      {/* Turn Indicator */}
      <div className="glass rounded-xl p-4 text-center mb-2">
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-1">Current Turn</h2>
        <div className="text-xl font-display font-bold text-primary flex items-center justify-center gap-2">
          {players.find(p => p.id === currentPlayerId)?.nickname || "Unknown"}
          {isMyTurn && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">YOU</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        <Button 
          onClick={onRollDice} 
          disabled={!isMyTurn || gameState.dice[0] > 0} // Disable if already rolled (simplistic)
          className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 border-0"
        >
          <Dice5 className="w-4 h-4 mr-2" /> Roll
        </Button>
        <Button 
          onClick={onEndTurn} 
          disabled={!canEndTurn}
          variant="secondary"
        >
          End Turn
        </Button>
        <Button 
          onClick={onBuyProperty} 
          disabled={!canBuy}
          className="col-span-2 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <DollarSign className="w-4 h-4 mr-2" /> Buy {currentTile?.name} (${currentTile?.price})
        </Button>
      </div>

      {/* Dice Result Display */}
      {gameState.dice[0] > 0 && (
        <div className="flex justify-center gap-4 py-4">
          <div className="w-12 h-12 bg-white text-black rounded-lg flex items-center justify-center text-2xl font-bold shadow-lg">
            {gameState.dice[0]}
          </div>
          <div className="w-12 h-12 bg-white text-black rounded-lg flex items-center justify-center text-2xl font-bold shadow-lg">
            {gameState.dice[1]}
          </div>
        </div>
      )}

      {/* Players List */}
      <div className="flex-1 min-h-0 flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Players</h3>
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-3">
            {players.map(player => (
              <div key={player.id} className="bg-slate-800/50 p-3 rounded-lg border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shadow-[0_0_10px_currentColor]" style={{ color: player.color, backgroundColor: player.color }} />
                  <div>
                    <div className="font-bold text-sm">{player.nickname}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Home className="w-3 h-3" />
                      {gameState.board.filter(p => p.ownerId === player.id).length} props
                    </div>
                  </div>
                </div>
                <div className="text-emerald-400 font-mono font-bold">
                  ${player.money}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Game Log */}
      <div className="h-32 bg-black/40 rounded-lg p-2 overflow-y-auto text-xs font-mono space-y-1 border border-white/5">
        {gameState.logs.slice(-10).map((log, i) => (
          <div key={i} className="text-slate-400">
            <span className="text-slate-600 mr-2">[{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}]</span>
            {log}
          </div>
        ))}
      </div>
    </div>
  );
}
