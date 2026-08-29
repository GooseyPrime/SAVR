/**
 * Server-only credential environment reader.
 *
 * Motivation
 * ----------
 * Secrets pasted into a hosting dashboard routinely arrive with a trailing
 * newline (a Windows CRLF is the common case). Node refuses to place a
 * control character inside an HTTP header value, so any credential used as a
 * bearer token fails at the transport layer with:
 *
 *   TypeError: Invalid character in header content ["Authorization"]
 *   code: 'ERR_INVALID_CHAR'
 *
 * SDKs surface that as an opaque connectivity error ("An error occurred with
 * our connection to Stripe"), which reads as an outage rather than as a
 * configuration defect, and no amount of call-site error handling can fix it.
 *
 * This module makes that class of defect impossible to misread:
 *  - surrounding ASCII whitespace is stripped (an unambiguous paste artifact)
 *  - anything still outside printable ASCII is rejected loudly, naming the
 *    variable, the 1-based offset, and the offending code point
 *  - values wrapped in matching quotes are rejected rather than silently
 *    unwrapped, because that is a genuine configuration mistake
 *
 * No credential value is ever included in an error message or diagnostic.
 */

/** Raised when a credential environment variable is present but unusable. */
export class CredentialFormatError extends Error {
  readonly variableName: string;

  constructor(variableName: string, detail: string) {
    super(`${variableName} is misconfigured: ${detail}`);
    this.name = 'CredentialFormatError';
    this.variableName = variableName;
  }
}

/** Raised when a credential environment variable is absent or blank. */
export class CredentialMissingError extends Error {
  readonly variableName: string;

  constructor(variableName: string) {
    super(
      `${variableName} is not configured. Set this environment variable in the hosting project settings.`,
    );
    this.name = 'CredentialMissingError';
    this.variableName = variableName;
  }
}

/** Characters accepted inside a credential: printable ASCII, no space. */
const PRINTABLE_ASCII = /^[\x21-\x7e]+$/;

/** Whitespace (including a byte-order mark) a paste can introduce. */
const SURROUNDING_WHITESPACE = /^[\s﻿]+|[\s﻿]+$/g;

function describeCodePoint(code: number): string {
  switch (code) {
    case 0x0a:
      return 'a line feed (\\n)';
    case 0x0d:
      return 'a carriage return (\\r)';
    case 0x09:
      return 'a tab (\\t)';
    case 0x20:
      return 'a space';
    case 0xfeff:
      return 'a byte-order mark';
    default:
      return `character U+${code.toString(16).toUpperCase().padStart(4, '0')}`;
  }
}

/**
 * Normalise a raw credential value.
 *
 * Returns the cleaned value, or throws when the value cannot be used.
 * Exported for tests and for the configuration diagnostics endpoint.
 */
export function normalizeCredential(variableName: string, raw: string | undefined): string {
  if (raw === undefined || raw === null) {
    throw new CredentialMissingError(variableName);
  }

  const value = raw.replace(SURROUNDING_WHITESPACE, '');

  if (value.length === 0) {
    throw new CredentialMissingError(variableName);
  }

  if (
    value.length >= 2 &&
    (value.startsWith('"') || value.startsWith("'")) &&
    value.endsWith(value[0])
  ) {
    throw new CredentialFormatError(
      variableName,
      'the value is wrapped in quotation marks. Store the credential without surrounding quotes.',
    );
  }

  if (!PRINTABLE_ASCII.test(value)) {
    const chars = [...value];
    const index = chars.findIndex((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code < 0x21 || code > 0x7e;
    });
    const code = chars[index]?.codePointAt(0) ?? 0;
    throw new CredentialFormatError(
      variableName,
      `it contains ${describeCodePoint(code)} at position ${index + 1} of ${chars.length}. ` +
        'Re-enter the value with no embedded whitespace or line breaks.',
    );
  }

  return value;
}

/**
 * Read and validate a credential from the process environment.
 *
 * @throws {CredentialMissingError} when the variable is absent or blank
 * @throws {CredentialFormatError} when the variable cannot be used as-is
 */
export function readCredentialEnv(variableName: string): string {
  return normalizeCredential(variableName, process.env[variableName]);
}

/** Non-sensitive description of one credential variable's health. */
export interface CredentialHygiene {
  variable: string;
  present: boolean;
  usable: boolean;
  /** True when surrounding whitespace had to be removed before use. */
  hadSurroundingWhitespace: boolean;
  /** Length of the usable value, or 0. Never the value itself. */
  length: number;
  /** Populated only when the value is unusable. Never contains the value. */
  problem?: string;
}

/**
 * Inspect one credential variable without revealing its value.
 *
 * Safe to return to an authenticated operator: reports only presence,
 * usability, length, and a human-readable problem description.
 */
export function inspectCredentialEnv(variableName: string): CredentialHygiene {
  const raw = process.env[variableName];
  const present = typeof raw === 'string' && raw.length > 0;
  const hadSurroundingWhitespace =
    present && raw !== raw.replace(SURROUNDING_WHITESPACE, '');

  try {
    const value = normalizeCredential(variableName, raw);
    return {
      variable: variableName,
      present: true,
      usable: true,
      hadSurroundingWhitespace,
      length: value.length,
    };
  } catch (error) {
    return {
      variable: variableName,
      present,
      usable: false,
      hadSurroundingWhitespace,
      length: 0,
      problem: error instanceof Error ? error.message : 'Unknown configuration error',
    };
  }
}
