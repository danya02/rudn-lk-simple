<template>
  <q-page class="column items-center q-gutter-lg">
    <div v-if="state === 'loading'" class="column items-center q-gutter-sm">
      <q-spinner color="primary" size="3em" />
      <p>Preparing backup...</p>
    </div>

    <div v-else-if="state === 'empty'" class="column items-center q-gutter-sm">
      <p>You have no saved rooms to back up.</p>
    </div>

    <div v-else-if="state === 'ready'" class="column items-center q-gutter-md">
      <div class="column items-center q-gutter-sm">
        <QrcodeCanvas :value="currentChunk" :size="300" :margin="4" level="M" />
        <p class="text-subtitle1">Code {{ index + 1 }} of {{ chunks.length }}</p>
      </div>

      <div class="row items-center q-gutter-md">
        <q-btn color="primary" icon="chevron_left" :disable="index === 0" @click="index--" />
        <q-btn
          color="primary"
          icon="chevron_right"
          :disable="index === chunks.length - 1"
          @click="index++"
        />
      </div>

      <p class="text-caption text-center">
        Scan these with another device's room scanner, in any order. Each code stands on its own:
        whatever you scan is added to that device's list.
      </p>
    </div>

    <!-- Only where the brightness plugin exists; in the PWA the toggle would do nothing. -->
    <div v-if="brightnessAvailable && state === 'ready'" class="row justify-center q-mt-md">
      <q-toggle v-model="maxBrightness" label="Full brightness" dense />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { hasBrightnessControl, useQrScreenMode } from 'src/composables/useQrScreenMode';
import { Device } from 'src/consts/store-consts';
import { encodeRoomsBackup, readStoredRooms } from 'src/utils/rooms-backup';
import { QrcodeCanvas } from 'qrcode.vue';
import { computed, onMounted, ref, watch } from 'vue';

const state = ref<'loading' | 'ready' | 'empty'>('loading');
const chunks = ref<string[]>([]);
const index = ref(0);

const currentChunk = computed(() => chunks.value[index.value] ?? '');

// Off unless explicitly enabled, so nobody gets a blinding screen by surprise.
const maxBrightness = ref(localStorage.getItem(Device.QrMaxBrightness) === 'true');

watch(maxBrightness, (enabled) => {
  localStorage.setItem(Device.QrMaxBrightness, String(enabled));
});

// Hold portrait and keep the screen awake while the codes are on screen.
useQrScreenMode(maxBrightness);

// Plugins are all present by the time a page renders, so one read is enough.
const brightnessAvailable = hasBrightnessControl();

onMounted(() => {
  const rooms = readStoredRooms();
  if (rooms.length === 0) {
    state.value = 'empty';
    return;
  }

  // Encoding is a string join now, so there is nothing here that can fail and
  // no reason for this to be async.
  chunks.value = encodeRoomsBackup(rooms);
  state.value = 'ready';
});
</script>
