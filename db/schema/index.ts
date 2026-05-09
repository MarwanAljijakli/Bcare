// Drizzle schema entry point. 15 tables: 13 from the master prompt + `children`
// (split out from `profiles` because children don't authenticate) + `ai_usage_ledger`
// (the cost-guard meter required by acceptance criterion 13).
//
// `import { ... } from '@bluecare/db/schema'` is the only import path.

export * from './enums';
export * from './users';
export * from './profiles';
export * from './children';
export * from './symbol_libraries';
export * from './symbols';
export * from './vocabulary_sets';
export * from './sessions';
export * from './input_events';
export * from './output_events';
export * from './progress_metrics';
export * from './gamification_state';
export * from './audit_log';
export * from './consent_records';
export * from './custom_voices';
export * from './ai_usage_ledger';
export * from './waitlist_signups';
