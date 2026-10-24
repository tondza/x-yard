/**
 * Local prototype loop: one Fugitive, N Agents, no server.
 *
 * @module @x-yard/game-core/prototype
 */

export type {
  PrototypeCommand,
  PrototypeCommandError,
  PrototypeCommandResult,
  PrototypeLogEntry,
  PrototypeMoveOption,
  PrototypePhase,
  PrototypeResult,
  PrototypeSeat,
  PrototypeState,
} from './types';

export {
  applyFugitiveCommand,
  chooseAgentMove,
  createPrototypeGame,
  legalMoves,
  recentLog,
  resolveAgentPhase,
} from './engine';
