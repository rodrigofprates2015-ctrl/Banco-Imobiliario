import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Property, Player } from "@shared/schema";
import { User, DollarSign, MapPin, Building2, TrainFront, Lightbulb } from "lucide-react";

interface GameBoardProps {
  board: Property[];
  players: Player[];
  currentPlayerId?: number; // ID of the player whose turn it is
}

// Helper to determine CSS classes for property groups
const getGroupColor = (group?: string) => {
  if (!group) return "bg-slate-700";
  return `group-${group}`;
};

const TileIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'utility': return <Lightbulb className="w-5 h-5 text-yellow-400" />;
    case 'railroad': return <TrainFront className="w-5 h-5 text-slate-400" />;
    case 'chance': return <div className="text-2xl font-bold text-primary">?</div>;
    case 'start': return <div className="text-xs font-bold uppercase tracking-widest text-green-400">Start</div>;
    case 'jail': return <div className="text-xs font-bold uppercase tracking-widest text-orange-400">Jail</div>;
    case 'parking': return <div className="text-xs font-bold uppercase tracking-widest text-blue-400">Parking</div>;
    case 'go_to_jail': return <div className="text-xs font-bold uppercase tracking-widest text-red-400">Go To Jail</div>;
    default: return null;
  }
};

const Tile = ({ property, players, index }: { property: Property, players: Player[], index: number }) => {
  const playersHere = players.filter(p => p.position === index);

  // Special tiles styling
  const isCorner = ['start', 'jail', 'parking', 'go_to_jail'].includes(property.type);
  
  return (
    <div className={cn(
      "relative border border-white/5 flex flex-col items-center justify-between p-1 bg-card/80 backdrop-blur-sm overflow-hidden transition-all hover:bg-card hover:z-10",
      isCorner ? "col-span-1 row-span-1 z-10 bg-card" : ""
    )}>
      {/* Property Color Bar */}
      {property.type === 'street' && (
        <div className={cn("w-full h-3 mb-1 rounded-sm shadow-sm", getGroupColor(property.group))} />
      )}

      {/* Content */}
      <div className="flex flex-col items-center justify-center flex-1 w-full text-center">
        {property.type === 'street' ? (
          <>
            <div className="text-[10px] leading-tight font-medium text-foreground/90 line-clamp-2 px-1 mb-1">
              {property.name}
            </div>
            {property.price && (
              <div className="text-[9px] text-muted-foreground font-mono">
                ${property.price}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <TileIcon type={property.type} />
            <div className="text-[10px] font-medium mt-1 text-center leading-tight">
              {property.name}
            </div>
          </div>
        )}
      </div>

      {/* Players on this tile */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="flex -space-x-1">
          <AnimatePresence>
            {playersHere.map((player) => (
              <motion.div
                key={player.id}
                layoutId={`player-token-${player.id}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-bold text-white relative z-20"
                style={{ backgroundColor: player.color }}
                title={player.nickname}
              >
                {player.nickname.charAt(0).toUpperCase()}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
      
      {/* Owner Marker */}
      {property.ownerId && (
        <div className="absolute bottom-0 right-0 w-2 h-2 rounded-tl-sm" 
             style={{ backgroundColor: players.find(p => p.id === property.ownerId)?.color || 'gray' }} />
      )}
    </div>
  );
};

export function GameBoard({ board, players }: GameBoardProps) {
  if (!board || board.length === 0) return null;

  // Monopoly board logic: 40 tiles.
  // We need to map them to grid positions.
  // 11x11 grid. 
  // Bottom row: indices 0-10 (right to left? No, usually start is bottom right).
  // Standard Monopoly: Start is Bottom Right (index 0). Proceed Clockwise.
  // Indices: 0-9 (Bottom), 10-19 (Left), 20-29 (Top), 30-39 (Right).
  
  // Let's implement this using CSS Grid with specific areas or placement.
  // A simpler approach for responsiveness: Use a loop renderer.
  
  // Top Row (20-30) - Left to Right
  const topRow = board.slice(20, 31);
  // Right Col (31-39) - Top to Bottom
  const rightCol = board.slice(31, 40);
  // Bottom Row (10 down to 0) - Right to Left? Wait.
  // Let's assume standard array order matches travel direction.
  // 0 is GO. 1-9 Bottom. 10 Jail (Bottom Left). 11-19 Left. 20 Parking (Top Left). 21-29 Top. 30 Go To Jail (Top Right). 31-39 Right.
  
  // Re-mapping for visual layout:
  // Top: 20 -> 30 (Left to Right)
  // Right: 31 -> 39 (Top to Bottom)
  // Bottom: 10 -> 0 (Left to Right) -- Wait, 0 is usually bottom-right.
  // Let's stick to standard layout visually:
  // Row 1 (Top): 20, 21, ..., 30
  // Cols (Middle): Left is 19..11, Right is 31..39
  // Row 11 (Bottom): 10, 9, ..., 0

  const top = board.slice(20, 31); // 20 (Top Left) to 30 (Top Right)
  const right = board.slice(31, 40); // 31 (Top) to 39 (Bottom)
  const bottom = board.slice(0, 11).reverse(); // 10 (Bottom Left) to 0 (Bottom Right)
  const left = board.slice(11, 20).reverse(); // 19 (Top) to 11 (Bottom)

  return (
    <div className="relative w-full aspect-square max-w-[800px] mx-auto bg-slate-900 rounded-xl shadow-2xl border border-white/10 overflow-hidden">
      <div className="grid grid-cols-11 grid-rows-11 h-full w-full">
        
        {/* TOP ROW (20-30) */}
        {top.map((prop, i) => (
          <div key={prop.id} className="col-span-1 row-span-1 border-b border-r border-white/10">
            <Tile property={prop} players={players} index={20 + i} />
          </div>
        ))}

        {/* MIDDLE SECTION - Left & Right Columns + Center */}
        {/* We need 9 rows for the middle section */}
        {Array.from({ length: 9 }).map((_, rowIndex) => {
          // Left Side Tile (Index 19 down to 11)
          const leftTileIndex = 19 - rowIndex;
          const leftTile = board[leftTileIndex];

          // Right Side Tile (Index 31 up to 39)
          const rightTileIndex = 31 + rowIndex;
          const rightTile = board[rightTileIndex];

          return (
            <React.Fragment key={rowIndex}>
              {/* Left Column Tile */}
              <div className="col-span-1 row-span-1 border-b border-r border-white/10">
                 <Tile property={leftTile} players={players} index={leftTileIndex} />
              </div>

              {/* Center Board (Empty or Logo) - Only render on first row of loop, span 9 */}
              {rowIndex === 0 && (
                <div className="col-span-9 row-span-9 bg-slate-950/50 flex flex-col items-center justify-center relative p-8">
                  <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80')] bg-cover bg-center opacity-10 mix-blend-overlay pointer-events-none" />
                  {/* City Name */}
                  <h1 className="text-4xl md:text-6xl font-display font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-white/20 uppercase tracking-widest text-center opacity-20 select-none">
                    Urban<br/>Poly
                  </h1>
                </div>
              )}

              {/* Right Column Tile */}
              <div className="col-span-1 row-span-1 border-b border-l border-white/10">
                <Tile property={rightTile} players={players} index={rightTileIndex} />
              </div>
            </React.Fragment>
          );
        })}

        {/* BOTTOM ROW (10-0) */}
        {bottom.map((prop, i) => {
          // Bottom array is 10...0
          // The index in original array is 10-i
          return (
            <div key={prop.id} className="col-span-1 row-span-1 border-t border-r border-white/10">
              <Tile property={prop} players={players} index={10 - i} />
            </div>
          );
        })}

      </div>
    </div>
  );
}
