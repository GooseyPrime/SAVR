export function getSafeRelativeRedirect(
  redirectParam: string | null | undefined,
  nextParam: string | null | undefined
): string | null {
  const isSafeRelativePath = (value: string) =>
    value.startsWith('/') && !value.startsWith('//');

  if (redirectParam && isSafeRelativePath(redirectParam)) {
    return redirectParam;
  }

  if (nextParam && isSafeRelativePath(nextParam)) {
    return nextParam;
  }

  return null;
}
