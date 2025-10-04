<template>
  <q-page class="column items-center q-gutter-lg">
    <div v-if="rooms.length > 0" class="column items-center q-gutter-sm">
      <p>You have {{ rooms.length }} saved rooms.</p>
      <p>Swipe right for check-in. Swipe left to delete. Tap to open schedule.</p>
      <q-btn color="primary" label="Scan more..." to="/lk/checkin-scanner" />

      <NeedsToken type="QToolbar" width="100%" v-slot="{ token }">
        <q-list bordered separator>
          <q-slide-item right-color="red" v-for="room in rooms" :key="room.uuid" @right="onDelete(room.uuid)"
            @left="r => quickCheckin(room, token, r.reset)">
            <template v-slot:left>
              <q-icon name="how_to_reg" /> Check-in
              <q-spinner v-if="checkinRunning.includes(room.uuid)" color="white" size="3em" />
            </template>
            <template v-slot:right>
              Delete <q-icon name="delete" />
            </template>

            <q-item clickable v-ripple @click="navigate_to_room_page(room.uuid)">
              <q-item-section>
                <q-item-label>{{ room.name }}</q-item-label>
                <q-item-label caption>{{ room.uuid }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-slide-item>
        </q-list>
      </NeedsToken>

    </div>
    <div class="column items-center q-gutter-sm" v-else>
      <p>
        You don't have any saved rooms yet.
        Add one or more to begin:
      </p>
      <q-btn class="fullwidth" color="primary" label="Scan a room QR code..." to="/lk/checkin-scanner" />

    </div>
  </q-page>
</template>

<script setup lang="ts">
import { Notify } from 'quasar';
import type { LocalStorageRoomData } from 'src/api/types';
import NeedsToken from 'src/components/NeedsToken.vue';
import { LkRudnRu } from 'src/consts/store-consts';
import { useTokenStore } from 'src/stores/lk_rudn';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const tokenStore = useTokenStore();

const rooms = ref(
  JSON.parse(
    localStorage.getItem(LkRudnRu.CheckInRooms) || '[]'
  ) as LocalStorageRoomData[]
);

const checkinRunning = ref<string[]>([]);


async function navigate_to_room_page(uuid: string) {
  await router.push({ 'name': 'lk-room', 'params': { 'uuid': uuid } });
}

function onDelete(uuid: string) {
  const deletedEntry = rooms.value.find((room) => room.uuid === uuid);
  if (deletedEntry !== undefined) {
    rooms.value = rooms.value.filter((room) => room.uuid !== uuid);
    localStorage.setItem(LkRudnRu.CheckInRooms, JSON.stringify(rooms.value));

    // Show notification with undo action
    Notify.create({
      message: `Deleted ${deletedEntry.short_name}`,
      color: 'red',
      progress: true,
      timeout: 5000,
      actions: [
        {
          label: 'Undo',
          color: 'white',
          handler: () => {
            onRestore(deletedEntry);
          },
        },
      ],
    });
  }
}

function onRestore(entry: LocalStorageRoomData) {
  // add to start
  rooms.value.unshift(entry);
  localStorage.setItem(LkRudnRu.CheckInRooms, JSON.stringify(rooms.value));
}

async function quickCheckin(entry: LocalStorageRoomData, token: string, reset: () => void) {
  checkinRunning.value.push(entry.uuid);
  try {
    // resp = session.post('https://mobapp-api.rudn.ru/qr-scan/v1.0/attend-start',
    //  json={
    //  'auditorium_guid': audit_id
    //  },
    //  headers={
    //  'Authorization': f'Bearer {token}',

    const resp = await fetch('https://mobapp-api.rudn.ru/qr-scan/v1.0/attend-start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify({
        'auditorium_guid': entry.uuid,
      })
    });

    if (resp.status === 401) {
      Notify.create({
        message: 'Token expired, renewing...',
        type: 'warning',
      });
      tokenStore.reset();
      return;
    }

    if (!resp.ok) {
      throw new Error('Check-in request returned unexpected status: ' + resp.status + ' ' + resp.statusText);
    }

    const data: {
      data: {
        success: boolean,
        message: string,
      }
    } = await resp.json();

    if (data.data.success) {
      Notify.create({
        message: 'Server responds: ' + data.data.message,
        type: 'positive',
        progress: true,
        timeout: 3000,
      });
    } else {
      Notify.create({
        message: 'Server responds: ' + data.data.message,
        type: 'negative',
        progress: true,
        timeout: 3000,
      });
    }
  }
  catch (ex) {
    alert("Error sending check-in request. Network errors? " + (ex as any));
  }
  finally {
    reset();
    checkinRunning.value = checkinRunning.value.filter((uuid) => uuid !== entry.uuid);
  }
}


</script>
