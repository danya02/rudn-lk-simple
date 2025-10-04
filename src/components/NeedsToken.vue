<template>

  <q-skeleton :type="props.type" :width="props.width" :height="props.height"
    v-if="token_ref.token.value === '' || token_ref.token.value === null || token_ref.token.value === undefined" />
  <slot v-if="token_ref.token.value !== '' && token_ref.token.value !== null && token_ref.token.value !== undefined"
    :token="token_ref.token.value"></slot>

</template>

<script lang="ts">
type SkeletonType = "text"
  | "rect"
  | "circle"
  | "QBtn"
  | "QBadge"
  | "QChip"
  | "QToolbar"
  | "QCheckbox"
  | "QRadio"
  | "QToggle"
  | "QSlider"
  | "QRange"
  | "QInput"
  | "QAvatar"
  | undefined
</script>

<script setup lang="ts">

import { storeToRefs } from 'pinia';
import { useTokenStore } from 'src/stores/lk_rudn';
import { onMounted } from 'vue';

interface Props {
  type?: SkeletonType,
  width?: string,
  height?: string,
}

const props = defineProps<Props>();

const token_store = useTokenStore();
const token_ref = storeToRefs(token_store);

onMounted(() => {
  if (token_ref.token.value === '' || token_ref.token.value === null || token_ref.token.value === undefined) {
    token_store.reset();
  }
});

</script>
