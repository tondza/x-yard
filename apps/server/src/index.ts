/**
 * X-Yard Yard server.
 *
 * Responsibilities (deliberately thin — all rules live in `@x-yard/game-core`):
 *   - own the authoritative state of each Yard instance (§6),
 *   - translate socket messages into `game-core` actions,
 *   - broadcast the resulting view to clients,
 *   - never trust a client's claim about its own position, tickets, or role.
 *
 * @module @x-yard/server
 */

import { pathToFileURL } from 'node:url';

import Fastify, { type FastifyInstance } from 'fastify';
import { Server as SocketServer } from 'socket.io';

import {
  DEMO_BOARD,
  PROVISIONAL_REVEAL_PULSE_TURNS,
  PROVISIONAL_YARD_TURN_LIMIT,
  SENSOR_SWEEP_RADIUS,
  TRANSPORT_MODES,
} from '@x-yard/game-core';
import {
  SOCKET_EVENTS,
  isClientMessage,
  type BoardDto,
  type ErrorMessage,
  type ServerMessage,
} from '@x-yard/shared-types';

/** Project a `game-core` graph into the wire DTO the client renders. */
function toBoardDto(): BoardDto {
  return {
    mapId: DEMO_BOARD.mapId,
    world: DEMO_BOARD.world,
    stations: DEMO_BOARD.nodes.map((node) => ({
      id: node.id,
      class: node.class,
      district: node.district,
      facilities: node.facilities,
      x: node.x,
      y: node.y,
    })),
    routes: DEMO_BOARD.edges.map((edge) => ({
      from: edge.a,
      to: edge.b,
      mode: edge.mode,
    })),
  };
}

/** Build the Fastify instance without binding a port (so tests can inject it). */
export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get('/health', () => ({
    status: 'ok',
    mapId: DEMO_BOARD.mapId,
    transportModes: TRANSPORT_MODES,
    sensorSweepRadius: SENSOR_SWEEP_RADIUS,
    // PROVISIONAL: see the open questions in GAME_VISION.md.
    turnLimit: PROVISIONAL_YARD_TURN_LIMIT,
    revealPulseTurns: PROVISIONAL_REVEAL_PULSE_TURNS,
  }));

  app.get('/board', () => toBoardDto());

  return app;
}

/** Attach the Socket.io Yard channel to an HTTP server. */
export function attachYardSocket(app: FastifyInstance): SocketServer {
  const io = new SocketServer(app.server, {
    cors: { origin: true },
  });

  io.on('connection', (socket) => {
    const send = (message: ServerMessage): void => {
      socket.emit(SOCKET_EVENTS.serverMessage, message);
    };

    socket.on(SOCKET_EVENTS.clientMessage, (raw: unknown) => {
      if (!isClientMessage(raw)) {
        const error: ErrorMessage = {
          type: 'error',
          code: 'internal',
          message: 'unrecognised client message',
        };
        send(error);
        return;
      }

      // TODO(bootstrap): route to the game-core turn machine once it lands
      // (see PROJECT_LOG.md). Until then every accepted intent is acknowledged
      // explicitly rather than silently dropped.
      const error: ErrorMessage = {
        type: 'error',
        code: 'internal',
        message: `handler not implemented yet: ${raw.type}`,
      };
      send(error);
    });
  });

  return io;
}

/** Boot the server when run directly. */
async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 3001);
  const app = buildServer();
  attachYardSocket(app);
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`[x-yard] server listening on http://localhost:${port}`);
}

// Only auto-start when this file is the process entry point, so importing
// `buildServer` from a test never opens a port.
const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  void main();
}
