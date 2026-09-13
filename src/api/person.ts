/** Calls against the mobile app backend that act on the logged-in person. */

import * as v from 'valibot';
import { Hosts, request } from './client';
import type { LkRudnMeResponse, QrPassResponse } from './types';
import { LkRudnMeResponseSchema, QrPassResponseSchema } from './types';

/**
 * Fetch the current person. Doubles as the liveness check for an lk token:
 * a 401 here is what tells the auth ladder the token is dead.
 */
export function getMe(token: string): Promise<LkRudnMeResponse> {
  return request(`${Hosts.MobApp}/v3/person/me`, LkRudnMeResponseSchema, { token });
}

/** Fetch the turnstile pass code shown as a QR. */
export function generatePass(token: string): Promise<QrPassResponse> {
  return request(`${Hosts.MobApp}/v3/person/generate-pass`, QrPassResponseSchema, { token });
}

/** Register attendance in a room, identified by its auditorium GUID. */
export function attendStart(token: string, auditoriumGuid: string): Promise<unknown> {
  // Nothing reads this body -- only the status matters -- so it is left
  // unvalidated on purpose rather than by omission.
  return request(`${Hosts.MobApp}/qr-scan/v1.0/attend-start`, v.unknown(), {
    method: 'POST',
    token,
    body: { auditorium_guid: auditoriumGuid },
  });
}
