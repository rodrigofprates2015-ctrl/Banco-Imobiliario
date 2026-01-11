# Multiplayer Synchronization Fix - Implementation Guide

## Overview

This document describes the implementation of the multiplayer synchronization fix for Urban Poly. The fix addresses critical issues with player detection, WebSocket connections, and real-time state synchronization.

## Changes Implemented

### 1. Database Schema Updates

**File:** `shared/schema.ts`

- Added `clientId` field (text, not null) to players table
- Added `lastSeen` field (integer, default Date.now()) for heartbeat tracking
- Made `socketId` nullable to support disconnected players
- Added unique constraint on (roomId, clientId) to prevent duplicates

**Migration:** `migrations/0001_add_client_id_and_last_seen.sql`

### 2. Client ID Manager

**File:** `client/src/lib/client-id.ts`

New utility class that manages persistent UUID for player identification:
- Generates UUID on first visit using `crypto.randomUUID()`
- Stores in localStorage with key `urbanpoly_client_id`
- Provides methods to get/create/clear client ID

### 3. Storage Layer Enhancements

**File:** `server/storage.ts`

New methods added:
- `getPlayerByClientId(clientId, roomId)` - Find player by client ID
- `getPlayerById(playerId)` - Find player by ID
- `upsertPlayer(player)` - Create or update player (prevents duplicates)
- `updatePlayerSocket(playerId, socketId)` - Update socket ID
- `deletePlayer(playerId)` - Remove player

### 4. REST API Updates

**Files:** `server/routes.ts`, `shared/routes.ts`

**POST /api/rooms (Create Room):**
- Now accepts `clientId` in request body
- Creates player immediately with real ID (not 0)
- Returns actual `playerId` in response

**POST /api/rooms/join (Join Room):**
- Now accepts `clientId` in request body
- Validates room exists, not full, and status is "waiting"
- Uses `upsertPlayer` to handle reconnections
- Returns actual `playerId` in response

### 5. WebSocket Event Handlers

**File:** `server/routes.ts`

**join_room event:**
- Validates playerId and clientId match
- Updates player's socketId to current socket
- Emits player_joined to all in room with updated player list

**disconnect event:**
- Finds player by socketId
- Sets socketId to null
- Emits player_disconnected to room
- Promotes new host if disconnected player was host
- Schedules cleanup after 60 seconds

**heartbeat event:**
- Updates player's lastSeen timestamp
- Used for connection health monitoring

**New events added:**
- `player_disconnected` - Notifies when player leaves
- `player_reconnected` - Notifies when player returns
- `host_changed` - Notifies when host is promoted
- `game_ended` - Notifies when game finishes
- `error` - Sends structured error messages

### 6. Frontend Updates

**File:** `client/src/pages/home.tsx`

- Imports and uses ClientIdManager
- Includes clientId in create/join room requests
- Validates clientId before making requests
- Logs playerId for debugging

**File:** `client/src/hooks/use-game.ts`

- Validates playerId is not 0 before connecting socket
- Includes playerId and clientId in join_room event
- Implements heartbeat every 10 seconds
- Handles new events: player_disconnected, player_reconnected, host_changed
- Shows reconnecting toast on disconnect
- Clears heartbeat interval on cleanup

### 7. Game State Synchronization

**File:** `server/routes.ts`

All game events now include timestamp in gameState:
- `start_game` - Adds timestamp to initial state
- `roll_dice` - Adds timestamp to state update
- `buy_property` - Adds timestamp to state update
- `end_turn` - Adds timestamp to state update

This enables conflict resolution if polling and WebSocket updates overlap.

## How to Deploy

### Step 1: Database Migration

**Option A: Using the migration script (recommended)**

```bash
cd Code-Game
npm run db:migrate
```

**Option B: Manual migration**

Connect to your PostgreSQL database and run:

```sql
-- Add new columns
ALTER TABLE players ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_seen BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000;
ALTER TABLE players ALTER COLUMN socket_id DROP NOT NULL;

-- Generate UUIDs for existing players
UPDATE players 
SET client_id = gen_random_uuid()::text 
WHERE client_id IS NULL;

-- Make clientId NOT NULL
ALTER TABLE players ALTER COLUMN client_id SET NOT NULL;

-- Add unique constraint
ALTER TABLE players ADD CONSTRAINT unique_room_client UNIQUE (room_id, client_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_players_client_id ON players(client_id);
CREATE INDEX IF NOT EXISTS idx_players_socket_id ON players(socket_id) WHERE socket_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_room_id ON players(room_id);
```

### Step 2: Install Dependencies

```bash
cd Code-Game
npm install
```

### Step 3: Start the Server

