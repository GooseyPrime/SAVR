/**
 * Environment and request checks for the sentinel route, kept out of the route
 * file so they can be unit tested without a Next.js runtime.
 */

export interface SentinelEnv {
  readonly supabaseUrl: string;
  readonly serviceRoleKey: string;
  readonly anonKey: string | null;
  readonly cronSecret: string;
  readonly label: string;
}

export type EnvResult =
  | { readonly ok: true; readonly env: SentinelEnv }
  | { readonly ok: false; readonly missing: readonly string[] };

const REQUIRED = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'CRON_SECRET'] as const;

export function readSentinelEnv(env: NodeJS.ProcessEnv): EnvResult {
  const missing = REQUIRED.filter((name) => {
    const value = env[name];
    return typeof value !== 'string' || value.trim().length === 0;
  });
  if (missing.length > 0) return { ok: false, missing };

  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return {
    ok: true,
    env: {
      supabaseUrl: (env.NEXT_PUBLIC_SUPABASE_URL as string).trim(),
      serviceRoleKey: (env.SUPABASE_SERVICE_ROLE_KEY as string).trim(),
      anonKey: typeof anon === 'string' && anon.trim().length > 0 ? anon.trim() : null,
      cronSecret: (env.CRON_SECRET as string).trim(),
      label: env.SENTINEL_PROJECT_LABEL ?? 'SAVR',
    },
  };
}

/**
 * Vercel signs scheduled invocations with CRON_SECRET. An unset secret denies
 * every request rather than opening the route, so a misconfigured deployment
 * fails closed.
 */
export function isAuthorised(authorizationHeader: string | null, secret: string | null): boolean {
  if (typeof secret !== 'string' || secret.length === 0) return false;
  if (typeof authorizationHeader !== 'string') return false;
  return authorizationHeader === `Bearer ${secret}`;
}
