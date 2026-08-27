// URL-stripped whitespace characters (tab, CR, LF, form-feed, vertical-tab) that browsers
// silently remove before navigation, enabling bypasses like /%09/evil.com → //evil.com.
const STRIPPED_WHITESPACE = /[\t\r\n\f\v]/;

export function getSafeRelativeRedirect(
  redirectParam: string | null | undefined,
  nextParam: string | null | undefined
): string | null {
  const isSafeRelativePath = (value: string) => {
    let decoded = value;
    for (let i = 0; i < 10; i += 1) {
      if (
        !decoded.startsWith('/') ||
        decoded.startsWith('//') ||
        decoded.slice(1).includes('\\') ||
        STRIPPED_WHITESPACE.test(decoded)
      ) {
        return false;
      }

      try {
        const nextDecoded = decodeURIComponent(decoded);
        if (nextDecoded === decoded) {
          break;
        }
        decoded = nextDecoded;
      } catch {
        break;
      }
    }

    return (
      decoded.startsWith('/') &&
      !decoded.startsWith('//') &&
      !decoded.slice(1).includes('\\') &&
      !STRIPPED_WHITESPACE.test(decoded)
    );
  };

  if (redirectParam && isSafeRelativePath(redirectParam)) {
    return redirectParam;
  }

  if (nextParam && isSafeRelativePath(nextParam)) {
    return nextParam;
  }

  return null;
}
