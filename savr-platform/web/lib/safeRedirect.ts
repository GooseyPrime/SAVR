/** Allow only in-app relative paths so auth redirects cannot leave SAVR. */
import { getSafeRelativeRedirect } from './utils/authRedirect';

export function safeAppPath(raw: string | null | undefined, fallback = '/dashboard'): string {
  return getSafeRelativeRedirect(raw, null) ?? fallback;
}
