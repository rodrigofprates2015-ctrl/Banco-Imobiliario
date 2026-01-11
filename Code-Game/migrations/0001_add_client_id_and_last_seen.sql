-- Migration: Add clientId and lastSeen to players table
-- Date: 2024-01-11

-- Add clientId column (nullable initially for existing data)
ALTER TABLE players ADD COLUMN IF NOT EXISTS client_id TEXT;

-- Add lastSeen column with default value
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_seen BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000;

-- Make socketId nullable
ALTER TABLE players ALTER COLUMN socket_id DROP NOT NULL;

-- Generate UUIDs for existing players without clientId
UPDATE players 
SET client_id = gen_random_uuid()::text 
WHERE client_id IS NULL;

-- Now make clientId NOT NULL
ALTER TABLE players ALTER COLUMN client_id SET NOT NULL;

-- Add unique constraint on (roomId, clientId)
ALTER TABLE players ADD CONSTRAINT unique_room_client UNIQUE (room_id, client_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_client_id ON players(client_id);
CREATE INDEX IF NOT EXISTS idx_players_socket_id ON players(socket_id) WHERE socket_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_room_id ON players(room_id);
