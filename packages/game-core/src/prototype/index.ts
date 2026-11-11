/**
 * Local prototype loop: one Fugitive, N Agents, no server.
 *
 * @module @x-yard/game-core/prototype
 */

export type {
  PrototypeAgentMove,
  PrototypeAgentOrders,
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
  chooseFugitiveMove,
  createPrototypeGame,
  legalMoves,
  recentLog,
  resolveAgentPhase,
  revealAppearance,
} from './engine';
