/**
 * The RUDN login chain.
 *
 * Getting a usable lk token takes four hops:
 *
 *   signIn(username, password, adPersonId)  -> ephemeral id token
 *   continueDirect(ephemeralToken)          -> real id token + refresh token
 *   getOAuthCode(idToken)                   -> a one-shot OAuth callback URL
 *   redeemOAuthCode(url)                    -> lk token
 *
 * signIn is also used without an ad_person_id to *discover* which accounts a
 * username has, which is why adPersonId is optional.
 */

import { Hosts, OAUTH_CLIENT_ID, request } from './client';
import type { ContinueResponse, GenericResponse, LkRudnAuthResponse, LoginResponse } from './types';
import {
  ContinueResponseSchema,
  GenericResponseSchema,
  LkRudnAuthResponseSchema,
  LoginResponseSchema,
} from './types';

/**
 * Step 1. Exchange credentials for an ephemeral id token.
 *
 * Called with no adPersonId, the response's `accounts` lists the identities
 * attached to this username and the caller must pick one and call again. The
 * field is sent as an explicit null in that case, which is what the endpoint
 * expects -- omitting it entirely is not the same thing.
 */
export function signIn(
  username: string,
  password: string,
  adPersonId?: number,
  /**
   * Bearer token to send alongside the credentials. PickAccount sends the
   * ephemeral token from the first sign-in when re-signing in as a chosen
   * identity; whether the endpoint actually requires it is unverified, so it is
   * preserved rather than dropped. TokenManager's cold relogin sends none.
   */
  authToken?: string | null,
): Promise<LoginResponse> {
  return request(`${Hosts.Id}/auth/sign-in`, LoginResponseSchema, {
    method: 'POST',
    ...(authToken === undefined ? {} : { token: authToken }),
    body: {
      username,
      password,
      ad_person_id: adPersonId ?? null,
    },
  });
}

/**
 * Step 2. Upgrade an ephemeral id token to a real one.
 *
 * The response also carries a refresh_token, which historically expired fast --
 * treat it as an optimisation, never as the only way back in.
 */
export function continueDirect(ephemeralToken: string): Promise<ContinueResponse> {
  return request(`${Hosts.Id}/auth/continue/direct`, ContinueResponseSchema, {
    method: 'POST',
    token: ephemeralToken,
  });
}

/**
 * Step 3. Ask the identity service for an OAuth callback URL.
 *
 * `data` is the callback URL as a string; feed it to redeemOAuthCode.
 */
export function getOAuthCode(idToken: string): Promise<GenericResponse> {
  const redirect = encodeURIComponent(`${Hosts.MobApp}/token-rudn-id`);
  return request(
    `${Hosts.Id}/oauth2/continue?client_id=${OAUTH_CLIENT_ID}&redirect_uri=${redirect}&response_type=code`,
    GenericResponseSchema,
    { method: 'POST', token: idToken },
  );
}

/**
 * Step 4. Redeem the callback URL for an lk token.
 *
 * Two quirks of the upstream API, both load-bearing:
 *  - the returned URL points at a path that does not serve the token; it has to
 *    be rewritten to the /v1/auth/ variant before it will work;
 *  - the request must send the literal header `Authorization: Bearer null`.
 */
export function redeemOAuthCode(callbackUrl: string): Promise<LkRudnAuthResponse> {
  const rewritten = callbackUrl.replace(
    `${Hosts.MobApp}/token-rudn-id`,
    `${Hosts.MobApp}/v1/auth/token-rudn-id`,
  );
  return request(rewritten, LkRudnAuthResponseSchema, {
    method: 'GET',
    token: 'null',
    noContentType: true,
  });
}
