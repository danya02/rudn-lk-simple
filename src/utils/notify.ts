/**
 * User-facing message helpers.
 *
 * Error messages often carry technical detail worth reporting to the developer.
 * A toast that fades after a few seconds gives you no chance to read or
 * screenshot that, which is why `notifyError` stays on screen until it is
 * explicitly dismissed. Informational messages auto-dismiss as normal.
 *
 * Everything appears at the bottom. The top of the screen is busy -- toolbar,
 * status bar, the auth progress bar -- and a toast there covers content the
 * message is usually about.
 */

import { Notify } from 'quasar';
import { recordEvent } from 'src/utils/diagnostics';

/** Shared so a toast cannot drift to the top by being declared without one. */
const POSITION = 'bottom' as const;

/**
 * Report a failure. Stays until dismissed, and wraps long text rather than
 * truncating it, so the detail survives long enough to be screenshotted.
 */
export function notifyError(message: string) {
  // Recorded here rather than at the call sites: every user-facing failure in
  // the app already comes through this function, so the diagnostics buffer
  // stays complete without anyone having to remember to log.
  recordEvent('error', message);
  Notify.create({
    message,
    color: 'negative',
    position: POSITION,
    multiLine: true,
    timeout: 0,
    actions: [{ label: 'Dismiss', color: 'white' }],
  });
}

/** Report something the user should notice but need not act on. Auto-dismisses. */
export function notifyWarning(message: string) {
  recordEvent('error', 'warning: ' + message);
  Notify.create({
    message,
    color: 'warning',
    position: POSITION,
    timeout: 5000,
  });
}

/**
 * Report a refusal that is a normal outcome rather than a fault.
 *
 * A check-in the server declines -- no lesson scheduled in that room right now --
 * is the expected answer for most rooms when checking in to all of them at once.
 * Styling those as errors trains the user to ignore errors, and making them
 * require a tap would mean dismissing one per saved room.
 */
export function notifyInfo(message: string) {
  // Still recorded: a declined check-in arrives as a normal 200 response, so the
  // API layer does not log it, and "why did it refuse" is a real support question.
  recordEvent('info', message);
  Notify.create({
    message,
    // Orange rather than 'info' blue: the theme's blue is too light to carry
    // white text legibly. Orange also reads as "not what you wanted, but not
    // broken either", which is exactly what a declined check-in is. Distinct
    // from notifyWarning's amber so the two are not the same swatch.
    color: 'orange',
    textColor: 'black',
    // Icons rather than colour alone: a declined check-in and a successful one
    // must not be tellable apart only by hue, since they arrive in a stream
    // during a bulk check-in and are read at a glance.
    icon: 'mdi-information-outline',
    position: POSITION,
    multiLine: true,
    timeout: 4000,
  });
}

/** Confirm something went right. Auto-dismisses quickly. */
export function notifySuccess(message: string) {
  Notify.create({
    message,
    color: 'positive',
    icon: 'mdi-check-circle-outline',
    position: POSITION,
    progress: true,
  });
}
