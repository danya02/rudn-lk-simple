<template>
  <q-page v-if="thisRoom !== null">
    <h5>{{ thisRoom.name }}</h5>

    <div v-if="loading_main" class="column items-center q-gutter-sm">
      <q-spinner color="primary" size="3em" />
      <p>Loading main info...</p>
    </div>
    <div v-else>
      <q-toggle v-model="jsonVisible" label="Show JSON" />
      <q-slide-transition>

        <q-card v-show="jsonVisible" bordered>
          <q-card-section>
            <p>Local saved data:</p>
            <pre>{{ thisRoom }}</pre>
          </q-card-section>
          <q-card-section>
            <p>Fetched data:</p>
            <pre>{{ roomDataDownload }}</pre>
          </q-card-section>
        </q-card>
      </q-slide-transition>

      <p>Viewing schedule for date:
        <q-badge color="primary">{{ selectedDate }}</q-badge>
        <q-btn icon="event" round color="accent">
          <q-popup-proxy cover transition-show="scale" transition-hide="scale">
            <q-date v-model="selectedDate" today-btn no-unset @navigation="v => loadLectureDays(v)"
              @update:model-value="v => thisRoom == null ? null : loadLectures(thisRoom, v)" :events="daysWithLectures"
              mask="YYYY-MM-DD">
              <div class="row items-center justify-end">
                <q-spinner color="accent" size="2em" v-if="isLoadingDaysWithLectures" />
              </div>
            </q-date>
          </q-popup-proxy>
        </q-btn>
      </p>

      <q-card v-if="isLoadingLectures" bordered>
        <q-card-section>
          <q-spinner color="primary" size="3em" />
          <p>Loading schedule for {{ selectedDate }}...</p>
        </q-card-section>
      </q-card>

      <div v-else>
        <p v-if="currentDayLectureData === null" class="text-positive">No schedule for {{ selectedDate }} is available
        </p>
        <div v-else>
          <p v-if="currentDayLectureData?.is_upper_week">This is a day in the
            <q-badge color="primary">upper week</q-badge>
          </p>
          <p v-else> This is a day in the <q-badge color="accent">lower week</q-badge></p>
          <q-timeline side="right" color="accent">
            <q-timeline-entry v-for="lecture in currentDayLectureData?.data" :key="lecture.id" :title="lecture.name"
              :subtitle="date.formatDate(lecture.start, 'HH:mm') + ' - ' + date.formatDate(lecture.end, 'HH:mm')">
              <div>
                Teacher: {{ lecture.lecture.fio }}
                <a :href="'mailto:' + lecture.lecture.email">({{ lecture.lecture.email }})</a>
              </div>
              <div>
                Group: {{ lecture.study_group.name }} ({{ lecture.study_group.abbreviation }})
              </div>
            </q-timeline-entry>
          </q-timeline>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { date, Notify } from 'quasar';
import type { LocalStorageRoomData } from 'src/api/types';
import { LkRudnRu } from 'src/consts/store-consts';
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

interface LectureData {
  is_upper_week: boolean,
  data: Lecture[],
}
interface Lecture {
  //         {
  //     "id": 5312803,
  //     "room": 736,
  //     "name": "Методы оптимизации",
  //     "comment": "",
  //     "start": "2025-10-01T15:00:00+03:00",
  //     "end": "2025-10-01T16:20:00+03:00",
  //     "lecture": {
  //         "id": 10510,
  //         "fio": "Максимова Ирина Сергеевна",
  //         "email": "1030990477@rudn.ru"
  //     },
  //     "lecture_is_active": false,
  //     "is_upper_week": true,
  //     "study_group": {
  //         "id": 71599,
  //         "name": "НМТбд-01-22",
  //         "abbreviation": "ФМиЕН",
  //         "faculty": {
  //             "id": 37,
  //             "name": "Факультет физико-математических и естественных наук"
  //         }
  //     }
  // }
  id: number,
  name: string,
  comment: string,
  start: string,
  end: string,
  lecture: {
    fio: string,
    email: string,
  },
  lecture_is_active: boolean,
  study_group: {
    name: string,
    abbreviation: string,
  }
}

const route = useRoute();
const router = useRouter();

const loading_main = ref(true);
const jsonVisible = ref(false);

const roomDataDownload = ref<any>(null);

const daysWithLectures = ref<string[]>([]);
const currentDayLectureData = ref<LectureData | null>(null);

const isLoadingDaysWithLectures = ref(true);
const isLoadingLectures = ref(true);

// date in YYYY-MM-DD
const currentDate = date.formatDate(new Date(), 'YYYY-MM-DD');
const selectedDate = ref(currentDate);

const savedRooms = JSON.parse(
  localStorage.getItem(LkRudnRu.CheckInRooms) || '[]'
) as LocalStorageRoomData[];

const thisRoom = ref<LocalStorageRoomData | null>(null);

