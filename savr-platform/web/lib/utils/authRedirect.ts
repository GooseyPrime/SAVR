export function getSafeRelativeRedirect(
  redirectParam: string | null | undefined,
  nextParam: string | null | undefined
): string | null {
  const isSafeRelativePath = (value: string) => {
    let decoded = value;
    for (let i = 0; i < 10; i += 1) {
      if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.slice(1).includes('\\')) {
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

    return decoded.startsWith('/') && !decoded.startsWith('//') && !decoded.slice(1).includes('\\');
  };

  if (redirectParam && isSafeRelativePath(redirectParam)) {
    return redirectParam;
  }

  if (nextParam && isSafeRelativePath(nextParam)) {
    return nextParam;
  }

  return null;
}
