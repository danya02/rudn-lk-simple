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
import type { GenericResponse, LoginAccount } from 'src/api/types';
import { IdRudnRu } from 'src/consts/store-consts';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const loading = ref(false);
const current_option_id = ref("");

const router = useRouter();


const options: LoginAccount[] = JSON.parse(localStorage.getItem(IdRudnRu.AdPersonOptions) || '[]');

async function onclick(option: LoginAccount) {
  loading.value = true;
  current_option_id.value = option.ad_person_id;

  // become the new account
  try {
    const resp = await fetch('https://id-api.rudn.ru/api/v1/auth/continue/replace', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem(IdRudnRu.AccessToken),
      },
      body: JSON.stringify({
        id: option.ad_person_id,
      })
    });

    if (resp.ok) {
      localStorage.setItem(IdRudnRu.SelectedAdPersonId, option.ad_person_id);
      await router.replace({ 'name': 'acquire-lk-code' });
    } else {
      const data: GenericResponse = await resp.json();
      alert("Error replacing account identity: " + JSON.stringify(data.error));
    }

  } catch (ex) {
    alert("Error sending account replace request. Network errors? " + (ex as any));
  } finally {
    loading.value = false;
    current_option_id.value = "";
  }
}
</script>
