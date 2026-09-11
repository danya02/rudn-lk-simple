<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated @click="increment">
      <q-toolbar>
        <q-toolbar-title> RUDN App </q-toolbar-title>

        <!-- back button -->
        <q-btn flat round dense icon="arrow_back" @click.stop="router.back()" />
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
    <q-page-sticky position="bottom-left" :offset="[18, 18]" v-show="isRevealed">
      <q-fab icon="build" direction="up" color="accent">
        <q-fab-action color="primary" icon="mdi-bomb" @click="openReset" external-label label="Reset everything" />
        <q-fab-action color="primary" icon="refresh" @click="manager.force_refresh()" external-label
          label="Refresh token" />
        <q-fab-action color="primary" icon="mdi-clipboard-text" @click="openDiagnostics" external-label
          label="Diagnostics" />
      </q-fab>
    </q-page-sticky>

    <q-page-sticky position="bottom" expand>
      <TokenManager ref="manager" />
    </q-page-sticky>

    <!-- Shown as well as copied: an old Android WebView may have no clipboard,
         and reading the state on screen is useful in its own right. -->
    <q-dialog v-model="diagnosticsRevealed">
      <q-card style="max-width: 100vw">
        <q-card-section>
          <div class="text-h6">Diagnostics</div>
          <div class="text-caption">
            Paste this into a bug report. It contains no passwords or tokens.
          </div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <pre class="diagnostics-text">{{ diagnosticsText }}</pre>
        </q-card-section>

        <q-card-actions align="around">
          <q-btn flat label="Copy" color="primary" @click="doCopy" />
          <q-btn flat label="Close" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="resetDialogRevealed" persistent>
      <q-card>
        <q-card-section class="row items-center">
          <q-avatar icon="mdi-bomb" color="red" text-color="white" />
          <span class="q-ml-sm">Are you sure you want to reset all application data?
            Your login and password will be forgotten,
            and any saved rooms will be deleted.
          </span>
        </q-card-section>

        <q-card-section class="row items-center">
          <span class="q-ml-sm">
            Use this option if you are having problems with the application,
            for a fresh start.
          </span>
        </q-card-section>

        <q-card-actions align="around">
          <q-btn flat label="Yes, delete" color="red" v-close-popup @click="performReset" />
          <q-btn flat label="No, cancel" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

  </q-layout>
</template>

<script setup lang="ts">
import TokenManager from 'src/components/TokenManager.vue';
import { buildDiagnostics, clearEvents, copyDiagnostics } from 'src/utils/diagnostics';
import { notifySuccess, notifyWarning } from 'src/utils/notify';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const manager = ref();
const router = useRouter();


const clicks = ref(0);
const isRevealed = ref(false);
const resetDialogRevealed = ref(false);
const diagnosticsRevealed = ref(false);
const diagnosticsText = ref('');

function increment() {
  clicks.value++;
  if (clicks.value > 4) {
    isRevealed.value = !isRevealed.value;
    clicks.value = 0;
  }
}

function openReset() {
  resetDialogRevealed.value = true;
}

function openDiagnostics() {
  // Snapshotted on open so the text cannot shift while it is being read.
  diagnosticsText.value = buildDiagnostics();
  diagnosticsRevealed.value = true;
}

async function doCopy() {
  if (await copyDiagnostics()) {
    notifySuccess('Diagnostics copied.');
  } else {
    notifyWarning('Could not copy. Select the text above and copy it by hand.');
  }
}

function performReset() {
  // delete everything from localStorage
  localStorage.clear();

  // A fresh start should not carry the old session's events into the next report.
  clearEvents();

  // go to the login page
  window.location.href = '/';
}

</script>

<style scoped>
/* The report is preformatted, but lines can be long (user agent strings, error
   bodies), so wrap rather than force a horizontal scroll on a phone. */
.diagnostics-text {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.75rem;
  max-height: 50vh;
  overflow-y: auto;
  margin: 0;
  user-select: text;
}
</style>
