<template>
  <q-skeleton v-if="loading" type="text" />
  <span v-else>
    {{ nameRef }}
  </span>
</template>

<script setup lang="ts">
import { getMe } from 'src/api/person';
import { ref, watch } from 'vue';


const nameRef = ref('(unknown name...)');
const loading = ref(true);

const { token } = defineProps<{ token: string }>();

watch(() => token, async (token) => {
  loading.value = true;
  try {
    const data = await getMe(token);
    nameRef.value = data.data.person.surname_rus + " " + data.data.person.name_rus + " " + data.data.person.patronymic_rus;
  } catch (ex) {
    // Failure leaves the '(unknown name...)' placeholder in place; only log it.
    console.error(ex);
  }
  loading.value = false;
},
  { immediate: true });

</script>
