/**
 * Single entry point for every RUDN HTTP call.
 *
 * These endpoints are reverse-engineered from the official app and are not
 * documented or versioned by the university. They can change shape without
 * notice, so all of them are funnelled through here: when something breaks,
 * this file and the modules beside it are the only places to look.
 *
 * Every failure here is also recorded to the diagnostics buffer, so a user can
 * report what the server actually said without needing a console.
 */

import { recordEvent } from 'src/utils/diagnostics';

export const Hosts = {
  /** Identity / SSO. Issues the ephemeral and real id tokens. */
  Id: 'https://id-api.rudn.ru/api/v1',
  /** Main mobile app backend. Consumes the lk token. */
  MobApp: 'https://mobapp-api.rudn.ru',
  /** Lecture-room and schedule service. Unauthenticated. */
  Qr: 'https://api-qr.rudn.ru/api/v1',
} as const;

/** OAuth client id of the official mobile app, as sent by it. */
export const OAUTH_CLIENT_ID = 'b0db4756-9468-4a9e-b399-17b546b6ea88';

/** The server answered, but with a non-2xx status. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly body: string | null = null,
  ) {
    super(`HTTP ${status} ${statusText}`);
    this.name = 'ApiError';
  }
}

/** The request never produced a response: offline, DNS failure, TLS error. */
export class NetworkError extends Error {
  constructor(override readonly cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'NetworkError';
  }
}

/** True when the failure means "you are offline" rather than "you are logged out". */
export function isNetworkError(e: unknown): e is NetworkError {
  return e instanceof NetworkError;
}

/** Status of an ApiError, or null for anything else. Lets call sites branch on 401/404. */
export function statusOf(e: unknown): number | null {
  return e instanceof ApiError ? e.status : null;
}

/** Human-readable text for any thrown value, without leaking `any` into call sites. */
export function errorMessage(e: unknown): string {
  if (e instanceof NetworkError) return 'Could not reach the server. You may be offline.';
  if (e instanceof ApiError) return `Server error ${e.status} ${e.statusText}`;
  if (e instanceof Error) return e.message;
  return String(e);
}

/**
 * Strip the query string before an URL reaches the diagnostics buffer.
 *
 * The OAuth calls carry codes and tokens as query parameters, and that report
 * is meant to be pasteable into a chat. The path alone identifies the endpoint.
 */
function redactUrl(url: string): string {
  const queryStart = url.indexOf('?');
  return queryStart === -1 ? url : url.slice(0, queryStart) + '?<redacted>';
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  /**
   * Bearer token. The literal string 'null' is meaningful to the token-rudn-id
   * endpoint, which requires `Authorization: Bearer null` -- do not "fix" that.
   */
  token?: string | null;
  body?: unknown;
  /** Skip the Content-Type header. A few GETs on api-qr send none. */
  noContentType?: boolean;
}

/**
 * Perform a request and parse the JSON body.
 *
 * Throws NetworkError if the request never completed, ApiError for any non-2xx.
 * Returns the parsed body cast to T -- there is no runtime validation yet, so
 * T is a promise about the shape, not a guarantee.
 */
export async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', token, body, noContentType = false } = options;

  const headers: Record<string, string> = {};
  if (!noContentType) headers['Content-Type'] = 'application/json';
  if (token !== undefined) headers['Authorization'] = 'Bearer ' + token;

  let resp: Response;
  try {
    resp = await fetch(url, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (ex) {
    recordEvent('http', `${method} ${redactUrl(url)} -> network failure: ${String(ex)}`);
    throw new NetworkError(ex);
  }

  if (!resp.ok) {
    let text: string | null = null;
    try {
      text = await resp.text();
    } catch {
      // Body unreadable; the status alone is enough to act on.
    }
    // The body is the most valuable thing in a bug report: when the API changes
    // shape, its text is the only evidence of how.
    recordEvent(
      'http',
      `${method} ${redactUrl(url)} -> ${resp.status} ${resp.statusText}${text ? ': ' + text : ''}`,
    );
    throw new ApiError(resp.status, resp.statusText, text);
  }

  return (await resp.json()) as T;
}
