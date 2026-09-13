<template>
  <q-page class="window-width row justify-center items-center">
    <form class="column items-center q-gutter-lg" style="width: 100%">
      <q-input class="halfwidth" standout v-model="username" label="Email or phone" :loading="isLoading"
        :disable="isLoading" />
      <q-input class="halfwidth" standout v-model="password" label="Password" type="password" :loading="isLoading"
        :disable="isLoading" />
      <div v-if="error" style="color: red">
        {{ error }}
      </div>
      <q-btn class="halfwidth" style="height: 5rem" color="primary" label="Login" type="submit" @click="login"
        :loading="isLoading" :disable="isLoading" />
    </form>
  </q-page>
</template>

<script setup lang="ts">
import { signIn } from 'src/api/auth';
import { errorMessage } from 'src/api/client';
import type { LoginResponse } from 'src/api/types';
import { IdRudnRu } from 'src/consts/store-consts';
import { notifyError } from 'src/utils/notify';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const username = ref(localStorage.getItem(IdRudnRu.Username) || '');
const password = ref(localStorage.getItem(IdRudnRu.Password) || '');
const error = ref('');

const isLoading = ref(false);


async function login(event: Event) {
  // block button and form fields
  isLoading.value = true;

  event.preventDefault();

  // POST to https://id-api.rudn.ru/api/v1/auth/sign-in
  let data: LoginResponse;
  try {
    data = await signIn(username.value, password.value);
  } catch (e) {
    notifyError('Error sending login request. ' + errorMessage(e));
    return;
  } finally {
    isLoading.value = false;
  }

  if (data.error != null) {
    error.value = data.error.type + ': ' + data.error.description;
  }
  else if (data.data != null) {
    if (data.data.accounts.length === 0) {
      notifyError('The login response contained no accounts. This means you do not have any identities in id.rudn.ru. The app might not work properly from this point.');
    }

    localStorage.setItem(IdRudnRu.Username, username.value);
    localStorage.setItem(IdRudnRu.Password, password.value);
    localStorage.setItem(IdRudnRu.AccessToken, data.data.access_token);

    if (data.data.accounts.length === 1) {
      localStorage.setItem(IdRudnRu.SelectedAdPersonId, String(data.data.accounts[0]!.ad_person_id));
      await router.replace({ 'name': 'acquire-lk-code' });
    } else {
      localStorage.setItem(IdRudnRu.AdPersonOptions, JSON.stringify(data.data.accounts));
      // navigate to PickAccount page
      await router.replace({ name: 'pick-account' });
    }
  } else {
    error.value = "Server didn't set either an error or a data response.";
  }
}
</script>

<style lang="scss" scoped>
.halfwidth {
  width: 75%;
}
</style>
