/**
 * User-facing message helpers.
 *
 * Error messages often carry technical detail worth reporting to the developer.
 * A toast that fades after a few seconds gives you no chance to read or
 * screenshot that, which is why `notifyError` stays on screen until it is
 * explicitly dismissed. Informational messages auto-dismiss as normal.
 */

import { Notify } from 'quasar';
import { recordEvent } from 'src/utils/diagnostics';

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
    position: 'top',
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
    position: 'top',
    timeout: 5000,
  });
}

/** Confirm something went right. Auto-dismisses quickly. */
export function notifySuccess(message: string) {
  Notify.create({
    message,
    color: 'positive',
    position: 'top',
    progress: true,
  });
}
