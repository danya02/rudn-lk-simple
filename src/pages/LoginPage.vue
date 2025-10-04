<template>
  <q-page class="column items-center justify-center q-gutter-lg">
    <form class="column items-center justify-center q-gutter-lg" style="width: 100%">
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
import type { LoginResponse } from 'src/api/types';
import { IdRudnRu } from 'src/consts/store-consts';
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
  let resp;
  try {
    resp = await fetch('https://id-api.rudn.ru/api/v1/auth/sign-in', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: username.value,
        password: password.value,
        ad_person_id: null,
      })
    });
  } catch (e) {
    alert("Error sending login request. Network errors? " + (e as any));
    return;
  } finally {
    isLoading.value = false;
  }

  const data: LoginResponse = await resp.json();

  if (data.error != null) {
    error.value = data.error.type + ": " + data.error.description;
  }
  else if (data.data != null) {
    if (data.data.need_auth) {
      alert("The response contained the need_auth flag. The app might not work properly from this point.");
    }

    if (data.data.accounts.length === 0) {
      alert('The login response contained no accounts. This means you do not have any identities in id.rudn.ru. The app might not work properly from this point.');
    }

    localStorage.setItem(IdRudnRu.Username, username.value);
    localStorage.setItem(IdRudnRu.Password, password.value);
    localStorage.setItem(IdRudnRu.AccessToken, data.data.access_token);
    localStorage.setItem(IdRudnRu.AccessTokenExpires, data.data.expires_in);

    if (data.data.accounts.length === 1) {
      localStorage.setItem(IdRudnRu.SelectedAdPersonId, data.data.accounts[0]!.ad_person_id);
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
  width: 50%;
}
</style>
