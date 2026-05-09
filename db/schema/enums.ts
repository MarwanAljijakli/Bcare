import { pgEnum } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['child', 'caregiver', 'therapist', 'admin']);

export const localeEnum = pgEnum('locale', ['en', 'ar']);

export const themeEnum = pgEnum('theme', ['light', 'dark', 'hc']);

export const vocabularyLevelEnum = pgEnum('vocabulary_level', [
  'starter',
  'expanding',
  'conversational',
  'advanced',
]);

export const inputModalityEnum = pgEnum('input_modality', [
  'symbol',
  'speech',
  'gesture',
  'keyboard',
]);

export const outputModalityEnum = pgEnum('output_modality', [
  'tts',
  'sentence-strip',
  'visual-confirmation',
]);

export const symbolStatusEnum = pgEnum('symbol_status', [
  'active',
  'pending_review',
  'rejected',
  'archived',
]);

export const consentScopeEnum = pgEnum('consent_scope', [
  'data_processing',
  'voice_recording',
  'webcam_processing',
  'analytics_dashboard',
  'ai_personalization',
]);

export const auditActionEnum = pgEnum('audit_action', [
  'sign_in',
  'sign_out',
  'profile_create',
  'profile_update',
  'child_create',
  'child_update',
  'child_delete',
  'symbol_upload',
  'symbol_moderate',
  'session_export',
  'consent_grant',
  'consent_revoke',
  'data_export',
  'data_delete',
  'admin_action',
]);

export const aiServiceEnum = pgEnum('ai_service', [
  'whisper_stt',
  'gpt_personalization',
  'elevenlabs_tts',
  'azure_tts',
]);
