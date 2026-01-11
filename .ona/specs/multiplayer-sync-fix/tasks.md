# Implementation Plan

- [ ] 1. Create database migration for player schema updates
  - Add `clientId` column (text, nullable initially) to players table
  - Add `lastSeen` column (timestamp, default NOW()) to players table
  - Make `socketId` column nullable
  - Generate UUIDs for existing players without clientId
  - Add unique constraint on (roomId, clientId)
  - Create indexes on clientId and socketId
  - _Requirements: 1.1, 1.2, 6.1, 6.2, 6.3, 6.4, 6.5, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [ ] 2. Update shared schema types
  - Add clientId and lastSeen fields to Player type in `/shared/schema.ts`
  - Update insertPlayerSchema to include clientId
  - Update Room and Player TypeScript interfaces
  - _Requirements: 1.3, 6.1_

- [ ] 3. Implement Client ID Manager utility
  - Create `/client/src/lib/client-id.ts` with ClientIdManager class
  - Implement getOrCreateClientId() method using crypto.randomUUID()
  - Store UUID in localStorage with key 'urbanpoly_client_id'
  - Implement getClientId() method to retrieve existing UUID
  - Write unit tests for ClientIdManager
  - _Requirements: 1.1, 1.6_

- [ ] 4. Extend storage layer with new player methods
  - Add getPlayerByClientId(clientId, roomId) method to IStorage interface
  - Add upsertPlayer(player) method to IStorage interface
  - Add updatePlayerSocket(playerId, socketId) method to IStorage interface
  - Add getPlayerById(playerId) method to IStorage interface
  - Add deletePlayer(playerId) method to IStorage interface
  - Implement all new methods in DatabaseStorage class
  - Write unit tests for upsert logic (create vs update scenarios)
  - _Requirements: 1.5, 6.3, 6.4_

- [ ] 5. Update REST API create room endpoint
  - Modify POST /api/rooms to accept clientId in request body
  - Update input validation schema to require clientId
  - Create player record immediately with clientId and socketId="pending"
  - Return real playerId (not 0) in response
  - Add error handling for room creation failures
  - Write integration test verifying playerId is returned correctly
  - _Requirements: 1.2, 1.3, 1.4, 2.1, 8.3_

- [ ] 6. Update REST API join room endpoint
  - Modify POST /api/rooms/join to accept clientId in request body
  - Update input validation schema to require clientId
  - Check room exists, not full (max 4 players), and status is "waiting"
  - Use upsertPlayer to create or update player record
  - Return real playerId in response
  - Add error handling for room full, game started, room not found
  - Write integration tests for all error scenarios
  - _Requirements: 1.2, 1.3, 1.5, 2.1, 8.3, 8.4, 8.5_

- [ ] 7. Update home page to use Client ID Manager
  - Import ClientIdManager in `/client/src/pages/home.tsx`
  - Call getOrCreateClientId() when component mounts
  - Include clientId in createRoom and joinRoom API calls
  - Store returned playerId in sessionStorage
  - Add error handling and toast notifications
  - _Requirements: 1.1, 1.2, 1.4_

- [ ] 8. Update useGameSocket hook with playerId validation
  - Modify useEffect dependency check to explicitly validate playerId
  - Change condition from `!currentPlayerId` to `!currentPlayerId || currentPlayerId === 0`
  - Add console error when playerId is invalid
  - Prevent socket initialization if playerId is invalid
  - Write unit test verifying socket doesn't connect with playerId=0
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 9. Update join_room WebSocket event to include clientId
  - Modify socket.emit("join_room") to include playerId and clientId
  - Retrieve clientId from ClientIdManager
  - Update event payload type definition
  - _Requirements: 1.2, 2.4_

- [ ] 10. Implement enhanced join_room handler on server
  - Validate room exists and return error event if not
  - Validate playerId and clientId match using getPlayerById and getPlayerByClientId
  - Update player socketId to socket.id using updatePlayerSocket
  - Join socket to room code
  - Fetch all players in room
  - Emit player_joined event to all sockets in room with updated player list
  - Add error handling for validation failures
  - Write integration test simulating two players joining
  - _Requirements: 1.5, 1.6, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 8.1, 8.2, 8.6_

