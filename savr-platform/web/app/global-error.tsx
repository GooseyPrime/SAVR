'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ background: 'var(--color-background)', color: 'var(--color-foreground)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ textAlign: 'center', maxWidth: '28rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              Something went wrong
            </h2>
            <p style={{ color: 'var(--color-foreground-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              An unexpected error occurred. Please try again.
            </p>
            <button
              onClick={() => reset()}
              style={{
                background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
                color: 'var(--color-primary-foreground)',
                fontWeight: 600,
                padding: '0.75rem 1.5rem',
                borderRadius: '1px',
                border: '1px solid var(--color-primary)',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
