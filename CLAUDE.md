# CLAUDE.md

## What this is

"RUDN Simple" (`ru.danya02.rudn-simple`) — a lightweight reimplementation of the most
important features of the official RUDN university mobile app: display the PACS QR pass,
and check in to lecture rooms by scanning their QR codes. The official app historically
had trouble keeping users logged in, so this app's central design goal is a self-healing
auth chain (see "Auth" below).

Stack: Quasar v2 (Vite) + Vue 3 `<script setup>` + TypeScript (strict) + Pinia.
Ships as an Android app via Cordova and as a PWA from the same `src/`.

## Commands

Makefile targets (preferred; they just wrap `npx quasar`):

- `make dev` — SPA dev server (HTTPS, auto-opens browser; HTTPS is required for camera access)
- `make dev-mobile` — `quasar dev -m cordova -T android` on a device/emulator
- `make build-mobile` — `quasar build -m cordova -T android`

npm scripts:

- `npm run dev` / `npm run build` — plain SPA
- `npm run lint` — `eslint -c ./eslint.config.js "./src*/**/*.{ts,js,cjs,mjs,vue}"`
- `npm run format` — Prettier over the repo
- `npm test` — no-op placeholder
- `postinstall` runs `quasar prepare` (regenerates `.quasar/`, which `tsconfig.json` extends)

PWA build: `npx quasar build -m pwa`. There is no explicit typecheck script — `vue-tsc`
and ESLint run through `vite-plugin-checker` during dev/build (configured in
`quasar.config.ts`), so a type error fails the build.

Release signing is commented out in the `Makefile` (`prepare-release`): zipalign + apksigner
against a keystore in `../../private/`. `private/` is gitignored. `.env` in the repo root only
exports `ANDROID_HOME`/`ANDROID_SDK_ROOT` for the shell; it is not read by the app.

## src/ layout

- `src/api/types.ts` — the only "api" file: TypeScript interfaces for the RUDN API responses
  and for the localStorage room records. **There is no API client layer** — `fetch` calls are
  written inline inside the components/pages that need them.
- `src/boot/` — empty; `boot: []` in `quasar.config.ts`.
- `src/consts/store-consts.ts` — string enums (`IdRudnRu`, `LkRudnRu`, `Device`) holding the
  localStorage key names, plus `reset_all_auth()`. **Always go through these enums; never
  hardcode a localStorage key.**
- `src/stores/lk_rudn.ts` — the only real Pinia store (`lkTokenStore`): `{ token, reset_at, is_ready }`.
  `reset()` does not clear the token; it stamps `reset_at`, which `TokenManager` watches as a
  "please re-run the auth chain" signal. `stores/index.ts` is the Quasar Pinia wrapper.
- `src/layouts/` — `StartupRouterLayout`, `LoginLayout`, `LkLayout` (the main one), `UtilLayout`.
- `src/pages/` — `StartupRouter`, `LoginPage`, `PickAccount`, `AcquireLkCode`, `MainHub`,
  `Lk/{QrCode,CheckIn,CheckInScanner,RoomInfo}`, `Utility/QrScannerCameraGrant`, `ErrorNotFound`.
- `src/components/` — `TokenManager.vue` (auth engine), `NeedsToken.vue` (token gate),
  `api/QrPass.vue`, `api/ShowPersonName.vue`.
- `src/router/routes.ts` — named routes; navigate by `name`, not by path string.
  Router mode is **hash** (`build.vueRouterMode: 'hash'`) because Cordova serves from `file://`.

`src/components/ExampleComponent.vue`, `src/components/models.ts` and
`src/stores/example-store.ts` are unused Quasar scaffolding.

## Auth and token storage

Everything is stored in plain `localStorage` — including the user's **username and password**,
which are deliberately retained so the app can silently re-login when tokens expire. There is
no refresh-token flow with the upstream API that survives well, hence this design.

Two upstream identity systems are involved:

1. `id-api.rudn.ru` (id.rudn.ru) — username/password sign-in, produces an *ephemeral* token that
   must be traded via `POST /api/v1/auth/continue/direct` for the real access token.
