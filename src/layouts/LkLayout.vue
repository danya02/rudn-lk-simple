<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated @click="increment">
      <q-toolbar>
        <q-toolbar-title> RUDN App </q-toolbar-title>

        <!-- back button -->
        <q-btn flat round dense icon="arrow_back" @click="router.back()" />
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
      </q-fab>
    </q-page-sticky>

    <q-page-sticky position="bottom" expand>
      <TokenManager ref="manager" />
    </q-page-sticky>

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
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const manager = ref();
const router = useRouter();


const clicks = ref(0);
const isRevealed = ref(false);
const resetDialogRevealed = ref(false);

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

function performReset() {
  // delete everything from localStorage
  localStorage.clear();

  // go to the login page
  window.location.href = '/';
}

</script>
