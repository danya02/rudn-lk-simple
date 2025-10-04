<script setup lang="ts">
import ShowPersonName from 'src/components/api/ShowPersonName.vue';
import NeedsToken from 'src/components/NeedsToken.vue';
</script>

<template>
  <q-page class="column">
    <h5>
      <NeedsToken type="text" v-slot="{ token }">
        Welcome,
        <ShowPersonName :token="token" />!
      </NeedsToken>
    </h5>
    <p>From here, you can:</p>

    <div class="column q-gutter-lg">
      <router-link :to="{ name: 'qr-code' }" custom v-slot:default="props">
        <q-btn class="fullwidth" color="primary" label="Display QR code" v-bind="props" />
      </router-link>
      <router-link :to="{ name: 'checkin' }" custom v-slot:default="props">
        <q-btn class="fullwidth" color="primary" label="Check in at a room" v-bind="props" />
      </router-link>
    </div>
  </q-page>
</template>
