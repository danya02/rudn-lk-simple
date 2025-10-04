<template>
  <NeedsToken v-slot="{ token }" type="rect">
    <QrPass :token="token" />
  </NeedsToken>
</template>


<script setup lang="ts">
import QrPass from 'src/components/api/QrPass.vue';
import NeedsToken from 'src/components/NeedsToken.vue';


</script>
