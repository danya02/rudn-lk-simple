/** Calls against the mobile app backend that act on the logged-in person. */

import { Hosts, request } from './client';
import type { LkRudnMeResponse, QrPassResponse } from './types';

/**
 * Fetch the current person. Doubles as the liveness check for an lk token:
 * a 401 here is what tells the auth ladder the token is dead.
 */
export function getMe(token: string): Promise<LkRudnMeResponse> {
  return request<LkRudnMeResponse>(`${Hosts.MobApp}/v3/person/me`, { token });
}

/** Fetch the turnstile pass code shown as a QR. */
export function generatePass(token: string): Promise<QrPassResponse> {
  return request<QrPassResponse>(`${Hosts.MobApp}/v3/person/generate-pass`, { token });
}

/** Register attendance in a room, identified by its auditorium GUID. */
export function attendStart(token: string, auditoriumGuid: string): Promise<unknown> {
  return request<unknown>(`${Hosts.MobApp}/qr-scan/v1.0/attend-start`, {
    method: 'POST',
    token,
    body: { auditorium_guid: auditoriumGuid },
  });
}
