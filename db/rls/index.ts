// Row-Level Security policy SQL is authored in `./policies.sql` so that
// `supabase db push` can apply it as a migration. This file re-exports policy
// names and helper SQL fragments referenced by integration tests.

export const POLICY_NAMES = {
  childrenSelfRead: 'children_self_read',
  childrenCaregiverRead: 'children_caregiver_read',
  childrenTherapistRead: 'children_therapist_read',
  sessionsCaregiverRead: 'sessions_caregiver_read',
  sessionsTherapistRead: 'sessions_therapist_read',
  inputEventsServerOnly: 'input_events_server_only',
  outputEventsServerOnly: 'output_events_server_only',
  symbolsLibraryReadAll: 'symbols_library_read_all',
  symbolsCustomCaregiverWrite: 'symbols_custom_caregiver_write',
  customVoicesCaregiverWrite: 'custom_voices_caregiver_write',
  consentCaregiverWrite: 'consent_caregiver_write',
  auditLogAdminRead: 'audit_log_admin_read',
  aiUsageServerOnly: 'ai_usage_server_only',
} as const;

export type PolicyName = (typeof POLICY_NAMES)[keyof typeof POLICY_NAMES];
