# Supabase sentinel

Two problems, one scheduled job:

1. **The project must not be paused.** Supabase pauses a Free plan project when
   it sees too little *user database activity* over a rolling 7-day window. The
   cron route writes to and reads from `public.sentinel_heartbeat` once a day —
   three writes through the service role and three reads through the public
   REST API — which is the activity Supabase measures.
2. **The free allowance must not run out without warning.** The same run reads
   `public.sentinel_status()` and compares database size, Storage size and
   monthly active users against the Free plan limits. Crossing 70% sends a
   warning email; crossing 85% sends an action-required email.

## Moving parts

| Piece | Path |
| --- | --- |
| Migration (heartbeat table, `sentinel_touch`, `sentinel_status`) | `supabase/migrations/20260915120000_sentinel_keepalive.sql` |
| Scheduled route | `web/app/api/cron/supabase-sentinel/route.ts` |
| Threshold rules (pure, unit tested) | `web/lib/sentinel/thresholds.ts` |
| Mailjet delivery | `web/lib/sentinel/mailjet.ts` |
| Schedule | `web/vercel.json` — `0 12 * * *` (08:00 America/New_York) |

## Environment

Already present in the Vercel project:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

New, to be added in Vercel → Settings → Environment Variables (Production):

| Variable | Purpose |
| --- | --- |
| `CRON_SECRET` | Vercel sends it as `Authorization: Bearer …` on scheduled runs; the route refuses anything else. Any long random string. |
| `MAILJET_API_KEY` | Mailjet API key |
| `MAILJET_SECRET_KEY` | Mailjet secret key |
| `MAILJET_FROM_EMAIL` | Verified Mailjet sender |
| `SENTINEL_ALERT_EMAIL` | Where alerts go |
| `MAILJET_FROM_NAME` | Optional sender name |
| `SENTINEL_PROJECT_LABEL` | Optional label in the subject line, defaults to `SAVR` |

## Free plan allowances being watched

| Allowance | Free limit | Scope |
| --- | --- | --- |
| Database size | 500 MB | per project |
| Storage size | 1 GB | per organization |
| Monthly active users | 50,000 | per organization |
| Egress | 5 GB uncached + 5 GB cached | per organization — not exposed by the API, so the report links to the dashboard |
| Active projects | 2 | per Supabase account, counted across every organization you own |

## Running it by hand

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://savr.cam/api/cron/supabase-sentinel
```

The response carries the severity, the number of pings that landed, the
capacity snapshot and any findings. A run where no ping landed returns HTTP 500
so it shows up as a failure in the Vercel cron log.

## Removing it

Drop the cron entry from `web/vercel.json`, delete the route, and in the
database:

```sql
drop function if exists public.sentinel_status();
drop function if exists public.sentinel_touch();
drop table if exists public.sentinel_heartbeat;
```
