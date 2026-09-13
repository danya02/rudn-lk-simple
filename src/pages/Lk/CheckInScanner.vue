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
      You have scanned {{ scannedCodes.size }} codes,
      and found {{ newEntries.length }} new rooms.
    </p>

    <!-- horizontally two buttons: save and delete -->
    <div class="row justify-between">
      <q-btn v-if="fetchTasks.size > 0" disable color="primary" label="Waiting for server..." />
      <q-btn v-else-if="newEntries.length === 0" disable color="primary" label="No new rooms yet..." />
      <q-btn v-else color="primary" :label="`Save ${newEntries.length} new rooms`" @click="saveCodes" />

      <q-btn v-if="!confirmQuit" color="negative" label="Discard new rooms" @click="quitStep1" />
      <q-btn v-else color="negative" label="Really discard?" @click="quitDiscard" />
    </div>
  </div>

  <q-dialog v-model="leaveDialog" persistent>
    <q-card>
      <q-card-section>
        <div class="text-h6">Discard scanned rooms?</div>
      </q-card-section>
      <q-card-section>
        You have {{ newEntries.length }} new rooms that have not been saved. Leaving now will
        discard them.
      </q-card-section>
      <q-card-actions align="around">
        <q-btn flat label="Stay" color="primary" @click="cancelLeave" />
        <q-btn flat label="Discard and leave" color="negative" @click="confirmLeave" />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <QrcodeStream @error="onError" :track="paintOutline" @camera-on="onCameraRunning()" :constraints="constraint()" />
  <q-select v-model="selectedCamera" :options="cameras" label="Select camera"
    @update:model-value="v => onCameraSelected(v)" />
  <q-btn color="primary" label="Rescan available cameras" @click="scanCameras()" />
</template>

<script setup lang="ts">
import { Notify } from 'quasar';
import { errorMessage } from 'src/api/client';
import { getRoom, toStoredRoom } from 'src/api/rooms';
import type { LocalStorageRoomData } from 'src/api/types';
import { Device, LkRudnRu } from 'src/consts/store-consts';
import { buzzFresh, buzzKnown } from 'src/utils/haptics';
import { notifyError, notifyWarning } from 'src/utils/notify';
import { decodeBackupCode } from 'src/utils/rooms-backup';
import { ref } from 'vue';
import type { DetectedBarcode } from 'vue-qrcode-reader';
import { QrcodeStream } from 'vue-qrcode-reader';
import { onBeforeRouteLeave, useRouter } from 'vue-router';

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

const leaveDialog = ref(false);
let pendingLeave: ((allow: boolean) => void) | null = null;

function quitStep1() {
  confirmQuit.value = true;
  setTimeout(() => {
    confirmQuit.value = false;
  }, 5000);
}

const alreadyExistingRooms = JSON.parse(
  localStorage.getItem(LkRudnRu.CheckInRooms) || '[]'
) as LocalStorageRoomData[];

const alreadyExistingUuids = new Set(alreadyExistingRooms.map((room) => room.uuid));

const fetchTasks = ref<Map<string, Promise<void>>>(new Map<string, Promise<void>>());

const scannedCodes = ref<Set<string>>(new Set<string>());
const newEntries = ref<LocalStorageRoomData[]>([]);

const router = useRouter();

const ROOM_URL = /^https:\/\/qr\.rudn\.ru\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;

/**
 * The uuids a scanned code carries, or null if it is not one of ours.
 *
 * Two kinds of code feed the same list: a door code names one room, a backup
 * code names many. Everything downstream -- the fetch, the pending list, the
 * single Save -- is identical either way, which is the whole reason the room
 * scanner and the backup scanner are one page.
 */
function readCode(text: string): string[] | null {
  const room = ROOM_URL.exec(text);
  if (room?.[1] !== undefined) return [room[1]];

  const backup = decodeBackupCode(text);
  if (backup.ok) return backup.uuids;

  // A code claiming our magic prefix but failing to parse is worth a word;
  // any other QR in frame is just scenery.
  if (backup.looksLikeBackup) notifyWarning('Invalid backup code: ' + backup.reason);
  return null;
}

/** Take in a freshly-seen code, and report whether it brought anything new. */
function acceptCode(uuids: string[]): 'fresh' | 'known' {
  let fresh = 0;
  for (const uuid of uuids) {
    if (alreadyExistingUuids.has(uuid)) continue;
    if (fetchTasks.value.has(uuid)) continue;
    if (newEntries.value.some((room) => room.uuid === uuid)) continue;
    fresh++;
    fetchTasks.value.set(uuid, fetchRoomInfo(uuid));
  }
  return fresh > 0 ? 'fresh' : 'known';
}

function paintOutline(detectedCodes: DetectedBarcode[], ctx: CanvasRenderingContext2D) {
  for (const detectedCode of detectedCodes) {
    const text = detectedCode.rawValue;

    let wrong = false;
    if (scannedCodes.value.has(text)) {
      // Already dealt with, and still in frame. Keep the outline steady rather
      // than re-deciding, and buzzing, on every frame.
      ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
    } else {
      const uuids = readCode(text);
      if (uuids === null) {
        wrong = true;
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      } else {
        scannedCodes.value.add(text);
        const outcome = acceptCode(uuids);
        if (outcome === 'fresh') {
          // One buzz: this code brought at least one room we did not have.
          ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
          buzzFresh();
        } else {
          // Two buzzes, so "I scanned it and nothing will be saved" is
          // distinguishable from "it counted" without looking at the screen.
          ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
          buzzKnown();
          Notify.create({
            color: 'info',
            message: uuids.length === 1
              ? 'That room is already saved.'
              : 'All rooms in that code are already saved.'
          });
        }
      }
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
    const data = await getRoom(uuid);
    newEntries.value.push(toStoredRoom(data));
  }
  catch (ex) {
    notifyError('Error fetching room info: ' + errorMessage(ex));
  }
  finally {
    fetchTasks.value.delete(uuid);
  }
}

// Set by the two exits that are already a deliberate choice -- saving, and the
// two-tap "Really discard?" -- so the guard below does not ask a second time.
let leavingDeliberately = false;

// Walking away with scanned-but-unsaved rooms silently throws them out, and the
// user has to find and rescan every door again. Worth one confirmation.
onBeforeRouteLeave(() => {
  if (leavingDeliberately || newEntries.value.length === 0) return true;

  leaveDialog.value = true;
  return new Promise<boolean>((resolve) => {
    pendingLeave = resolve;
  });
});

function confirmLeave() {
  leaveDialog.value = false;
  pendingLeave?.(true);
  pendingLeave = null;
}

function cancelLeave() {
  leaveDialog.value = false;
  pendingLeave?.(false);
  pendingLeave = null;
}

function saveCodes() {
  leavingDeliberately = true;
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
  leavingDeliberately = true;
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

  notifyError('Camera problem: ' + error);

  cameraRunning.value = false;
  cameraError.value = error;
}
</script>
