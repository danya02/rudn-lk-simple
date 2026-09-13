/**
 * In-app diagnostics.
 *
 * This app runs on students' phones, where there is no console to read and no
 * debugger to attach. When something goes wrong the only channel back to the
 * developer is the user describing it, and "it didn't work" is not actionable.
 *
 * So two things live here:
 *
 *  - a small ring buffer of recent events, and
 *  - `buildDiagnostics()`, which renders it plus the device/build/auth state
 *    into one pasteable block of text.
 *
 * The buffer is deliberately fed from chokepoints rather than from call sites.
 * Every HTTP request goes through `request()` in src/api/client.ts and every
 * user-facing failure goes through `notifyError()` in src/utils/notify.ts, so
 * recording in those two functions captures everything without each call site
 * having to remember to opt in -- including code written later.
 *
 * Nothing here is persisted. The buffer is for the session in which the problem
 * happened, and losing it on restart is fine: a restart usually clears the
 * problem too.
 */

import { Device, IdRudnRu, LkRudnRu } from 'src/consts/store-consts';

/** Kept small: enough to cover one failed auth ladder run, not a session log. */
const MAX_EVENTS = 40;

/** Longest response body stored per event, so one HTML error page cannot evict the buffer. */
const MAX_BODY_CHARS = 500;

export type EventKind = 'http' | 'error' | 'auth' | 'info';

interface DiagnosticEvent {
  /** ms since page load. Relative, so no clock skew and no timezone to leak. */
  at: number;
  kind: EventKind;
  message: string;
}

const events: DiagnosticEvent[] = [];
const startedAt = Date.now();

/**
 * Append an event, dropping the oldest once full.
 *
 * Called from hot paths including failed requests, so it must never throw:
 * a diagnostics bug taking down the feature it is diagnosing would be absurd.
 */
export function recordEvent(kind: EventKind, message: string) {
  try {
    events.push({ at: Date.now() - startedAt, kind, message: truncate(message) });
    if (events.length > MAX_EVENTS) events.shift();
  } catch {
    // Diagnostics are best-effort and must not affect app behaviour.
  }
}

function truncate(text: string): string {
  return text.length > MAX_BODY_CHARS ? text.slice(0, MAX_BODY_CHARS) + '…(truncated)' : text;
}

/** Drop every recorded event. Used by the reset flow so a fresh start really is one. */
export function clearEvents() {
  events.length = 0;
}

/**
 * Describe a stored token without disclosing it.
 *
 * The diagnostics report is meant to be pasted into a chat, and the debug panel
 * is readable by anyone holding the unlocked phone, so no token or credential
 * may appear in full. Length and a short prefix are enough to tell "missing"
 * from "present" from "truncated", which is all a report needs.
 */
function describeToken(key: string): string {
  const value = localStorage.getItem(key);
  if (value === null) return 'absent';
  if (value === '') return 'present but empty';
  if (value === 'null') return "literal 'null'";
  return `${value.length} chars, starts ${value.slice(0, 6)}…`;
}

function describeAge(key: string): string {
  const raw = localStorage.getItem(key);
  if (raw === null) return 'unknown';
  const then = Number(raw);
  if (!Number.isFinite(then)) return `unparseable (${raw})`;
  const minutes = Math.round((Date.now() - then) / 60000);
  return `${minutes} min ago`;
}

interface PluginWindow {
  cordova?: { plugins?: Record<string, unknown>; platformId?: string };
  plugins?: Record<string, unknown>;
  // `lock` is missing from the DOM lib's ScreenOrientation at this TS version,
  // and it is what the screen-orientation plugin adds, so declare it here.
  screen?: { orientation?: { lock?: unknown } };
}

/**
 * Which native plugins actually loaded.
 *
 * Worth reporting because a plugin can be declared in config and still be
 * absent at runtime -- exactly the failure that made the camera permission flow
 * silently do nothing. "declared" and "present" are different facts.
 */
