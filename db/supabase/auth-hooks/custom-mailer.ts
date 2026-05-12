/**
 * Custom Mailer Hook — Supabase Auth Hooks (GA 2025).
 *
 * This source is intended for deployment as a Supabase Edge Function
 * named `custom-mailer`, then registered as the project's custom
 * mailer hook via the dashboard (Authentication → Hooks → Custom
 * Mailer Hook) or the Management API.
 *
 * What it does:
 *   1. Receives the auth event from Supabase with the standard payload
 *      shape: { user, email_data: { token, redirect_to, email_action_type } }.
 *   2. Reads the user's preferred locale from
 *      user.user_metadata.preferred_locale (set during signup). Falls
 *      back to 'en' when missing.
 *   3. Loads the matching bilingual template from
 *      db/supabase/email-templates/<action>.<locale>.html.
 *   4. Substitutes the templated values (token, redirect URL).
 *   5. Returns the rendered email body to Supabase, which sends it.
 *
 * Module 9.10 — the source lives here for review + version control,
 * but the deployment step (push to Supabase Edge Functions runtime +
 * register as hook) is documented as a manual operator step in
 * docs/runbook.md because the Supabase CLI authentication for that
 * action is owner-only, not service-role.
 */

// Deno runtime types — minimal local declarations so this source
// type-checks under the Node-only tsconfig used by the rest of the
// repo. In the Supabase Edge runtime these would be globals.
declare const Deno: { serve: (handler: (req: Request) => Response | Promise<Response>) => void };

type EmailActionType =
  | 'signup'
  | 'magiclink'
  | 'recovery'
  | 'invite'
  | 'email_change'
  | 'email_change_new';

interface CustomMailerPayload {
  user: {
    id: string;
    email: string;
    user_metadata?: { preferred_locale?: 'en' | 'ar'; full_name?: string };
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: EmailActionType;
    site_url: string;
  };
}

const ACTION_TO_TEMPLATE_FILE: Record<EmailActionType, string> = {
  signup: 'confirm-signup',
  magiclink: 'magic-link',
  recovery: 'recovery',
  invite: 'invite',
  email_change: 'email-change',
  email_change_new: 'email-change',
};

/** Naive {{key}} substitution. Safe because templates are operator-
 *  controlled assets in the repo, not user-supplied. */
function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w_]+)\s*\}\}/g, (_, key: string) => vars[key] ?? '');
}

async function loadTemplate(action: EmailActionType, locale: 'en' | 'ar'): Promise<string> {
  const file = ACTION_TO_TEMPLATE_FILE[action];
  const url = new URL(`./templates/${file}.${locale}.html`, import.meta.url);
  return await (await fetch(url)).text();
}

export async function handler(req: Request): Promise<Response> {
  let payload: CustomMailerPayload;
  try {
    payload = (await req.json()) as CustomMailerPayload;
  } catch {
    return new Response(JSON.stringify({ error: 'bad_payload' }), { status: 400 });
  }
  const locale: 'en' | 'ar' = payload.user.user_metadata?.preferred_locale === 'ar' ? 'ar' : 'en';
  const action = payload.email_data.email_action_type;

  let body: string;
  try {
    const tpl = await loadTemplate(action, locale);
    body = render(tpl, {
      confirmation_url: `${payload.email_data.site_url}/auth/callback?token_hash=${payload.email_data.token_hash}&type=${action}&next=${encodeURIComponent(payload.email_data.redirect_to)}`,
      token: payload.email_data.token,
      email: payload.user.email,
      full_name: payload.user.user_metadata?.full_name ?? '',
      site_url: payload.email_data.site_url,
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: 'template_load_failed',
        detail: e instanceof Error ? e.message : 'unknown',
      }),
      { status: 500 },
    );
  }

  return new Response(JSON.stringify({ body, subject: subjectFor(action, locale) }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function subjectFor(action: EmailActionType, locale: 'en' | 'ar'): string {
  const SUBJECTS: Record<'en' | 'ar', Record<EmailActionType, string>> = {
    en: {
      signup: 'Confirm your BlueCare account',
      magiclink: 'Your BlueCare sign-in link',
      recovery: 'Reset your BlueCare password',
      invite: 'You have been invited to BlueCare',
      email_change: 'Confirm your new email',
      email_change_new: 'Your new BlueCare email',
    },
    ar: {
      signup: 'تأكيد حساب BlueCare',
      magiclink: 'رابط تسجيل الدخول إلى BlueCare',
      recovery: 'إعادة تعيين كلمة المرور في BlueCare',
      invite: 'لقد تمّت دعوتك إلى BlueCare',
      email_change: 'تأكيد البريد الجديد',
      email_change_new: 'بريدك الجديد في BlueCare',
    },
  };
  return SUBJECTS[locale][action];
}

// Edge runtime entrypoint. When deployed to Supabase, Deno.serve is
// the convention. The Node-only typecheck used by the rest of the
// repo declares a stub Deno above so this line doesn't break.
if (typeof Deno !== 'undefined') Deno.serve(handler);
