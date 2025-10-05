<template>
  <div v-if="!cameraRunning && !cameraError" class="column items-center q-gutter-sm">
    <q-spinner color="primary" size="3em" />
    <p>Waiting for camera to be ready...</p>
  </div>
  <q-banner v-if="cameraError" class="bg-red text-white">
    {{ cameraError }}.
    The scanner will not work until this error is fixed.
    Restart the app and try again.
  </q-banner>
  <div v-if="cameraRunning">
    <p>
      You have scanned {{ scannedCodes.size }} room codes,
      and found {{ newEntries.length }} new ones.

    </p>

    <!-- horizontally two buttons: save and delete -->
    <div class="row justify-between">
      <q-btn v-if="fetchTasks.size > 0" disable color="primary" label="Waiting for server..." />
      <q-btn v-else-if="newEntries.length === 0" disable color="primary" label="No new codes yet..." />
      <q-btn v-else color="primary" :label="`Save ${newEntries.length} new codes`" @click="saveCodes" />

      <q-btn v-if="!confirmQuit" color="negative" label="Discard new codes" @click="quitStep1" />
      <q-btn v-else color="negative" label="Really discard?" @click="quitDiscard" />
    </div>
  </div>

  <QrcodeStream @error="onError" :track="paintOutline" @camera-on="onCameraRunning()" :constraints="constraint()" />
  <q-select v-model="selectedCamera" :options="cameras" label="Select camera"
    @update:model-value="v => onCameraSelected(v)" />
  <q-btn color="primary" label="Rescan available cameras" @click="scanCameras()" />
</template>

<script setup lang="ts">
import { Notify } from 'quasar';
import type { LocalStorageRoomData } from 'src/api/types';
import { Device, LkRudnRu } from 'src/consts/store-consts';
import { ref } from 'vue';
import type { DetectedBarcode } from 'vue-qrcode-reader';
import { QrcodeStream } from 'vue-qrcode-reader';
import { useRouter } from 'vue-router';

const cameraRunning = ref(false);
const cameraError = ref("");

interface WrappedMediaDeviceInfo {
  label: string;
  info: MediaDeviceInfo;
}

const cameras = ref<WrappedMediaDeviceInfo[]>([]);
const selectedCamera = ref<WrappedMediaDeviceInfo | null>(null);

function constraint(): MediaTrackConstraints {
  if (selectedCamera.value === null || cameras.value.length === 0) {
    return {};
  }

  return {
    deviceId: selectedCamera.value.info.deviceId
  }
}

function onCameraSelected(which: WrappedMediaDeviceInfo) {
  localStorage.setItem(Device.PreferredCameraId, which.info.deviceId);
  localStorage.setItem(Device.PreferredCameraName, which.info.label);
}

async function scanCameras() {
  cameras.value = [];

  const preferredId = localStorage.getItem(Device.PreferredCameraId);
  const preferredName = localStorage.getItem(Device.PreferredCameraName);

  const devices = await navigator.mediaDevices.enumerateDevices();
  for (let i = 0; i < devices.length; i++) {
    const device = devices[i];
    if (device === undefined) {
      continue;
    }
    if (device.kind === 'videoinput') {
      const item = {
        label: device.label,
        info: device
      };
      cameras.value.push(item);

      if (device.deviceId === preferredId) {
        selectedCamera.value = item;
      }

      if (selectedCamera.value === null && device.label == preferredName) {
        selectedCamera.value = item;
      }
    }
  };
}

async function onCameraRunning() {
  cameraRunning.value = true;
  if (cameras.value.length === 0) {
    await scanCameras();
  }
}

const confirmQuit = ref(false);

function quitStep1() {
  confirmQuit.value = true;
  setTimeout(() => {
    confirmQuit.value = false;
  }, 5000);
}

const alreadyExistingRooms = JSON.parse(
  localStorage.getItem(LkRudnRu.CheckInRooms) || '[]'
) as LocalStorageRoomData[];

const alreadyExistingRoomLinks = new Set(alreadyExistingRooms.map((room) => {
  return `https://qr.rudn.ru/${room.uuid}`;
}));

const fetchTasks = ref<Map<string, Promise<void>>>(new Map<string, Promise<void>>());

const scannedCodes = ref<Set<string>>(new Set<string>());
const newEntries = ref<LocalStorageRoomData[]>([]);

const router = useRouter();

