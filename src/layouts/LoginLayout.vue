<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated @click="increment">
      <q-toolbar>
        <q-toolbar-title> Login flow </q-toolbar-title>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
    <q-page-sticky position="bottom-right" :offset="[18, 18]" v-show="isRevealed">
      <q-fab icon="build" direction="up" color="accent" label-position="left">
        <q-fab-action color="primary" icon="mdi-bomb" @click="openReset" external-label label="Reset everything"
          label-position="left" />
      </q-fab>
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
import { ref } from 'vue';


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
