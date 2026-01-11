import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useRoom, useGameSocket } from "@/hooks/use-game";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Copy, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Lobby() {
  const [match, params] = useRoute("/lobby/:code");
  const roomCode = params?.code || "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const playerId = Number(sessionStorage.getItem(`room_${roomCode}_playerId`));
  const { data, isLoading, error } = useRoom(roomCode);
  const { isConnected, startGame } = useGameSocket(roomCode, playerId);

  useEffect(() => {
    if (data?.room.status === "playing") {
      setLocation(`/game/${roomCode}`);
    }
  }, [data?.room.status, roomCode, setLocation]);

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    toast({ title: "Code Copied!", description: "Share it with your friends." });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-center p-4">
        <h1 className="text-2xl font-bold text-destructive mb-2">Room Not Found</h1>
        <p className="text-muted-foreground mb-4">This room code is invalid or the game has ended.</p>
        <Button onClick={() => setLocation("/")}>Go Home</Button>
      </div>
    );
  }

  const { room, players } = data;
  const isHost = players.find(p => p.id === playerId)?.isHost;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-card/60 backdrop-blur-xl border border-white/10 shadow-2xl p-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8 border-b border-white/5 pb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-white mb-1">
              {room.city}
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Waiting for players...
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <div className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Room Code</div>
            <button 
              onClick={copyCode}
              className="text-4xl font-mono font-bold text-primary tracking-widest hover:scale-105 transition-transform flex items-center gap-4 group"
            >
              {room.code}
              <Copy className="w-6 h-6 opacity-50 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        </div>

        {/* Players Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {players.map((player: any) => (
            <div 
              key={player.id} 
              className="flex flex-col items-center p-4 rounded-xl bg-slate-800/50 border border-white/5 relative group"
            >
              {player.isHost && (
                <div className="absolute top-2 right-2 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold uppercase">Host</div>
              )}
              <div 
                className="w-16 h-16 rounded-full mb-3 shadow-lg flex items-center justify-center text-xl font-bold text-white border-2 border-white/20"
                style={{ backgroundColor: player.color }}
              >
                {player.nickname.charAt(0).toUpperCase()}
              </div>
              <div className="font-medium text-sm text-center truncate w-full px-2">
                {player.nickname}
              </div>
              {player.id === playerId && (
                <div className="text-xs text-muted-foreground mt-1">(You)</div>
              )}
            </div>
          ))}
          
          {/* Empty Slots placeholders */}
          {Array.from({ length: Math.max(0, 4 - players.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="flex flex-col items-center p-4 rounded-xl border-2 border-dashed border-white/10 opacity-50">
              <div className="w-16 h-16 rounded-full bg-slate-800 mb-3" />
              <div className="w-20 h-4 bg-slate-800 rounded" />
            </div>
          ))}
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
            {isConnected ? "Connected to server" : "Connecting..."}
          </div>

          {isHost ? (
            <Button 
              size="lg" 
              className="font-bold text-lg px-8 shadow-lg shadow-primary/25"
              onClick={() => startGame()}
              disabled={!isConnected}
            >
              <Play className="w-5 h-5 mr-2 fill-current" />
              Start Game
            </Button>
          ) : (
            <div className="text-sm font-medium animate-pulse text-secondary">
              Waiting for host to start...
            </div>
          )}
        </div>

      </Card>
    </div>
  );
}