```bash
npm run dev
```

### Step 4: Test the Fix

**Test 1: Two Players Join Room**

1. Open browser 1, create a room
2. Note the room code
3. Open browser 2 (incognito or different browser)
4. Join the room with the code
5. **Expected:** Browser 1 should instantly show player 2's avatar and nickname
6. **Expected:** Console should show WebSocket connection logs

**Test 2: Host Starts Game**

1. In browser 1 (host), click "Start Game"
2. **Expected:** Both browsers navigate to game screen simultaneously
3. **Expected:** Both see the same board and player list

**Test 3: Player Disconnects**

1. Close browser 2 (or close the tab)
2. **Expected:** Browser 1 shows toast "Player Left: [nickname] has disconnected"
3. **Expected:** Player 2 disappears from lobby after a moment

**Test 4: Player Reconnects**

1. Reopen browser 2 and join the same room
2. **Expected:** Same playerId is used (check sessionStorage)
3. **Expected:** Player reappears in lobby instantly

## Troubleshooting

### Issue: "Invalid playerId" error in console

**Cause:** sessionStorage has playerId=0 from old implementation

**Fix:** Clear sessionStorage and refresh:
```javascript
sessionStorage.clear();
location.reload();
```

### Issue: "Client ID not initialized" toast

**Cause:** localStorage was cleared or crypto.randomUUID() not available

**Fix:** Check browser compatibility (needs modern browser with crypto API)

### Issue: Players not appearing in lobby

**Cause:** WebSocket connection failed or DATABASE_URL not set

**Fix:** 
1. Check browser console for WebSocket errors
2. Verify DATABASE_URL environment variable is set
3. Check server logs for connection errors

### Issue: Migration fails with "relation already exists"

**Cause:** Migration was partially applied

**Fix:** Check which columns exist and run only missing statements:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'players';
```

## Monitoring

### Key Metrics to Watch

1. **WebSocket Connection Rate**
   - Check server logs for "[WS] Connected" messages
   - Should be 100% for all clients

2. **Player Join Latency**
   - Time between join_room emit and player_joined receive
   - Should be < 500ms

3. **Heartbeat Failures**
   - Players with lastSeen > 30 seconds old
   - Should be 0 for connected players

4. **Error Rate**
   - Count of ERROR events emitted
   - Should be < 1% of total events

### Logging

All WebSocket events are logged with prefix `[WS]`:
- `[WS] Connected` - New socket connection
- `[WS] join_room: playerId=X` - Player joining room
- `[WS] Updated socketId for player X` - Socket ID updated
- `[WS] Player X disconnected` - Player left
- `[WS] Promoted X to host` - Host changed

## Rollback Plan

If issues occur, rollback by:

1. **Revert code changes:**
   ```bash
   git revert <commit-hash>
   ```

2. **Revert database migration:**
   ```sql
   ALTER TABLE players DROP CONSTRAINT IF EXISTS unique_room_client;
   ALTER TABLE players DROP COLUMN IF EXISTS client_id;
   ALTER TABLE players DROP COLUMN IF EXISTS last_seen;
   ALTER TABLE players ALTER COLUMN socket_id SET NOT NULL;
   ```

3. **Clear client storage:**
   ```javascript
   localStorage.removeItem('urbanpoly_client_id');
   sessionStorage.clear();
   ```

## Next Steps

### Phase 2 Enhancements (Future)

1. **Stale Connection Detection**
   - Background job to detect players with old lastSeen
   - Auto-disconnect after 30 seconds of no heartbeat

2. **Reconnection UI**
   - Show "Reconnecting..." overlay
   - Display countdown timer
   - Offer manual reconnect button

3. **Game State Conflict Resolution**
   - Use timestamp to resolve conflicts
   - Prefer WebSocket updates over polling

4. **Comprehensive Testing**
   - Unit tests for ClientIdManager
   - Integration tests for upsert logic
   - E2E tests for multiplayer scenarios

## Support

For issues or questions, check:
- Server logs: `npm run dev` output
- Browser console: F12 → Console tab
- Database state: Query players table directly
- WebSocket traffic: F12 → Network → WS tab

## Summary

This implementation fixes the critical multiplayer synchronization issues by:
1. ✅ Implementing persistent client identification with UUID
2. ✅ Returning real player IDs from REST API (not 0)
3. ✅ Validating player ID before WebSocket connection
4. ✅ Handling disconnections and reconnections properly
5. ✅ Preventing duplicate player records with unique constraint
6. ✅ Adding heartbeat mechanism for connection health
7. ✅ Implementing real-time event broadcasting

The system now provides instant player detection, reliable state synchronization, and proper cleanup on disconnection.
