/**
 * Screen tweaks for the duration of a barcode screen.
 *
 * Three problems at a turnstile:
 *  - the phone rotates to landscape as you hold it out, and the scanner sees a
 *    QR that is off-screen or cropped;
 *  - the screen times out while you are queueing;
 *  - auto-brightness has dimmed the screen, and the code does not read in
 *    daylight.
 *
 * Rotation lock and keep-awake are applied unconditionally: they are invisible
 * until they help. Forcing brightness is visible and can be startling, so it is
 * opt-in and defaults to off.
 *
 * All of this is native-only. Everything is feature-detected and fails
 * silently, so the PWA and `quasar dev` in a browser behave as before.
 */

import { onMounted, onUnmounted, watch, type Ref } from 'vue';

interface BrightnessPlugin {
  setBrightness(value: number, success?: () => void, error?: (e: unknown) => void): void;
  getBrightness(success: (value: number) => void, error?: (e: unknown) => void): void;
}

interface InsomniaPlugin {
  keepAwake(): void;
  allowSleepAgain(): void;
}

interface CordovaWindow {
  cordova?: {
    plugins?: {
      brightness?: BrightnessPlugin;
      insomnia?: InsomniaPlugin;
    };
  };
  plugins?: {
    insomnia?: InsomniaPlugin;
  };
  screen?: Screen & {
    orientation?: ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
      unlock?: () => void;
    };
  };
}

function cordovaWindow(): CordovaWindow {
  return window as unknown as CordovaWindow;
}

function brightnessPlugin(): BrightnessPlugin | undefined {
  return cordovaWindow().cordova?.plugins?.brightness;
}

/**
 * Whether forcing brightness is possible at all.
 *
 * Used to decide whether to offer the control. Keyed on the plugin rather than
 * on "is this Cordova", so a native build that somehow shipped without the
 * plugin hides the toggle too instead of offering a switch that does nothing.
 */
export function hasBrightnessControl(): boolean {
  return brightnessPlugin() !== undefined;
}

/** cordova-plugin-insomnia installs itself at window.plugins.insomnia. */
function insomniaPlugin(): InsomniaPlugin | undefined {
  const w = cordovaWindow();
  return w.plugins?.insomnia ?? w.cordova?.plugins?.insomnia;
}

/**
 * Hold portrait and keep the screen awake while mounted, and optionally run at
 * full brightness.
 *
 * @param maxBrightness reactive opt-in. Toggling it takes effect immediately,
 *   so turning it off restores the previous level there and then rather than
 *   waiting for unmount.
 */
export function useQrScreenMode(maxBrightness: Ref<boolean>) {
  let previousBrightness: number | null = null;
  let lockedOrientation = false;

  function applyMaxBrightness() {
    const brightness = brightnessPlugin();
    if (!brightness || previousBrightness !== null) return;

    brightness.getBrightness(
      (value) => {
        previousBrightness = value;
        brightness.setBrightness(1.0);
      },
      () => {
        // Could not read the current level, so there is nothing to restore to.
        // Brighten anyway and let Android reset it when the app loses focus.
        brightness.setBrightness(1.0);
      },
    );
  }

  function restoreBrightness() {
    if (previousBrightness === null) return;
    brightnessPlugin()?.setBrightness(previousBrightness);
    previousBrightness = null;
  }

  onMounted(() => {
    const orientation = cordovaWindow().screen?.orientation;
    // In a browser lock() rejects unless the page is fullscreen. Expected here,
    // not an error worth surfacing.
    orientation?.lock?.('portrait').then(
      () => {
        lockedOrientation = true;
      },
      () => {
        // Orientation stays free; the QR is still usable, just rotatable.
      },
    );

    insomniaPlugin()?.keepAwake();

    if (maxBrightness.value) applyMaxBrightness();
  });

  watch(maxBrightness, (enabled) => {
    if (enabled) applyMaxBrightness();
    else restoreBrightness();
  });

  onUnmounted(() => {
    if (lockedOrientation) {
      cordovaWindow().screen?.orientation?.unlock?.();
    }
    insomniaPlugin()?.allowSleepAgain();
    restoreBrightness();
  });
}
