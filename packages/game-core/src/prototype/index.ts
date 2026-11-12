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
  PrototypeJob,
  PrototypeJobIcon,
  PrototypeJobPickup,
  PrototypeJobStatus,
  PrototypeLogEntry,
  PrototypeMoveOption,
  PrototypePhase,
  PrototypeResult,
  PrototypeSeat,
  PrototypeSetup,
  PrototypeState,
} from './types';

export type { PrototypeDefaults } from './engine';

export {
  PROVISIONAL_PROTOTYPE_SETUP,
  applyFugitiveCommand,
  chooseAgentMove,
  chooseFugitiveCommand,
  chooseFugitiveMove,
  createPrototypeGame,
  legalMoves,
  prototypeAppearanceTurns,
  recentLog,
  resolveAgentPhase,
  revealAppearance,
} from './engine';