function describePlugins(): string {
  const w = window as unknown as PluginWindow;
  if (!w.cordova) return '  not running under Cordova';

  const cordovaPlugins = w.cordova.plugins ?? {};
  const globalPlugins = w.plugins ?? {};
  const checks: Record<string, boolean> = {
    diagnostic: 'diagnostic' in cordovaPlugins,
    brightness: 'brightness' in cordovaPlugins,
    // cordova-plugin-insomnia installs at window.plugins, not window.cordova.plugins.
    insomnia: 'insomnia' in globalPlugins || 'insomnia' in cordovaPlugins,
    screenOrientation: typeof w.screen?.orientation?.lock === 'function',
  };

  return Object.entries(checks)
    .map(([name, ok]) => `  ${name}: ${ok ? 'present' : 'MISSING'}`)
    .join('\n');
}

function countSavedRooms(): string {
  const raw = localStorage.getItem(LkRudnRu.CheckInRooms);
  if (raw === null) return '0 (none saved)';
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? String(parsed.length) : `not an array (${typeof parsed})`;
  } catch {
    return 'unparseable JSON';
  }
}

/**
 * Render the full report.
 *
 * Plain text rather than JSON: it is going into a chat message, and a human
 * reads it before any program does.
 */
export function buildDiagnostics(): string {
  const platform = (window as unknown as PluginWindow).cordova
    ? `Cordova (${(window as unknown as PluginWindow).cordova?.platformId ?? 'unknown platform'})`
    : 'Browser / PWA';

  const lines = [
    '--- RUDN Simple diagnostics ---',
    `App version: ${process.env.APP_VERSION} (Android versionCode ${process.env.ANDROID_VERSION_CODE})`,
    `Platform: ${platform}`,
    `User agent: ${navigator.userAgent}`,
    `Online: ${navigator.onLine}`,
    `Session uptime: ${Math.round((Date.now() - startedAt) / 1000)} s`,
    '',
    'Auth state:',
    `  has logged in before: ${localStorage.getItem(LkRudnRu.SuccessfulAccess) !== null}`,
    `  username stored: ${localStorage.getItem(IdRudnRu.Username) !== null}`,
    `  password stored: ${localStorage.getItem(IdRudnRu.Password) !== null}`,
    `  id access token: ${describeToken(IdRudnRu.AccessToken)}`,
    `  id access token obtained: ${describeAge(IdRudnRu.AccessTokenObtainedAt)}`,
    `  id refresh token: ${describeToken(IdRudnRu.RefreshToken)}`,
    `  lk access token: ${describeToken(LkRudnRu.AccessToken)}`,
    `  selected ad_person_id: ${localStorage.getItem(IdRudnRu.SelectedAdPersonId) ?? 'none'}`,
    '',
    'Local data:',
    `  saved rooms: ${countSavedRooms()}`,
    `  cached PACS code: ${describeToken(LkRudnRu.PacsCode)}`,
    `  preferred camera: ${localStorage.getItem(Device.PreferredCameraName) ?? 'none'}`,
    `  QR max brightness: ${localStorage.getItem(Device.QrMaxBrightness) ?? 'off (default)'}`,
    '',
    'Native plugins:',
    describePlugins(),
    '',
    `Recent events (${events.length}${events.length === MAX_EVENTS ? ', oldest dropped' : ''}):`,
  ];

  if (events.length === 0) {
    lines.push('  (nothing recorded this session)');
  } else {
    for (const event of events) {
      lines.push(`  +${(event.at / 1000).toFixed(1)}s [${event.kind}] ${event.message}`);
    }
  }

  lines.push('--- end diagnostics ---');
  return lines.join('\n');
}

/**
 * Put the report on the clipboard.
 *
 * Resolves false when the clipboard is unavailable -- it needs a secure context,
 * and older Android WebViews lack it -- so the caller can fall back to showing
 * the text for manual selection rather than silently appearing to succeed.
 */
export async function copyDiagnostics(): Promise<boolean> {
  const report = buildDiagnostics();
  try {
    await navigator.clipboard.writeText(report);
    return true;
  } catch {
    return false;
  }
}
