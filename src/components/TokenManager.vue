<template>
  <q-linear-progress indeterminate color="warning" v-if="running" />
  <q-linear-progress size="25px" :value="progress_bar_value" color="accent" v-if="running">
    <div class="absolute-full flex flex-center">
      <q-badge color="white" text-color="accent" :label="progress_bar_text" />
    </div>
  </q-linear-progress>
  <q-banner inline-actions class="text-white bg-red" v-if="full_failure">
    <template v-if="failure_is_network">
      Could not reach RUDN servers. You may be offline &mdash; showing saved data.
    </template>
    <template v-else>
      Could not recover your session automatically.
      Please log in manually.
    </template>
    <template v-slot:action>
      <q-btn v-if="failure_is_network" flat color="white" label="Retry" @click="refresh" />
      <q-btn v-else flat color="white" label="Log in" @click="restart_auth" />
    </template>
  </q-banner>
</template>

<script setup lang="ts">
import { continueDirect, getOAuthCode, redeemOAuthCode, signIn } from 'src/api/auth';
import { isNetworkError } from 'src/api/client';
import { getMe } from 'src/api/person';
import { IdRudnRu, LkRudnRu, reset_all_auth } from 'src/consts/store-consts';
import { useTokenStore } from 'src/stores/lk_rudn';
import { recordEvent } from 'src/utils/diagnostics';
import { notifySuccess } from 'src/utils/notify';
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';


const running = ref(false);
const progress_bar_value = ref(0);
const progress_bar_text = ref("");

const full_failure = ref(false);
// Set when the run failed because the network was unreachable rather than
// because the stored credentials were rejected. The two need different advice.
const failure_is_network = ref(false);
// Steps handle their own fetch exceptions, so they flag network trouble here
// rather than letting it propagate to the driver loop.
let saw_network_error = false;

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

watch(() => token_store.reset_at, refresh);

async function force_refresh() {
  token_store.reset();
  await refresh();
}

async function refresh() {
  token_store.is_ready = false;
  // `id` is for logs, `label` is what the user reads. Neither may be derived
  // from the function name: minified builds rewrite it to a single letter.
  const steps: { id: string; label: string; run: () => Promise<Outcome> }[] = [
    { id: 'login_password', label: 'Signing in…', run: login_password },
    { id: 'trade_ephemeral_token_for_real', label: 'Confirming your login…', run: trade_ephemeral_token_for_real },
    { id: 'trade_id_for_lk_token', label: 'Getting account access…', run: trade_id_for_lk_token },
    { id: 'final_check', label: 'Checking your session…', run: final_check },
  ];

  let current_step_to_run = steps.length - 1;
  let steps_budget = 10;

  running.value = true;
  full_failure.value = false;
  failure_is_network.value = false;
  saw_network_error = false;

  while (current_step_to_run >= 0 && current_step_to_run < steps.length) {
    progress_bar_value.value = (steps.length - current_step_to_run) / steps.length;
    const step = steps[current_step_to_run]!;
    progress_bar_text.value = step.label;

    if (steps_budget <= 0) {
      break;
    }

    let outcome;
    try {
      console.log("Running step: " + step.id);
      outcome = await step.run();
    } catch (ex) {
      console.error("Network error in " + step.id, ex);
      saw_network_error = true;
      outcome = Outcome.FailRollup;
    }
    steps_budget -= 1;

    console.log("Outcome for step " + step.id + ": " + outcome);

    if (outcome === Outcome.FailRollup) {
      current_step_to_run -= 1;
      recordEvent('auth', `${step.id} failed, rolling back to step ${current_step_to_run}`);
    }
    else {
      current_step_to_run += 1;
      recordEvent('auth', `${step.id} ok, advancing to step ${current_step_to_run}`);
    }
  }

  running.value = false;

  // The loop only ends successfully by walking off the end of the step list.
  // Exhausting the budget, or rolling back past the first step, are failures.
  const succeeded = current_step_to_run >= steps.length;
  recordEvent(
    'auth',
    succeeded
      ? `ladder succeeded with ${steps_budget} of 10 steps left`
      : `ladder FAILED (budget left ${steps_budget}, network trouble: ${saw_network_error})`,
  );
  full_failure.value = !succeeded;
  failure_is_network.value = !succeeded && saw_network_error;
  token_store.is_ready = succeeded;

  if (succeeded) {
    notifySuccess('Signed in.');
  }
}

async function final_check(): Promise<Outcome> {
  const token = localStorage.getItem(LkRudnRu.AccessToken);

  if (token === null || token === undefined) {
    return Outcome.FailRollup;
  }

  try {
    await getMe(token);
    // The token is still valid.
    token_store.token = token;
    localStorage.setItem(LkRudnRu.SuccessfulAccess, "true");
    return Outcome.Ok;
  } catch (ex) {
    if (isNetworkError(ex)) {
      // Offline: the token may well still be good, so do not throw it away.
      saw_network_error = true;
      return Outcome.FailRollup;
    }
    // The server rejected it, so roll back and rebuild the token.
    token_store.token = 'null';
    localStorage.removeItem(LkRudnRu.AccessToken);
    return Outcome.FailRollup;
  }
}

async function trade_id_for_lk_token(): Promise<Outcome> {
  const id_token = localStorage.getItem(IdRudnRu.AccessToken);
  if (id_token === null) {
    return Outcome.FailRollup;
  }

  try {
    const data = await getOAuthCode(id_token);
    if (typeof data.data !== 'string') {
      return Outcome.FailRollup;
    }
    const lk = await redeemOAuthCode(data.data);
    localStorage.setItem(LkRudnRu.AccessToken, lk.data.token);
    token_store.token = lk.data.token;
    return Outcome.Ok;
  } catch (ex) {
    if (isNetworkError(ex)) saw_network_error = true;
    return Outcome.FailRollup;
  }
}

async function trade_ephemeral_token_for_real(): Promise<Outcome> {
  const token = localStorage.getItem(IdRudnRu.AccessToken);
  if (token === null) {
    return Outcome.FailRollup;
  }

  try {
    const answer = await continueDirect(token);
    localStorage.setItem(IdRudnRu.AccessToken, answer.access_token);
    // Kept for a future refresh step; see the note in store-consts.ts.
    if (answer.refresh_token) {
      localStorage.setItem(IdRudnRu.RefreshToken, answer.refresh_token);
    }
    localStorage.setItem(IdRudnRu.AccessTokenObtainedAt, String(Date.now()));
    return Outcome.Ok;

  } catch (ex) {
    if (isNetworkError(ex)) saw_network_error = true;
    return Outcome.FailRollup;
  }

}


async function login_password(): Promise<Outcome> {
  localStorage.removeItem(IdRudnRu.AccessToken);

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
    const data = await signIn(username, password, ad_person_id);
    localStorage.setItem(IdRudnRu.AccessToken, data.data.access_token);
    return Outcome.Ok;
  } catch (ex) {
    if (isNetworkError(ex)) saw_network_error = true;
    return Outcome.FailRollup;
  }

}

async function restart_auth() {
  reset_all_auth()

  await router.replace({ 'name': 'login' });
}

</script>
