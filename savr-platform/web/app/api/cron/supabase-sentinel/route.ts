import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAuthorised, readSentinelEnv } from '../../../../lib/sentinel/env';
import { runSentinel, type SentinelDeps } from '../../../../lib/sentinel/run';
import { readMailjetConfig, sendMailjetAlert } from '../../../../lib/sentinel/mailjet';
import { HEARTBEAT_TABLE } from '../../../../lib/sentinel/constants';
import type { CapacitySnapshot } from '../../../../lib/sentinel/thresholds';

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
