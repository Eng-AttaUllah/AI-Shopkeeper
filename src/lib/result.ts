/** Shared result shape for service functions and server actions. */

export type FieldErrors = Record<string, string>;

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function fail<T = never>(
  error: string,
  fieldErrors?: FieldErrors,
): Result<T> {
  return { ok: false, error, fieldErrors };
}