onMounted(async () => {
  const uuid = route.params.uuid;
  if (uuid === null || uuid === undefined || uuid === '') {
    console.log("No uuid in route params");
    await router.replace({ 'name': 'lk-checkin' });
  }

  // Check that we have a saved room for this
  const savedRoom = savedRooms.find((room) => room.uuid === uuid);
  if (savedRoom === undefined || savedRoom === null) {
    console.log("No saved room for this uuid");
    await router.replace({ 'name': 'lk-checkin' });
    return;
  }

  thisRoom.value = savedRoom;

  await loadRoom();
})

async function loadRoom() {
  try {
    // GET https://api-qr.rudn.ru/api/v1/lecture_room/room/e3ac8763-ba12-4549-ae67-efcf37349246/

    if (thisRoom.value === null) {
      return;
    }
    const resp = await fetch(`https://api-qr.rudn.ru/api/v1/lecture_room/room/${thisRoom.value?.uuid}/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (resp.ok) {
      roomDataDownload.value = await resp.json();

      const data: {
        uuid_url: string,
        name: string,
        room: {
          id: number,
          short_name: string
        }
      } = roomDataDownload.value;

      const newEntry: LocalStorageRoomData = {
        uuid: data.uuid_url,
        name: data.name,
        short_name: data.room.short_name,
        room_id: data.room.id,
      };

      // Save the new room info into the array
      const thisRoomIndex = savedRooms.findIndex((room) => room.uuid === thisRoom.value?.uuid);
      savedRooms[thisRoomIndex] = newEntry;
      localStorage.setItem(LkRudnRu.CheckInRooms, JSON.stringify(savedRooms));
    } else {
      Notify.create({
        message: 'Failed to load actual room info',
        type: 'negative',
      });
    }
  }
  catch (ex) {
    Notify.create({
      message: 'Failed to load actual room info: ' + (ex as any),
      type: 'negative',
    });
  }
  finally {
    loading_main.value = false;
  }

  const today = new Date();
  const thisYear = today.getFullYear();
  const thisMonth = today.getMonth() + 1;
  await loadLectureDays(
    {
      year: thisYear,
      month: thisMonth
    }
  );
}

async function loadLectureDays(view: { year: number, month: number }) {
  isLoadingDaysWithLectures.value = true;
  const { year, month } = view;
  const monthS = month.toString().padStart(2, '0');

  const firstDay = `${year}-${monthS}-01`;
  const daysInMonth = date.daysInMonth(new Date(year, month - 1, 1));
  const lastDay = `${year}-${monthS}-${daysInMonth}`;

  try {
    // https://api-qr.rudn.ru/api/v1/lecture_room/schedule/e3ac8763-ba12-4549-ae67-efcf37349246/2025-09-29/2025-10-05/

    const resp = await fetch(`https://api-qr.rudn.ru/api/v1/lecture_room/schedule/${thisRoom.value?.uuid}/${firstDay}/${lastDay}/`, {
      method: 'GET',
    });
    if (resp.ok) {
      const data: {
        has_lecture: Map<string, boolean>,
      } = await resp.json();

      console.log(data);

      for (const [key, value] of Object.entries(data.has_lecture)) {
        if (value === true) {
          daysWithLectures.value.push(key.replaceAll('-', '/'));
        }
      }
    } else {
      Notify.create(
        {
          message: 'Failed to load room schedule for range: ' + firstDay + ' to ' + lastDay + ': ' + resp.status + ' ' + resp.statusText,
          type: 'negative',
        }
      )
    }
  } catch (ex) {
    Notify.create(
      {
        message: 'Failed to load room schedule for range: ' + firstDay + ' to ' + lastDay + ': ' + (ex as any),
        type: 'negative',
      }
    )
  } finally {
    isLoadingDaysWithLectures.value = false;
  }

  if (thisRoom.value != null) {
    await loadLectures(thisRoom.value, selectedDate.value);
  }
}

async function loadLectures(info: LocalStorageRoomData, day: string) {
  isLoadingLectures.value = true;
  try {
    // https://api-qr.rudn.ru/api/v1/lecture_room/schedule/736/2025-10-01/
    const resp = await fetch(`https://api-qr.rudn.ru/api/v1/lecture_room/schedule/${info.room_id}/${day}/`, {
      method: 'GET',
    });

    if (resp.ok) {
      currentDayLectureData.value = await resp.json();
      console.log("Fetched schedule for " + day, currentDayLectureData.value);
    } else if (resp.status === 404) {
      currentDayLectureData.value = null;
    } else {
      currentDayLectureData.value = null;
      Notify.create(
        {
          message: 'Failed to load lectures for ' + day + ': ' + resp.status + ' ' + resp.statusText,
          type: 'negative',
        }
      )
    }
  } catch (ex) {
    Notify.create(
      {
        message: 'Failed to load lectures for ' + day + ': ' + (ex as any),
        type: 'negative',
      }
    )
  } finally {
    isLoadingLectures.value = false;
  }
}
</script>
