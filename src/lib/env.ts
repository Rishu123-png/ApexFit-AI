import 'server-only';

/**
 * Server env validation (spec §11): callers get actionable errors that name
 * ONLY variable names — values are never logged, echoed, or sent to clients.
 */
export function listMissingEnv(names: readonly string[]): string[] {
  return names.filter((n) => !process.env[n] || process.env[n]!.trim() === '');
}

export function requireServerEnv(names: readonly string[], feature: string): void {
  const missing = listMissingEnv(names);
  if (missing.length > 0) {
    throw new Error(`${feature} is not configured on the server (missing: ${missing.join(', ')}).`);
  }
}
