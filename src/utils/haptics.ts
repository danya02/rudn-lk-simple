/**
 * Haptic feedback.
 *
 * The phone is held up at a door, pointed at a QR code, while the user is
 * usually looking at the wall rather than the screen. A buzz is the only
 * feedback channel that works in that posture, so the patterns here carry
 * actual meaning and are not decoration.
 *
 * Patterns are defined once, in one place, so that "one buzz" means the same
 * thing everywhere in the app. A scanner and a check-in that disagreed about
 * what a double buzz meant would be worse than no haptics at all.
 *
 * Everything is best-effort. `navigator.vibrate` is absent on desktop, is a
 * no-op on iOS, and is gated behind user activation in Chrome, so a silent
 * failure is the normal case rather than an error worth reporting.
 *
 * Note on fidelity: the W3C Vibration API exposes duration only. Android's
 * richer tap-versus-alarm haptics come from VibrationEffect primitives, which
 * are not reachable from a WebView, and cordova-plugin-vibration is a shim over
 * this same API rather than a way around it. So these are buzz lengths, not
 * system haptic classes.
 */

/** A single short tap: something new happened. */
const FRESH = [30];

/** Two taps: recognised, but nothing new to save. */
const KNOWN = [25, 40, 25];

/** One longer buzz: the server accepted a check-in. */
const ACCEPTED = [80];

/** A short low double-tap: the server answered, but declined. */
const REFUSED = [20, 60, 20];

function buzz(pattern: number[]) {
  // Feature-detected per call rather than once at module load: it costs
  // nothing, and keeps this safe to import from anywhere, including SSR.
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Best-effort by design; a failed buzz must never disturb the caller.
  }
}

/** A QR code that is new to this session and not already saved. */
export function buzzFresh() {
  buzz(FRESH);
}

/** A QR code that is new to this session but already known locally. */
export function buzzKnown() {
  buzz(KNOWN);
}

/** A check-in the server accepted. */
export function buzzAccepted() {
  buzz(ACCEPTED);
}

/**
 * A check-in the server declined.
 *
 * Distinct from an accepted one because a bulk check-in walks every saved room
 * and most of them have no lesson right now, so the two outcomes arrive
 * interleaved and must be tellable apart without looking.
 */
export function buzzRefused() {
  buzz(REFUSED);
}
