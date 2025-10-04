<script setup lang="ts">
import { LkRudnRu } from 'src/consts/store-consts';
import { useRouter } from 'vue-router';

const router = useRouter();

if (localStorage.getItem(LkRudnRu.SuccessfulAccess)) {
  await router.replace({ 'name': 'hub' });
} else {
  await router.replace({ 'name': 'login' });
}
</script>
