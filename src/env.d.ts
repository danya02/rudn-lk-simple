declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: string;
    VUE_ROUTER_MODE: 'hash' | 'history' | 'abstract' | undefined;
    VUE_ROUTER_BASE: string | undefined;
    /** Injected by quasar.config.ts from package.json, for the diagnostics report. */
    APP_VERSION: string;
    /** Injected by quasar.config.ts from src-cordova/config.xml. */
    ANDROID_VERSION_CODE: string;
  }
}
