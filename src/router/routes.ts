import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('layouts/StartupRouterLayout.vue'),
    children: [{ name: 'init', path: '', component: () => import('pages/StartupRouter.vue') }],
  },
  {
    path: '/auth',
    component: () => import('layouts/LoginLayout.vue'),
    children: [
      { name: 'login', path: 'login', component: () => import('pages/LoginPage.vue') },
      {
        name: 'pick-account',
        path: 'pick-account',
        component: () => import('pages/PickAccount.vue'),
      },
      {
        name: 'acquire-lk-code',
        path: 'lk-code',
        component: () => import('pages/AcquireLkCode.vue'),
      },
    ],
  },

  {
    path: '/lk',
    component: () => import('layouts/LkLayout.vue'),
    children: [
      {
        name: 'hub',
        path: '',
        component: () => import('pages/MainHub.vue'),
      },
      {
        name: 'qr-code',
        path: 'qr-code',
        component: () => import('pages/Lk/QrCode.vue'),
      },
      {
        name: 'checkin',
        path: 'checkin',
        component: () => import('src/pages/Lk/CheckIn.vue'),
      },
      {
        name: 'checkin-scanner',
        path: 'checkin-scanner',
        component: () => import('src/pages/Lk/CheckInScanner.vue'),
      },
      {
        name: 'lk-room',
        path: 'room/:uuid',
        component: () => import('src/pages/Lk/RoomInfo.vue'),
      },
    ],
  },
  {
    path: '/util',
    component: () => import('layouts/UtilLayout.vue'),
    children: [
      {
        name: 'qr-camera-grant',
        path: 'qr-camera-grant',
        component: () => import('pages/Utility/QrScannerCameraGrant.vue'),
      },
    ],
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
];

export default routes;
