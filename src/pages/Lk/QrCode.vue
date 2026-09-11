<template>
  <NeedsToken v-slot="{ token }" type="rect">
    <QrPass :token="token" />
  </NeedsToken>
  <!-- Only where the brightness plugin exists; in the PWA the toggle would do nothing. -->
  <div v-if="brightnessAvailable" class="row justify-center q-mt-md">
    <q-toggle v-model="maxBrightness" label="Full brightness" dense />
  </div>
</template>


<script setup lang="ts">
import QrPass from 'src/components/api/QrPass.vue';
import NeedsToken from 'src/components/NeedsToken.vue';
import { hasBrightnessControl, useQrScreenMode } from 'src/composables/useQrScreenMode';
import { Device } from 'src/consts/store-consts';
import { ref, watch } from 'vue';

// Off unless explicitly enabled, so nobody gets a blinding screen by surprise.
const maxBrightness = ref(localStorage.getItem(Device.QrMaxBrightness) === 'true');

watch(maxBrightness, (enabled) => {
  localStorage.setItem(Device.QrMaxBrightness, String(enabled));
});

// Hold portrait and keep the screen awake while the pass is on screen, so the
// turnstile scanner gets a readable, correctly-oriented code.
useQrScreenMode(maxBrightness);

// Plugins are all present by the time a page renders, so one read is enough.
const brightnessAvailable = hasBrightnessControl();
</script>
