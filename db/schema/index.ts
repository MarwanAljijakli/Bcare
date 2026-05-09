// Drizzle schema entry point. 15 tables: 13 from the master prompt + `children`
// (split out from `profiles` because children don't authenticate) + `ai_usage_ledger`
// (the cost-guard meter required by acceptance criterion 13).
//
// `import { ... } from '@bluecare/db/schema'` is the only import path.

export * from './enums.js';
export * from './users.js';
export * from './profiles.js';
export * from './children.js';
export * from './symbol_libraries.js';
export * from './symbols.js';
export * from './vocabulary_sets.js';
export * from './sessions.js';
export * from './input_events.js';
export * from './output_events.js';
export * from './progress_metrics.js';
export * from './gamification_state.js';
export * from './audit_log.js';
export * from './consent_records.js';
export * from './custom_voices.js';
export * from './ai_usage_ledger.js';
