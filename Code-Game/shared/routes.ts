import { z } from 'zod';
import { insertRoomSchema, insertPlayerSchema } from './schema';

export const api = {
  rooms: {
    create: {
      method: 'POST' as const,
      path: '/api/rooms',
      input: z.object({
        city: z.string(),
        nickname: z.string(),
      }),
      responses: {
        201: z.object({ roomCode: z.string(), playerId: z.number(), token: z.string() }),
      },
    },
    join: {
      method: 'POST' as const,
      path: '/api/rooms/join',
      input: z.object({
        code: z.string(),
        nickname: z.string(),
      }),
      responses: {
        200: z.object({ roomCode: z.string(), playerId: z.number(), token: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/rooms/:code',
      responses: {
        200: z.object({
          room: z.any(), // Typed as Room
          players: z.array(z.any()), // Typed as Player[]
          gameState: z.any(), // Typed as GameState
        }),
        404: z.object({ message: z.string() }),
      },
    },
  },
};

export const ws = {
  events: {
    JOIN_ROOM: 'join_room', // client -> server
    PLAYER_JOINED: 'player_joined', // server -> client
    START_GAME: 'start_game', // client -> server
    GAME_STARTED: 'game_started', // server -> client
    ROLL_DICE: 'roll_dice', // client -> server
    DICE_ROLLED: 'dice_rolled', // server -> client
    BUY_PROPERTY: 'buy_property', // client -> server
    PROPERTY_BOUGHT: 'property_bought', // server -> client
    END_TURN: 'end_turn', // client -> server
    TURN_ENDED: 'turn_ended', // server -> client
    GAME_UPDATE: 'game_update', // server -> client (full state sync)
  }
};