function paintOutline(detectedCodes: DetectedBarcode[], ctx: CanvasRenderingContext2D) {
  for (const detectedCode of detectedCodes) {

    // check that the code matches the format:
    // https://qr.rudn.ru/{uuid}
    const text = detectedCode.rawValue;
    const regex = /^https:\/\/qr\.rudn\.ru\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    let wrong;
    let alreadyExisting = false;
    if (regex.test(text)) {
      wrong = false;
      ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';

      // find in already existing rooms:
      if (alreadyExistingRoomLinks.has(text)) {
        alreadyExisting = true;
        ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
      }

      if (!scannedCodes.value.has(text)) {
        scannedCodes.value.add(text);
        const uuid = text.split("/")[3];
        if (uuid === undefined) { continue; }

        if (!alreadyExisting) {
          if (!fetchTasks.value.has(uuid)) {
            fetchTasks.value.set(uuid, fetchRoomInfo(uuid));
          }
        }
        else {
          Notify.create({
            color: 'info',
            message: "That room is already saved."
          });
        }
      }
    } else {
      wrong = true;
      ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    }

    const [firstPoint, ...otherPoints] = detectedCode.cornerPoints


    ctx.beginPath()
    ctx.moveTo(firstPoint.x, firstPoint.y)
    for (const { x, y } of otherPoints) {
      ctx.lineTo(x, y)
    }
    ctx.lineTo(firstPoint.x, firstPoint.y)
    ctx.closePath()
    ctx.fill()

    if (wrong) {
      // add a cross across the QR code
      ctx.strokeStyle = 'rgba(255, 0, 0, 1)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(detectedCode.cornerPoints[0].x, detectedCode.cornerPoints[0].y);
      ctx.lineTo(detectedCode.cornerPoints[2].x, detectedCode.cornerPoints[2].y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(detectedCode.cornerPoints[1].x, detectedCode.cornerPoints[1].y);
      ctx.lineTo(detectedCode.cornerPoints[3].x, detectedCode.cornerPoints[3].y);
      ctx.stroke();
    }
  }
}


async function fetchRoomInfo(uuid: string) {
  try {
    // GET https://api-qr.rudn.ru/api/v1/lecture_room/room/e3ac8763-ba12-4549-ae67-efcf37349246/

    const resp = await fetch(`https://api-qr.rudn.ru/api/v1/lecture_room/room/${uuid}/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (resp.ok) {
      const data: {
        uuid_url: string,
        name: string,
        room: {
          id: number,
          short_name: string
        }
      } = await resp.json();

      const newEntry: LocalStorageRoomData = {
        uuid: data.uuid_url,
        name: data.name,
        short_name: data.room.short_name,
        room_id: data.room.id
      }

      newEntries.value.push(newEntry);
    }

  }
  catch (ex) {
    Notify.create({
      message: 'Error fetching room info: ' + (ex as any),
      color: 'negative',
      position: 'top',
    });
  }
  finally {
    fetchTasks.value.delete(uuid);
  }
}

function saveCodes() {
  const newRooms = [];
  for (const newRoom of newEntries.value) {
    newRooms.push(newRoom);
  }

  for (const oldRoom of alreadyExistingRooms) {
    newRooms.push(oldRoom);
  }

  localStorage.setItem(LkRudnRu.CheckInRooms, JSON.stringify(newRooms));
  router.back();
}
function quitDiscard() {
  router.back();
}

function onError(err: any) {
  let error = `[${err.name}]: `

  if (err.name === 'NotAllowedError') {
    error += 'you need to grant camera access permission'
  } else if (err.name === 'NotFoundError') {
    error += 'no camera on this device'
  } else if (err.name === 'NotSupportedError') {
    error += 'secure context required (HTTPS, localhost)'
  } else if (err.name === 'NotReadableError') {
    error += 'is the camera already in use?'
  } else if (err.name === 'OverconstrainedError') {
    error += 'installed cameras are not suitable'
  } else if (err.name === 'StreamApiNotSupportedError') {
    error += 'Stream API is not supported in this browser'
  } else if (err.name === 'InsecureContextError') {
    error +=
      'Camera access is only permitted in secure context. Use HTTPS or localhost rather than HTTP.'
  } else {
    error += err.message
  }

  alert("Error while scanning QR code: " + error);

  cameraRunning.value = false;
  cameraError.value = error;
}
</script>
