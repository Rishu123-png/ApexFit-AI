export type ClassValue = string | undefined | null | false;

/** Tiny className joiner (avoids a runtime dependency). */
export function clsx(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
