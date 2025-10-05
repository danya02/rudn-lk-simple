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
    alert("Error opening settings page: " + (ex as any));
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
    alert("Cordova plugin diagnostic is missing, directing to scanner immediately.")
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
    alert("Error getting camera permission status. Make sure that the app is allowed to access the camera in the device settings. " + (ex as any));
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
    alert("Cordova plugin diagnostic is missing, directing to scanner immediately.")
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
        break;
      case diag.permissionStatus.NOT_REQUESTED:
        console.log("Permission to use the camera has not been requested yet (but we just did?!)");
        break;
      case diag.permissionStatus.DENIED_ONCE:
        console.log("Permission denied to use the camera - ask again?");
        alert("You have temporarily rejected this app's request to use the camera. Without this, the app cannot scan QR codes.")
        router.back();
        break;
      case diag.permissionStatus.DENIED_ALWAYS:
        console.log("Permission permanently denied to use the camera - guess we won't be using it then!");
        isPermanentDenied.value = true;
        break;
    }
  }
  catch (ex) {
    alert("Error requesting camera permission. Make sure that the app is allowed to access the camera in the device settings. " + (ex as any));
  }
}

onMounted(init)

</script>