2. `mobapp-api.rudn.ru` (lk.rudn.ru) — the app API. Its token is obtained via an OAuth-ish dance:
   `POST id-api /api/v1/oauth2/continue?client_id=...` returns a redirect **URL string** in
   `data`; the host part `https://mobapp-api.rudn.ru/token-rudn-id` must be string-replaced with
   `https://mobapp-api.rudn.ru/v1/auth/token-rudn-id` and then GET-ed with the literal header
   `Authorization: Bearer null`. That quirk is required, not a bug.

Room/schedule data comes from a third host, `api-qr.rudn.ru`, and room QR codes encode
`https://qr.rudn.ru/<uuid>`.

`src/components/TokenManager.vue` is the heart of the app. It holds an ordered list of steps:

```
login_password -> trade_ephemeral_token_for_real -> trade_id_for_lk_token -> final_check
```

It starts at the **last** step (`final_check`, a `GET /v3/person/me` probe) and walks
*backwards* on failure (`Outcome.FailRollup`) and forwards on success, with a budget of 10
step executions. So a still-valid token costs one request, and only as much re-auth as needed
is performed. Full exhaustion shows a red banner offering a manual re-login. It is mounted
persistently in `LkLayout` and exposes `refresh()` / `force_refresh()`.

Anything that gets a 401-ish response should call `tokenStore.reset()` rather than handling
re-auth itself; `TokenManager` watches `reset_at` and repairs the chain.

`NeedsToken.vue` is the consumer side: it renders a `q-skeleton` until the store token is
non-empty, then exposes the token via a scoped slot (`v-slot="{ token }"`), and triggers
`reset()` on mount if empty. New authenticated UI should be wrapped in it.

`LkRudnRu.SuccessfulAccess` is the "has ever logged in" flag `StartupRouter` uses to decide
between `hub` and `login`. `reset_all_auth()` clears credentials/tokens but keeps saved rooms;
the hidden "Reset everything" action in `LkLayout` does a full `localStorage.clear()` and
`window.location.href = '/'`.

Hidden dev affordance: tapping the `LkLayout` toolbar 5 times toggles a FAB with
"Reset everything" and "Refresh token".

## Cordova vs PWA

Same `src/`; the target is chosen by the `quasar` build mode. Cordova-only code must be
feature-detected at runtime, because the same page also runs in a browser:

- `src/pages/Utility/QrScannerCameraGrant.vue` checks `window.cordova` and
  `window.cordova.plugins.diagnostic`; if either is absent it routes straight to
  `checkin-scanner` (the browser asks for camera permission itself). Under Cordova it uses
  `cordova.plugins.diagnostic` to query/request `CAMERA` and can deep-link to app settings
  when permission is `DENIED_ALWAYS`. **Route to `qr-camera-grant`, not to `checkin-scanner`
  directly, whenever the camera is needed.**
- `src-cordova/config.xml` — Android id is `ru.danya02.rudnsimple` (note: differs from the npm
  package name `ru.danya02.rudn-simple`), declares the `CAMERA` permission, icons and splash.
  Bump `android-versionCode` for each Play release. `src-cordova/{platforms,plugins,www,node_modules}`
  are generated and gitignored.
- `src-pwa/` — Workbox in `GenerateSW` mode, so `custom-service-worker.ts` is **not** used
  unless `pwa.workboxMode` is switched to `InjectManifest`.
- Quasar framework config: dark mode on, `Notify` plugin enabled, Cordova back button enabled
  with exit-on-back.

## Conventions

- Prettier: single quotes, `printWidth` 100. ESLint enforces `@typescript-eslint/consistent-type-imports`
  (`import type { Foo } from ...`). Existing `.vue` files are not uniformly Prettier-formatted;
  don't reformat files wholesale as a side effect of an edit.
- `<script setup lang="ts">` everywhere; imports use the `src/...`, `pages/...`, `layouts/...`
  aliases.
- Icons come from `mdi-v7` and `material-icons` (`icon="mdi-bomb"`, `icon="refresh"`).
- User-facing errors are a mix of `Notify.create({...})` and raw `alert()`. Prefer `Notify`.
- Strings in the UI are English, even though the upstream API returns Russian name fields
  (`name_rus`, `surname_rus`, `patronymic_rus`).
