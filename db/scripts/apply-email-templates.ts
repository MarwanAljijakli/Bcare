/**
 * Push the Supabase Auth email templates to the live project via the
 * Management API (Phase 10.C step 4 / step 5 of the launch runbook).
 *
 * What this does:
 *   - Reads the EN HTML templates from db/supabase/email-templates/.
 *   - Tries to PATCH /v1/projects/{ref}/config/auth with subject +
 *     content fields. If Supabase's shared-mailer spam filter blocks
 *     the HTML payload, retries with subject-only so at least the
 *     subject lines reflect the new copy.
 *
 * Required env (loaded from web/.env.local):
 *   - NEXT_PUBLIC_SUPABASE_URL   (used to derive the project ref)
 *   - SUPABASE_ACCESS_TOKEN      (personal access token, mgmt API)
 *
 * Usage:
 *   pnpm dlx tsx db/scripts/apply-email-templates.ts
 *   pnpm dlx tsx db/scripts/apply-email-templates.ts --dry-run
 *   pnpm dlx tsx db/scripts/apply-email-templates.ts --subject-only
 */

import './lib/env';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface TemplateSpec {
  file: string;
  subjectField: string;
  subject: string;
  contentField: string;
}

const TEMPLATES: TemplateSpec[] = [
  {
    file: 'confirm-signup.en.html',
    subjectField: 'mailer_subjects_confirmation',
    subject: 'Confirm your email to finish signup',
    contentField: 'mailer_templates_confirmation_content',
  },
  {
    file: 'recovery.en.html',
    subjectField: 'mailer_subjects_recovery',
    subject: 'Reset your BlueCare password',
    contentField: 'mailer_templates_recovery_content',
  },
  {
    file: 'magic-link.en.html',
    subjectField: 'mailer_subjects_magic_link',
    subject: 'Your BlueCare sign-in link',
    contentField: 'mailer_templates_magic_link_content',
  },
  {
    file: 'invite.en.html',
    subjectField: 'mailer_subjects_invite',
    subject: "You've been invited to BlueCare",
    contentField: 'mailer_templates_invite_content',
  },
  {
    file: 'email-change.en.html',
    subjectField: 'mailer_subjects_email_change',
    subject: 'Confirm your new BlueCare email',
    contentField: 'mailer_templates_email_change_content',
  },
];

function projectRefFromUrl(url: string): string | null {
  const m = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i);
  return m ? m[1]! : null;
}

async function patchAuth(
  projectRef: string,
  accessToken: string,
  patch: Record<string, string>,
): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

async function main(): Promise<void> {
  const dry = process.argv.includes('--dry-run');
  const subjectOnly = process.argv.includes('--subject-only');
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const projectRef = projectRefFromUrl(supabaseUrl);
  if (!accessToken || !projectRef) {
    console.error('Missing SUPABASE_ACCESS_TOKEN or NEXT_PUBLIC_SUPABASE_URL in web/.env.local.');
    process.exit(1);
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const dir = resolve(here, '..', 'supabase', 'email-templates');

  const fullPatch: Record<string, string> = {};
  const subjectsPatch: Record<string, string> = {};
  for (const t of TEMPLATES) {
    const filePath = join(dir, t.file);
    const html = await readFile(filePath, 'utf8');
    fullPatch[t.subjectField] = t.subject;
    fullPatch[t.contentField] = html;
    subjectsPatch[t.subjectField] = t.subject;
    console.info(`  + ${t.file} → ${t.subjectField} + ${t.contentField} (${html.length} bytes)`);
  }

  if (dry) {
    console.info('\n--dry-run: not patching auth config.');
    return;
  }

  if (!subjectOnly) {
    console.info('\nAttempting full subject+content patch …');
    const result = await patchAuth(projectRef, accessToken, fullPatch);
    if (result.ok) {
      console.info(`✓ Full patch succeeded (${result.status}).`);
      return;
    }
    console.warn(`✗ Full patch ${result.status}: ${result.body.slice(0, 200)}`);
    console.warn('   → Supabase shared-mailer rejects rich HTML. Retrying with subjects only …');
  }

  const result = await patchAuth(projectRef, accessToken, subjectsPatch);
  if (!result.ok) {
    console.error(`\n✗ Subjects-only patch ${result.status}:`);
    console.error(result.body.slice(0, 1500));
    console.error('\n→ Manual paste required. Open:');
    console.error(`   https://supabase.com/dashboard/project/${projectRef}/auth/templates`);
    console.error('   Then follow db/supabase/email-templates/README.md.');
    process.exit(1);
  }
  console.info(`\n✓ Subject lines updated (${result.status}).`);
  console.info('\n→ HTML bodies still need a manual paste:');
  console.info(`   https://supabase.com/dashboard/project/${projectRef}/auth/templates`);
  console.info(
    '   (Supabase shared mailer blocks marketing-style HTML — known Supabase limitation.)',
  );
  console.info(
    '\nSubject line changes alone are enough to verify the API path works and the email arrives with the new subject.',
  );
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
