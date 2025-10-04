<template>
  <q-linear-progress indeterminate color="warning" v-if="running" />
  <q-linear-progress size="25px" :value="progress_bar_value" color="accent" v-if="running">
    <div class="absolute-full flex flex-center">
      <q-badge color="white" text-color="accent" :label="progress_bar_text" />
    </div>
  </q-linear-progress>
  <q-banner inline-actions class="text-white bg-red" v-if="full_failure">
    Could not recover your session automatically.
    Please log in manually.
    <template v-slot:action>
      <q-btn flat color="white" label="Log in" @click="restart_auth" />
    </template>
  </q-banner>
</template>

<script setup lang="ts">
import { Notify } from 'quasar';
import type { GenericResponse, LkRudnAuthResponse, LoginResponse } from 'src/api/types';
import { IdRudnRu, LkRudnRu, reset_all_auth } from 'src/consts/store-consts';
import { useTokenStore } from 'src/stores/lk_rudn';
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';


const running = ref(false);
const progress_bar_value = ref(0);
const progress_bar_text = ref("");

const full_failure = ref(false);

const token_store = useTokenStore();
const router = useRouter();

enum Outcome {
  Ok,
  FailRollup,
}

onMounted(refresh);

defineExpose({
  refresh,
  force_refresh,
});

// watch(() => token_store.token, async () => {
//   if (token_store.token === '' || token_store.isNull) {
//     await refresh();
//   }
// });

watch(() => token_store.reset_at, refresh);

async function force_refresh() {
  token_store.reset();
  await refresh();
}

async function refresh() {
  console.log(JSON.stringify(token_store.token));
  token_store.is_ready = false;
  const steps = [
    login_password,
    become_proper_user_id,
    trade_id_for_lk_token,
    final_check,
  ];

  let current_step_to_run = steps.length - 1;
  let steps_budget = 10;

  running.value = true;
  full_failure.value = false;

  while (current_step_to_run >= 0 && current_step_to_run < steps.length) {
    progress_bar_value.value = (steps.length - current_step_to_run) / steps.length;
    progress_bar_text.value = steps[current_step_to_run]?.name ?? "";

    if (steps_budget <= 0) {
      full_failure.value = true;
      running.value = false;
      break;
    }

    const fn = steps[current_step_to_run] as (() => Promise<Outcome>);
    let outcome;
    try {
      console.log("Running step: " + fn.name);
      outcome = await fn();
    } catch (ex) {
      Notify.create({
        message: 'Network error in ' + fn.name + ': ' + (ex as any),
        color: 'negative',
        position: 'top',
        progress: true,
      });
      outcome = Outcome.FailRollup;
    }
    steps_budget -= 1;

    console.log("Outcome for step " + fn.name + ": " + outcome);

    if (outcome === Outcome.FailRollup) {
      current_step_to_run -= 1;
      console.log("FailRollup in " + fn.name + ", next running " + current_step_to_run);
    }
    else {
      current_step_to_run += 1;
      console.log("Success in " + fn.name + ", next running " + current_step_to_run);
    }
  }
  running.value = false;
  token_store.is_ready = true;

  Notify.create({
    message: 'Token refresh OK!',
    color: 'positive',
    position: 'top',
    progress: true,
  });

}

async function final_check(): Promise<Outcome> {
  const token = localStorage.getItem(LkRudnRu.AccessToken);

  if (token === null || token === undefined) {
    console.log("Token is null");
    return Outcome.FailRollup;
  }

  // get 'me' data:
  // https://mobapp-api.rudn.ru/v3/person/me

  try {
    const resp = await fetch('https://mobapp-api.rudn.ru/v3/person/me', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
    });
    if (resp.ok) {
      // The token is still valid
      console.log("Token is valid");
      token_store.token = token;
      localStorage.setItem(LkRudnRu.SuccessfulAccess, "true");
      return Outcome.Ok;
    } else {
      // The token is not valid, need to proceed to previous step
      console.log("Token is not valid, need to refresh");
      token_store.token = 'null';
      localStorage.removeItem(LkRudnRu.AccessToken);
      return Outcome.FailRollup;
    }
  } catch (ex) {
    Notify.create({
      message: 'Network error in verify step: ' + (ex as any),
      color: 'negative',
      position: 'top',
      progress: true,
    });
    return Outcome.FailRollup;
  }
}