- [ ] 11. Implement disconnect event handler on server
  - Find player by socketId using getPlayerBySocket
  - Update player socketId to null if player found
  - Emit player_disconnected event to room with playerId and nickname
  - Check if disconnected player was host
  - If host disconnected, promote next player (lowest ID) to host
  - Emit host_changed event if host was promoted
  - Schedule cleanup task to delete player after 60s if not reconnected
  - Write integration test verifying disconnect cleanup
  - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.7_

- [ ] 12. Implement player_disconnected event handler on client
  - Add socket.on("player_disconnected") listener in useGameSocket
  - Update React Query cache to remove or mark player as offline
  - Display toast notification with disconnected player's nickname
  - Update UI to reflect player offline status
  - _Requirements: 4.4_

- [ ] 13. Implement reconnection logic on client
  - Detect socket disconnect event
  - Display "Reconnecting..." toast notification
  - Attempt automatic reconnection (Socket.IO handles this by default)
  - On reconnect, re-emit join_room with existing playerId and clientId
  - Display success toast when reconnected
  - Redirect to home after 3 failed reconnection attempts
  - Write integration test simulating disconnect and reconnect
  - _Requirements: 4.6, 7.4, 7.5, 7.6, 8.7_

- [ ] 14. Implement player_reconnected event on server
  - Detect when player with existing clientId reconnects within 60s
  - Cancel scheduled cleanup task for that player
  - Emit player_reconnected event to room
  - _Requirements: 4.6_

- [ ] 15. Implement heartbeat mechanism on client
  - Add setInterval in useGameSocket to emit "heartbeat" event every 10 seconds
  - Include playerId in heartbeat payload
  - Clear interval on component unmount
  - _Requirements: 7.1_

- [ ] 16. Implement heartbeat handler on server
  - Add socket.on("heartbeat") listener
  - Update player lastSeen timestamp using updatePlayer
  - No response needed (fire and forget)
  - _Requirements: 7.2_

- [ ] 17. Implement stale connection detection on server
  - Create background job that runs every 30 seconds
  - Query players with lastSeen older than 30 seconds and socketId not null
  - For each stale player, trigger disconnect logic
  - _Requirements: 7.3_

- [ ] 18. Update game state synchronization events
  - Ensure all game events (roll_dice, buy_property, end_turn) include full gameState
  - Update game_update event handler on client to merge state correctly
  - Add timestamp to gameState for conflict resolution
  - Prioritize WebSocket updates over polling when both occur
  - Write integration test verifying game state sync across multiple clients
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 19. Implement game_ended event
  - Emit game_ended event when game finishes with winnerId and finalState
  - Update room status to "finished" in database
  - Handle game_ended event on client to show winner modal
  - _Requirements: 5.6_

- [ ] 20. Add comprehensive error handling to WebSocket events
  - Wrap all socket event handlers in try-catch blocks
  - Emit "error" event to client with structured error format (code, message, details)
  - Log full error with stack trace on server
  - Add socket.on("error") handler on client to display toast notifications
  - Create error code constants for common errors
  - Write tests for each error scenario
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [ ] 21. Update lobby page to handle real-time player updates
  - Verify React Query cache updates correctly on player_joined event
  - Ensure UI re-renders immediately when new player joins
  - Keep polling as fallback but prioritize WebSocket updates
  - Display connection status indicator
  - _Requirements: 3.3, 3.4, 3.5_

- [ ] 22. Update game page to handle real-time game updates
  - Verify game_update events update UI immediately
  - Display loading state during actions
  - Show reconnecting overlay when connection lost
  - Disable player actions when not connected
  - _Requirements: 5.4, 8.7_

- [ ] 23. Write end-to-end tests for multiplayer scenarios
  - Test: Two players join room and see each other instantly
  - Test: Host starts game and both players see game screen
  - Test: Player rolls dice and other player sees result
  - Test: Player disconnects and reconnects with same ID
  - Test: Host disconnects and next player becomes host
  - Test: Room full error when 5th player tries to join
  - Test: Cannot join game that already started
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [ ] 24. Add monitoring and logging
  - Add structured logging for all WebSocket events with timestamps
  - Log database query durations
  - Add error logging with full context
  - Create metrics for connection success rate, event latency, error rate
  - _Requirements: 8.6_

- [ ] 25. Create deployment and rollback plan
  - Document database migration steps
  - Create feature flag for new multiplayer flow
  - Test migration on staging environment
  - Plan gradual rollout (10% → 50% → 100%)
  - Document rollback procedure
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
