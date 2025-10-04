import { defineStore, acceptHMRUpdate } from 'pinia';

export const useTokenStore = defineStore('lkTokenStore', {
  state: () => ({
    token: '',
    reset_at: '',
    is_ready: false,
  }),
  getters: {
    isNull: (state) => state.token.startsWith('null'),
  },
  actions: {
    reset() {
      // this.token = 'null';
      this.reset_at = new Date().toUTCString();
      this.is_ready = false;
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTokenStore, import.meta.hot));
}
