import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAuthorised, readSentinelEnv } from '../../../../lib/sentinel/env';
import { runSentinel, type SentinelDeps } from '../../../../lib/sentinel/run';
import { readMailjetConfig, sendMailjetAlert } from '../../../../lib/sentinel/mailjet';

import { HEARTBEAT_TABLE } from '../../../../lib/sentinel/constants';
import type { CapacitySnapshot } from '../../../../lib/sentinel/thresholds';

/**
 * Best-effort alert for a deployment that can never succeed at keep-alive,
 * regardless of who is calling. A missing required env var (CRON_SECRET,
 * SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL) means the daily
 * heartbeat can NEVER land, silently, until the Supabase free-plan project
 * is auto-paused for inactivity — which then breaks every route that touches
 * Supabase (including the Stripe webhook handler) with no warning beforehand.
 *
 * Previously this failure mode produced zero logs and zero alerts: the route
 * returned 401/500 to Vercel's own cron invocation and nothing else happened.
 * That silence is what let a misconfigured deployment run undetected for
 * days. This always logs, and alerts when Mailjet is configured.
 */
async function reportMisconfiguration(missing: readonly string[]): Promise<void> {
  const message = `[sentinel] misconfigured — missing required env var(s): ${missing.join(', ')}. ` +
    'The Supabase keep-alive cannot run until these are set in the hosting project, which risks ' +
    'the Supabase free-plan project being auto-paused for inactivity.';
  console.error(message);

  const mailjet = readMailjetConfig(process.env);
  if (mailjet === null) return;

  try {
    await sendMailjetAlert(
      mailjet,
      '[SAVR] Supabase sentinel misconfigured — keep-alive is not running',
      message,
    );
  } catch (error) {
    console.error('[sentinel] failed to send misconfiguration alert:', (error as Error).message);
  }
}


export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/** Three touches spread over the run, matching "a few user requests each day". */
const PINGS = 3;
const PING_GAP_MS = 1_500;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function GET(request: Request): Promise<NextResponse> {
  const result = readSentinelEnv(process.env);

  if (!result.ok) {
    // Missing config means the sentinel can never succeed for ANY caller —
    // that is worth logging and alerting on immediately, before the
    // unauthenticated-caller check below (which exists to avoid revealing
    // configuration state to a random, unauthenticated request).
    await reportMisconfiguration(result.missing);

    // Never reveal configuration state to an unauthenticated caller.
    if (!isAuthorised(request.headers.get('authorization'), process.env.CRON_SECRET ?? null)) {
      return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
    }
    return NextResponse.json(
      { error: `missing configuration: ${result.missing.join(', ')}` },
      { status: 500 },
    );
  }

  const config = result.env;
  if (!isAuthorised(request.headers.get('authorization'), config.cronSecret)) {
    // Env is present but the caller's secret didn't match. Log (without the
    // secret) so a rotated/wrong CRON_SECRET is visible in Vercel logs
    // instead of failing completely silently.
    console.error('[sentinel] unauthorised cron invocation — Authorization header did not match CRON_SECRET');
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const admin = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false },
  });

  const mailjet = readMailjetConfig(process.env);

  const deps: SentinelDeps = {
    readStatus: async (): Promise<CapacitySnapshot> => {
      const { data, error } = await admin.rpc('sentinel_status');
      if (error) throw new Error(error.message);
      const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
      if (!row) throw new Error('sentinel_status returned no row');
      return {
        databaseBytes: toNumber(row.database_bytes),
        storageBytes: toNumber(row.storage_bytes),
        monthlyActiveUsers: toNumber(row.monthly_active_users),
        lastPingAt: typeof row.last_ping_at === 'string' ? row.last_ping_at : null,
      };
    },
    touch: async (): Promise<string | null> => {
      const { data, error } = await admin.rpc('sentinel_touch');
      if (!error) return typeof data === 'string' ? data : null;
      const fallback = await admin
        .from(HEARTBEAT_TABLE)
        .update({ last_ping_at: new Date().toISOString() })
        .eq('id', 1);
      if (fallback.error) throw new Error(`${error.message}; fallback: ${fallback.error.message}`);
      return null;
    },
    publicRead:
      config.anonKey === null
        ? null
        : async (): Promise<void> => {
            const response = await fetch(
              `${config.supabaseUrl}/rest/v1/${HEARTBEAT_TABLE}?select=last_ping_at&limit=1`,
              {
                headers: {
                  apikey: config.anonKey as string,
                  Authorization: `Bearer ${config.anonKey as string}`,
                },
                cache: 'no-store',
                signal: AbortSignal.timeout(15_000),
              },
            );
            if (!response.ok) throw new Error(`REST read returned ${response.status}`);
            await response.arrayBuffer();
          },
    sendAlert:
      mailjet === null
        ? null
        : async (subject: string, body: string): Promise<void> => {
            await sendMailjetAlert(mailjet, subject, body);
          },
    sleep,
    now: () => new Date(),
    pings: PINGS,
    pingGapMs: PING_GAP_MS,
    label: config.label,
  };

  const run = await runSentinel(deps);

  if (run.writes === 0) {
    console.error('[sentinel] keep-alive did not land', { errors: run.errors });
  }

  return NextResponse.json(run, { status: run.writes === 0 ? 500 : 200 });
}
