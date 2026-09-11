<template>
  <q-page class="column items-center">
    <div v-if="isPermanentDenied" class="column items-center q-gutter-sm">
      <h6>Camera permission is permanently denied.</h6>
      <p>You will need to manually grant camera permission in your device settings.</p>
      <q-btn color="accent" label="Open settings" @click="openSettings" />
      <q-btn color="positive" label="Permission already granted, try again" @click="requestPermission" />
    </div>
    <div v-else class="column items-center q-gutter-sm">
      <q-spinner color="primary" size="3em" />
      <p>Trying to get permission to use the camera...</p>
      <p v-if="yourTakingTooLong">(If this is taking too long, try pressing the back button and trying again)</p>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { errorMessage } from 'src/api/client';
import { notifyError, notifyWarning } from 'src/utils/notify';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const yourTakingTooLong = ref(false);

interface DiagnosticPlugin {
  permission: {
    CAMERA: string
  },
  permissionStatus: {
    GRANTED: string,
    NOT_REQUESTED: string,
    DENIED_ONCE: string,
    DENIED_ALWAYS: string
  }
  getPermissionAuthorizationStatus: (success: (status: string) => void, error: (message: string) => void, permission: string) => void,
  requestRuntimePermission: (success: (status: string) => void, error: (message: string) => void, permission: string) => void,
  switchToSettings: (success: () => void, error: (message: string) => void) => void,
}

const isPermanentDenied = ref(false);

async function openSettings() {
  const plugins: any = window.cordova.plugins;
  if (plugins.diagnostic === undefined || plugins.diagnostic === null) {
    console.log("Cordova plugin diagnostic is missing, directing to scanner immediately.")
    await router.replace({ 'name': 'checkin-scanner' });
    return;
  }
  const diag: DiagnosticPlugin = plugins.diagnostic;

  try {
    await new Promise<void>((resolve, reject) => {
      diag.switchToSettings(resolve, reject);
    });
  }
  catch (ex) {
    notifyError('Could not open your device settings. ' + errorMessage(ex));
  }
}

async function init() {
  setTimeout(() => {
    yourTakingTooLong.value = true;
  }, 10000);

  if (window.cordova === undefined || window.cordova === null) {
    console.log("Running outside of Cordova app, directing to scanner immediately.")
    await router.replace({ 'name': 'checkin-scanner' });
    return;
  }

  // Running in Cordova
  const plugins: any = window.cordova.plugins;
  if (plugins === undefined || plugins.diagnostic === undefined || plugins.diagnostic === null) {
    notifyWarning('Camera permission check is unavailable. Opening the scanner directly.');
    console.log("Cordova plugin diagnostic is missing, directing to scanner immediately.")
    await router.replace({ 'name': 'checkin-scanner' });
    return;
  }
  const diag: DiagnosticPlugin = plugins.diagnostic;


  try {
    const status = await new Promise<string>((resolve, reject) => {
      diag.getPermissionAuthorizationStatus(resolve, reject, diag.permission.CAMERA);
    });


    switch (status) {
      case diag.permissionStatus.GRANTED:
        console.log("Already granted, directing to scanner immediately.")
        await router.replace({ 'name': 'checkin-scanner' });
        break;
      case diag.permissionStatus.NOT_REQUESTED:
        console.log("Not yet granted, requesting permission.")
        await requestPermission();
        break;
      case diag.permissionStatus.DENIED_ONCE:
        console.log("Denied once, requesting permission.")
        await requestPermission();
        break;

      case diag.permissionStatus.DENIED_ALWAYS:
      default:
        isPermanentDenied.value = true;
        break;
    }
  }
  catch (ex) {
    notifyError('Could not check camera permission. Please allow camera access in your device settings. ' + errorMessage(ex));
  }
}

async function requestPermission() {
  if (window.cordova === undefined || window.cordova === null) {
    console.log("Running outside of Cordova app, directing to scanner immediately.")
    await router.replace({ 'name': 'checkin-scanner' });
    return;
  }

  // Running in Cordova
  const plugins: any = window.cordova.plugins;
  if (plugins === undefined || plugins.diagnostic === undefined || plugins.diagnostic === null) {
    notifyWarning('Camera permission check is unavailable. Opening the scanner directly.');
    console.log("Cordova plugin diagnostic is missing, directing to scanner immediately.")
    await router.replace({ 'name': 'checkin-scanner' });
    return;
  }
  const diag: DiagnosticPlugin = plugins.diagnostic;

  try {
    const result = await new Promise((resolve, reject) => {
      diag.requestRuntimePermission(resolve, reject, diag.permission.CAMERA);
    });

    switch (result) {
      case diag.permissionStatus.GRANTED:
        console.log("Permission granted to use the camera");
        await router.replace({ 'name': 'checkin-scanner' });
        break;
      case diag.permissionStatus.NOT_REQUESTED:
        console.log("Permission to use the camera has not been requested yet (but we just did?!)");
        break;
      case diag.permissionStatus.DENIED_ONCE:
        console.log("Permission denied to use the camera - ask again?");
        notifyWarning('Camera access was declined. The app needs it to scan QR codes.');
        router.back();
        break;
      case diag.permissionStatus.DENIED_ALWAYS:
        console.log("Permission permanently denied to use the camera - guess we won't be using it then!");
        isPermanentDenied.value = true;
        break;
    }
  }
  catch (ex) {
    notifyError('Could not request camera permission. Please allow camera access in your device settings. ' + errorMessage(ex));
  }
}

onMounted(init)

</script>
