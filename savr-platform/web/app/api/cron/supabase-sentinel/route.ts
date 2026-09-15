import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  evaluateSnapshot,
  renderReport,
  summarise,
  worstSeverity,
  type CapacitySnapshot,
} from '../../../../lib/sentinel/thresholds';
import { readMailjetConfig, sendMailjetAlert } from '../../../../lib/sentinel/mailjet';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/** Three touches spread over the run, matching "a few user requests each day". */
const PINGS = 3;
const PING_GAP_MS = 1_500;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function unauthorised(): NextResponse {
  return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
}

/**
 * Vercel signs scheduled invocations with CRON_SECRET. The same header lets the
 * route be triggered by hand for a smoke test without opening it to the world.
 */
function isAuthorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorised(request)) return unauthorised();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required' },
      { status: 500 },
    );
  }

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const errors: string[] = [];
  let writes = 0;
  let reads = 0;

  // Keep-alive. Every iteration is a real query against the project database,
  // which is the signal Supabase measures when deciding what to pause.
  for (let index = 0; index < PINGS; index += 1) {
    const { error: writeError } = await admin.rpc('sentinel_touch');
    if (writeError) {
      const { error: fallbackError } = await admin
        .from('sentinel_heartbeat')
        .update({ last_ping_at: new Date().toISOString() })
        .eq('id', 1);
      if (fallbackError) errors.push(`write ping failed: ${fallbackError.message}`);
      else writes += 1;
    } else {
      writes += 1;
    }

    if (anonKey) {
      try {
        const response = await fetch(
          `${url}/rest/v1/sentinel_heartbeat?select=last_ping_at&limit=1`,
          {
            headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
            cache: 'no-store',
            signal: AbortSignal.timeout(15_000),
          },
        );
        if (!response.ok) errors.push(`public read ping returned ${response.status}`);
        else reads += 1;
      } catch (error) {
        errors.push(`public read ping failed: ${(error as Error).message}`);
      }
    }

    if (index < PINGS - 1) await sleep(PING_GAP_MS);
  }

  // Capacity check.
  let snapshot: CapacitySnapshot = {
    databaseBytes: null,
    storageBytes: null,
    monthlyActiveUsers: null,
    lastPingAt: null,
  };

  const { data, error: statusError } = await admin.rpc('sentinel_status');
  if (statusError) {
    errors.push(`capacity probe failed: ${statusError.message}`);
  } else {
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      snapshot = {
        databaseBytes: Number(row.database_bytes ?? NaN) || null,
        storageBytes: Number(row.storage_bytes ?? NaN) || null,
        monthlyActiveUsers: Number(row.monthly_active_users ?? NaN) || 0,
        lastPingAt: typeof row.last_ping_at === 'string' ? row.last_ping_at : null,
      };
    }
  }

  const findings = evaluateSnapshot(snapshot);
  const severity = worstSeverity(findings.map((finding) => finding.severity));
  const label = process.env.SENTINEL_PROJECT_LABEL ?? 'SAVR';
  const report = renderReport(label, snapshot, findings);

  if (severity !== 'ok') {
    const mailjet = readMailjetConfig(process.env);
    if (mailjet === null) {
      errors.push('alert not emailed: Mailjet environment variables are not set');
    } else {
      try {
        await sendMailjetAlert(mailjet, summarise(label, findings), report);
      } catch (error) {
        errors.push(`alert email failed: ${(error as Error).message}`);
      }
    }
  }

  if (writes === 0) {
    console.error('[sentinel] keep-alive did not land', { errors });
  }

  return NextResponse.json(
    {
      severity,
      writes,
      reads,
      snapshot,
      findings,
      errors,
      checkedAt: new Date().toISOString(),
    },
    { status: writes === 0 ? 500 : 200 },
  );
}
