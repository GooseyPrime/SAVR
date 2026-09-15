/**
 * Mailjet transactional send for sentinel alerts.
 *
 * Credentials come from MAILJET_API_KEY / MAILJET_SECRET_KEY, which Mailjet
 * authenticates as HTTP basic. The send is best-effort: an alert that cannot
 * be delivered must not take the cron route down, because the keep-alive is
 * the more important half of the job.
 */

export interface MailjetConfig {
  readonly apiKey: string;
  readonly secretKey: string;
  readonly fromEmail: string;
  readonly fromName: string;
  readonly toEmail: string;
}

export function readMailjetConfig(env: Readonly<Record<string, string | undefined>>): MailjetConfig | null {
  const apiKey = env['MAILJET_API_KEY'];
  const secretKey = env['MAILJET_SECRET_KEY'];
  const fromEmail = env['MAILJET_FROM_EMAIL'];
  const toEmail = env['SENTINEL_ALERT_EMAIL'];

  if (!apiKey || !secretKey || !fromEmail || !toEmail) return null;

  return {
    apiKey,
    secretKey,
    fromEmail,
    fromName: env['MAILJET_FROM_NAME'] ?? 'Supabase sentinel',
    toEmail,
  };
}

export async function sendMailjetAlert(
  config: MailjetConfig,
  subject: string,
  body: string,
): Promise<void> {
  const credentials = Buffer.from(`${config.apiKey}:${config.secretKey}`).toString('base64');

  const response = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Messages: [
        {
          From: { Email: config.fromEmail, Name: config.fromName },
          To: [{ Email: config.toEmail }],
          Subject: subject,
          TextPart: body,
        },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`Mailjet responded ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
}
