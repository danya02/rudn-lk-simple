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

      <!-- Screen controls belong with the Refresh button rather than below the
           page, where they pushed it past its own height and made it scroll. -->
      <slot name="controls" />
    </q-page>
  </q-pull-to-refresh>
</template>

<script setup lang="ts">
import { QrcodeCanvas } from 'qrcode.vue';
import { errorMessage, statusOf } from 'src/api/client';
import { generatePass } from 'src/api/person';
import { LkRudnRu } from 'src/consts/store-consts';
import { useTokenStore } from 'src/stores/lk_rudn';
import { notifyError } from 'src/utils/notify';
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
  loading.value = true;
  try {
    const data = await generatePass(token);
    code.value = data.data.pacs_num;
    localStorage.setItem(LkRudnRu.PacsCode, code.value);
    // Only cleared on success: a stale code must keep its "may be outdated" warning.
    outdated.value = false;
  } catch (ex) {
    if (statusOf(ex) === 401) {
      token_store.reset();
    } else {
      notifyError(errorMessage(ex));
    }
  } finally {
    loading.value = false;
    done();
  }
}
</script>