async function trade_id_for_lk_token(): Promise<Outcome> {
  const id_token = localStorage.getItem(IdRudnRu.AccessToken);
  const id_token_expires = localStorage.getItem(IdRudnRu.AccessTokenExpires);
  if (id_token === null) {
    return Outcome.FailRollup;
  }
  if (id_token_expires === null) {
    return Outcome.FailRollup;
  }

  // parse id_token_expires as date like:
  // 2025-09-20 20:35:19
  const id_token_expires_date = new Date(id_token_expires + ' UTC');
  if (id_token_expires_date < new Date()) {
    // The id.rudn.ru token has expired, needs to re-login with password
    localStorage.removeItem(IdRudnRu.AccessToken);
    localStorage.removeItem(IdRudnRu.AccessTokenExpires);
    return Outcome.FailRollup;
  }

  // Use token to acquire OAuth link

  try {
    const resp = await fetch('https://id-api.rudn.ru/api/v1/auth/continue/code?client_id=b0db4756-9468-4a9e-b399-17b546b6ea88&redirect_uri=https://mobapp-api.rudn.ru/token-rudn-id&response_type=code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + id_token,
      },
    });
    if (resp.ok) {
      const data: GenericResponse = await resp.json();
      if (typeof (data.data) === 'string') {
        // Got OAuth link,
        // now we query that to get lk.rudn.ru token
        const replaced = data.data.replace('https://mobapp-api.rudn.ru/token-rudn-id', 'https://mobapp-api.rudn.ru/v1/auth/token-rudn-id');
        const resp = await fetch(replaced, {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer null',
          },
        });

        if (!resp.ok) {
          return Outcome.FailRollup;
        } else {
          const data: LkRudnAuthResponse = await resp.json();
          localStorage.setItem(LkRudnRu.AccessToken, data.data.token);
          token_store.token = data.data.token;
          return Outcome.Ok;
        }
      } else {
        return Outcome.FailRollup;
      }
    } else {
      return Outcome.FailRollup;
    }

  } catch (ex) {
    Notify.create({
      message: 'Network error in trade step: ' + (ex as any),
      color: 'negative',
      position: 'top',
      progress: true,
    });
    return Outcome.FailRollup;
  }
}

async function become_proper_user_id(): Promise<Outcome> {
  const ad_person_id = Number(localStorage.getItem(IdRudnRu.SelectedAdPersonId));
  const resp = await fetch('https://id-api.rudn.ru/api/v1/auth/continue/replace', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + localStorage.getItem(IdRudnRu.AccessToken),
    },
    body: JSON.stringify({
      id: ad_person_id,
    })
  });

  if (!resp.ok) {
    return Outcome.FailRollup;
  }

  return Outcome.Ok;
}


async function login_password(): Promise<Outcome> {
  localStorage.removeItem(IdRudnRu.AccessToken);
  localStorage.removeItem(IdRudnRu.AccessTokenExpires);

  const username = localStorage.getItem(IdRudnRu.Username);
  const password = localStorage.getItem(IdRudnRu.Password);

  const ad_person_id = Number(localStorage.getItem(IdRudnRu.SelectedAdPersonId));

  if (username === null || password === null) {
    return Outcome.FailRollup;
  }

  if (ad_person_id === null || isNaN(ad_person_id)) {
    return Outcome.FailRollup;
  }


  try {
    const resp = await fetch('https://id-api.rudn.ru/api/v1/auth/sign-in', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: username,
        password: password,
        ad_person_id: null,
      })
    });

    if (resp.ok) {
      const data: LoginResponse = await resp.json();
      localStorage.setItem(IdRudnRu.AccessToken, data.data.access_token);
      localStorage.setItem(IdRudnRu.AccessTokenExpires, data.data.expires_in);
      return Outcome.Ok;
    }
    else {
      return Outcome.FailRollup;
    }

  } catch (ex) {
    Notify.create({
      message: 'Network error in login step: ' + (ex as any),
      color: 'negative',
      position: 'top',
      progress: true,
    });
    return Outcome.FailRollup;
  }

}

async function restart_auth() {
  reset_all_auth()

  await router.replace({ 'name': 'login' });
}

</script>
