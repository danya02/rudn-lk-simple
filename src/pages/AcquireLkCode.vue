<template>
  <q-page class="column items-center justify-center q-gutter-sm">
    <p v-if="!step2_started">Acquiring OAuth code for lk.rudn.ru...</p>
    <p v-if="step2_started">Trading OAuth code for token...</p>
    <q-spinner color="primary" size="3em" />
  </q-page>
</template>

<script setup lang="ts">

import { getOAuthCode, redeemOAuthCode } from 'src/api/auth';
import { errorMessage, statusOf } from 'src/api/client';
import type { GenericResponse } from 'src/api/types';
import { IdRudnRu, LkRudnRu } from 'src/consts/store-consts';
import { notifyError } from 'src/utils/notify';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const step2_started = ref(false);

const router = useRouter();
onMounted(oauth_step1);

async function oauth_step1() {
  const token = localStorage.getItem(IdRudnRu.AccessToken);
  if (token === null) {
    notifyError('No token for id.rudn.ru found, please try logging in from the start');
    await router.replace({ name: 'login' });
    return;
  }

  let data: GenericResponse;
  try {
    data = await getOAuthCode(token);
  } catch (e) {
    if (statusOf(e) !== null) {
      notifyError('Error acquiring OAuth code: ' + errorMessage(e));
    } else {
      notifyError('Error sending OAuth code request. ' + errorMessage(e));
    }
    await router.replace({ name: 'login' });
    return;
  }

  if (typeof data.data === 'string') {
    step2_started.value = true;
    await oauth_step2(data.data);
  } else {
    notifyError('Error acquiring OAuth code: ' + JSON.stringify(data.error));
    await router.replace({ name: 'login' });
  }
}

async function oauth_step2(received_code_url: string) {
  try {
    const data = await redeemOAuthCode(received_code_url);
    localStorage.setItem(LkRudnRu.AccessToken, data.data.token);
    localStorage.setItem(LkRudnRu.SuccessfulAccess, 'true');
    await router.replace({ name: 'hub' });
  } catch (e) {
    if (statusOf(e) !== null) {
      notifyError('Error trading OAuth code for lk.rudn.ru token: ' + errorMessage(e));
    } else {
      notifyError('Error trading OAuth code for lk.rudn.ru token. ' + errorMessage(e));
    }
    await router.replace({ name: 'login' });
  }
}

</script>
