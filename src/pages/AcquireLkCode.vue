<template>
  <q-page class="column items-center justify-center q-gutter-sm">
    <p v-if="!step2_started">Acquiring OAuth code for lk.rudn.ru...</p>
    <p v-if="step2_started">Trading OAuth code for token...</p>
    <q-spinner color="primary" size="3em" />
  </q-page>
</template>

<script setup lang="ts">

import { useRouter } from 'vue-router';
import { onMounted, ref } from 'vue';
import { IdRudnRu, LkRudnRu } from 'src/consts/store-consts';
import type { GenericResponse, LkRudnAuthResponse } from 'src/api/types';

const step2_started = ref(false);

const router = useRouter();
onMounted(oauth_step1);

async function oauth_step1() {
  const token = localStorage.getItem(IdRudnRu.AccessToken);
  if (token === null) {
    alert('No token for id.rudn.ru found, please try logging in from the start');
    await router.replace({ 'name': 'login' });
    return;
  }

  try {

    const resp = await fetch('https://id-api.rudn.ru/api/v1/auth/continue/code?client_id=b0db4756-9468-4a9e-b399-17b546b6ea88&redirect_uri=https://mobapp-api.rudn.ru/token-rudn-id&response_type=code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
    });

    if (resp.ok) {
      const data: GenericResponse = await resp.json();
      if (typeof (data.data) === 'string') {
        step2_started.value = true;
        await oauth_step2(data.data);
      } else {
        alert("Error acquiring OAuth code: " + JSON.stringify(data.error));
        await router.replace({ 'name': 'login' });
      }
    }

  } catch (ex) {
    alert("Error sending OAuth code request. Network errors? " + (ex as any));
    await router.replace({ 'name': 'login' });
  }
};

async function oauth_step2(received_code_url: string) {
  const replaced = received_code_url.replace('https://mobapp-api.rudn.ru/token-rudn-id', 'https://mobapp-api.rudn.ru/v1/auth/token-rudn-id');
  try {
    const resp = await fetch(replaced, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer null',
      },
    });

    if (!resp.ok) {
      const data: GenericResponse = await resp.json();
      alert("Error trading OAuth code for lk.rudn.ru token: " + JSON.stringify(data.error));
      await router.replace({ 'name': 'login' });
    } else {
      const data: LkRudnAuthResponse = await resp.json();
      localStorage.setItem(LkRudnRu.AccessToken, data.data.token);
      localStorage.setItem(LkRudnRu.SuccessfulAccess, "true");
      await router.replace({ 'name': 'hub' });
    }
  } catch (ex) {
    alert("Error trading OAuth code for lk.rudn.ru token. Network errors? " + (ex as any));
    await router.replace({ 'name': 'login' });
  }
}

</script>
