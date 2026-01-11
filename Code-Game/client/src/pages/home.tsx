import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateRoom, useJoinRoom } from "@/hooks/use-game";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dice5, Building2, MapPin, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [nickname, setNickname] = useState(localStorage.getItem("nickname") || "");
  const [roomCode, setRoomCode] = useState("");
  const [city, setCity] = useState("New York, NY");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const createRoom = useCreateRoom();
  const joinRoom = useJoinRoom();

  const saveNickname = () => {
    if (nickname) localStorage.setItem("nickname", nickname);
  };

  const handleCreate = async () => {
    if (!nickname) {
      toast({ title: "Nickname required", variant: "destructive" });
      return;
    }
    saveNickname();
    try {
      const data = await createRoom.mutateAsync({ city, nickname });
      // Store token/playerId in session/local storage if needed, but for now we rely on response
      // For simplicity in this demo, passing ID via URL state might be tricky with wouter, 
      // so let's store session data in localStorage.
      sessionStorage.setItem(`room_${data.roomCode}_token`, data.token);
      sessionStorage.setItem(`room_${data.roomCode}_playerId`, String(data.playerId));
      setLocation(`/lobby/${data.roomCode}`);
    } catch (e: any) {
      toast({ title: "Error creating room", description: e.message, variant: "destructive" });
    }
  };

  const handleJoin = async () => {
    if (!nickname || !roomCode) {
      toast({ title: "Nickname and Code required", variant: "destructive" });
      return;
    }
    saveNickname();
    try {
      const data = await joinRoom.mutateAsync({ code: roomCode, nickname });
      sessionStorage.setItem(`room_${data.roomCode}_token`, data.token);
      sessionStorage.setItem(`room_${data.roomCode}_playerId`, String(data.playerId));
      setLocation(`/lobby/${data.roomCode}`);
    } catch (e: any) {
      toast({ title: "Error joining room", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-primary/20 blur-[120px] rounded-full" />
        <div className="absolute top-[40%] right-[10%] w-[30%] h-[30%] bg-secondary/20 blur-[100px] rounded-full" />
      </div>

      <Card className="w-full max-w-md bg-card/60 backdrop-blur-xl border border-white/10 shadow-2xl z-10 p-8">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 mb-4 rotate-3 hover:rotate-6 transition-transform">
            <Dice5 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-display font-black tracking-tight text-white mb-2">
            Urban<span className="text-primary">Poly</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Buy real cities. Bankrupt your friends.
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Your Identity</label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-3.5 w-5 h-5 text-muted-foreground" />
              <Input 
                placeholder="Enter your nickname" 
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="pl-12"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/5">
            {/* Create Room Section */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-primary ml-1">Start New Game</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-muted-foreground" />
                <Input 
                  placeholder="Target City (e.g. London)" 
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="pl-12 text-sm"
                />
              </div>
              <Button 
                onClick={handleCreate} 
                className="w-full font-bold" 
                disabled={createRoom.isPending}
              >
                {createRoom.isPending ? "Creating..." : "Create Room"}
              </Button>
            </div>

            {/* Join Room Section */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-secondary ml-1">Join Existing</label>
              <div className="relative">
                <Users className="absolute left-4 top-3.5 w-5 h-5 text-muted-foreground" />
                <Input 
                  placeholder="Room Code" 
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  className="pl-12 text-sm uppercase font-mono tracking-widest"
                  maxLength={6}
                />
              </div>
              <Button 
                variant="secondary" 
                onClick={handleJoin} 
                className="w-full font-bold"
                disabled={joinRoom.isPending}
              >
                {joinRoom.isPending ? "Joining..." : "Join Game"}
              </Button>
            </div>
          </div>
        </div>
      </Card>
      
      <div className="absolute bottom-4 text-xs text-muted-foreground text-center w-full z-10">
        &copy; 2024 Urban Poly. Powered by Google Maps Platform.
      </div>
    </div>
  );
}

function UserIcon(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}
