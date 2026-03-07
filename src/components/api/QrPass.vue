<template>
  <q-pull-to-refresh @refresh="done => run_refresh(token, done)">
    <q-page class="column items-center q-gutter-lg">
      <div class="column items-center q-gutter-lg">
        <div v-if="code !== null && code !== ''">
          <QrcodeCanvas :value="code" :size="300" :margin="4" level="H" />
          <p>
            Your pass code's value is:
            {{ code }}
          </p>
          <p style="color: red;" v-if="outdated">Last seen code is displayed; may be outdated!</p>
        </div>
      </div>

      <q-spinner v-if="loading" size="3em" />

      <q-btn style="width: 50%" color="primary" label="Refresh" @click="run_refresh(token)" :loading="loading"
        :disable="loading" />
    </q-page>
  </q-pull-to-refresh>
</template>

<script setup lang="ts">
import { QrcodeCanvas } from 'qrcode.vue';
import type { QrPassResponse } from 'src/api/types';
import { LkRudnRu } from 'src/consts/store-consts';
import { useTokenStore } from 'src/stores/lk_rudn';
import { ref, watch } from 'vue';

const { token } = defineProps<{ token: string }>()

const code = ref(localStorage.getItem(LkRudnRu.PacsCode));
const loading = ref(true);
const outdated = ref(true);

watch(() => token, (token) => run_refresh(token), {
  immediate: true
});

const token_store = useTokenStore();

async function run_refresh(token: string, done: () => void = () => { }) {
  // code.value = '';
  loading.value = true;
  try {
    const resp = await fetch('https://mobapp-api.rudn.ru/v3/person/generate-pass', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
    });
    if (resp.ok) {
      const data: QrPassResponse = await resp.json();
      code.value = data.data.pacs_num;
      localStorage.setItem(LkRudnRu.PacsCode, code.value);

    } else {
      token_store.reset();
    }
  } catch (ex) {
    alert("Error generating QR pass. Network errors? Try refreshing: " + (ex as any));
  } finally {
    loading.value = false;
    outdated.value = false;
    done();
  }
}
</script>
