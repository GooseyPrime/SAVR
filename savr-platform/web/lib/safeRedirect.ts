/** Allow only in-app relative paths so auth redirects cannot leave SAVR. */
export function safeAppPath(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (!raw) return fallback;
  const path = raw.trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    return fallback;
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) {
    return fallback;
  }
  return path;
}
