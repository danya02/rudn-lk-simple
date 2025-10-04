<template>
  <q-skeleton v-if="loading" type="text" />
  <span v-else>
    {{ nameRef }}
  </span>
</template>

<script setup lang="ts">
import type { LkRudnMeResponse } from 'src/api/types';
import { ref, watch } from 'vue';


const nameRef = ref('(unknown name...)');
const loading = ref(true);

const { token } = defineProps<{ token: string }>();

watch(() => token, async (token) => {
  loading.value = true;
  try {
    const resp = await fetch('https://mobapp-api.rudn.ru/v3/person/me', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
    });
    if (resp.ok) {
      const data: LkRudnMeResponse = await resp.json();
      nameRef.value = data.data.person.surname_rus + " " + data.data.person.name_rus + " " + data.data.person.patronymic_rus;
    }
  } catch (ex) {
    console.error(ex);
  }
  loading.value = false;
},
  { immediate: true });

</script>
