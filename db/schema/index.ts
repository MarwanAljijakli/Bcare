// Drizzle schema entry point. 18 tables total:
//   • 13 from the master prompt (users, profiles, symbol_libraries, symbols,
//     vocabulary_sets, sessions, input_events, output_events, progress_metrics,
//     gamification_state, audit_log, consent_records, custom_voices)
//   • 2 added in Module 0 (children, ai_usage_ledger)
//   • 1 added in Module 1 (waitlist_signups — deprecated, retained read-only)
//   • 3 added in Module 2.B (therapist_invites, therapist_grants, draft_onboarding)
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
// Module 2.B additions
export * from './therapist_invites';
export * from './therapist_grants';
export * from './draft_onboarding';
// Module 4 additions
export * from './vocabulary_suggestions';
