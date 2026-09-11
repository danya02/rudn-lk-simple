<template>
  <q-page class="column items-center justify-center q-gutter-sm">
    <p>You have multiple accounts, please pick one to use.</p>
    <p>Note that the chosen account will be remembered until you log out.</p>
    <q-list bordered separator>
      <div v-for="option in options" :key="option.ad_person_id">
        <q-item v-ripple clickable @click="_ev => onclick(option)" :active="option.ad_person_id === current_option_id"
          :disable="loading">
          <q-item-section>
            <q-item-label>{{ option.email }}</q-item-label>
            <q-item-label caption>{{ option.fio }} &mdash; {{ option.ad_person_id }}</q-item-label>

          </q-item-section>
          <!-- loading indicator if needed -->
          <q-item-section avatar>
            <q-spinner v-if="loading && current_option_id === option.ad_person_id" color="accent" size="2em" />
          </q-item-section>
        </q-item>
      </div>
    </q-list>
  </q-page>
</template>

<script setup lang="ts">
import { continueDirect, signIn } from 'src/api/auth';
import { errorMessage, statusOf } from 'src/api/client';
import type { ContinueResponse, LoginAccount, LoginData } from 'src/api/types';
import { IdRudnRu } from 'src/consts/store-consts';
import { notifyError } from 'src/utils/notify';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const loading = ref(false);
const current_option_id = ref("");

const router = useRouter();


const options: LoginAccount[] = JSON.parse(localStorage.getItem(IdRudnRu.AdPersonOptions) || '[]');
const username = ref(localStorage.getItem(IdRudnRu.Username) || '');
const password = ref(localStorage.getItem(IdRudnRu.Password) || '');


async function onclick(option: LoginAccount) {
  loading.value = true;
  current_option_id.value = option.ad_person_id;

  // login again as the new account
  try {
    let loginData: LoginData;
    try {
      // The ephemeral token from the first sign-in is sent along, as the
      // original inline fetch did.
      loginData = (await signIn(username.value, password.value, Number(option.ad_person_id),
        localStorage.getItem(IdRudnRu.AccessToken))).data;
    } catch (e) {
      if (statusOf(e) !== null) {
        notifyError('Error logging in as new identity: ' + errorMessage(e));
      } else {
        notifyError('Error logging in with identity. ' + errorMessage(e));
      }
      return;
    }

    localStorage.setItem(IdRudnRu.SelectedAdPersonId, option.ad_person_id);

    // After getting the initial token, we need to trade it for the real token:
    let continueResp: ContinueResponse;
    try {
      continueResp = await continueDirect(loginData.access_token);
    } catch (e) {
      if (statusOf(e) !== null) {
        notifyError('Error in continue/direct call: ' + errorMessage(e));
      } else {
        notifyError('Error logging in with identity. ' + errorMessage(e));
      }
      return;
    }

    if (continueResp.token_type !== 'Bearer') {
      notifyError("In continue/direct call, token_type is not 'Bearer', but: " + JSON.stringify(continueResp) + ' App may not work properly from this point.');
    }

    localStorage.setItem(IdRudnRu.AccessToken, continueResp.access_token);
    await router.replace({ 'name': 'acquire-lk-code' });
  } finally {
    loading.value = false;
    current_option_id.value = '';
  }
}
</script>
