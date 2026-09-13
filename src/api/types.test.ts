import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { LoginResponseSchema } from './types';

/**
 * Captured from a real id-api.rudn.ru sign-in. Two things in here broke the
 * first version of the schema, and both are the kind of mistake that only a
 * real payload catches:
 *
 *  - `ad_person_id` is a JSON number, not a string.
 *  - `trace` is null. In valibot `optional()` admits `undefined` but *not*
 *    `null`, so every unread field the API nulls out has to be `nullish()`.
 *
 * The account list is trimmed to two entries and the addresses are altered;
 * nothing here depends on their exact values.
 */
const REAL_LOGIN_RESPONSE = {
  data: {
    access_token: '',
    expires_in: '2026-09-13 12:20:42',
    connections: [],
    need_auth: true,
    email: null,
    accounts: [
      { email: '1032212280@rudn.ru', fio: 'Генералов Даниил Михайлович', ad_person_id: 74236 },
      { email: 'danugener@gmail.com', fio: 'Генералов Даниил Михайлович', ad_person_id: 74235 },
    ],
    need_second_factor: false,
    second_factor_operation_id: null,
    second_factor_total_ttl_minutes: null,
    password_expiry_days_left: null,
    password_expiry_at: null,
  },
  error: null,
  trace: null,
};

describe('LoginResponseSchema', () => {
  it('accepts a real sign-in response', () => {
    const parsed = v.parse(LoginResponseSchema, REAL_LOGIN_RESPONSE);
    expect(parsed.data.accounts).toHaveLength(2);
  });

  it('keeps ad_person_id a number', () => {
    const parsed = v.parse(LoginResponseSchema, REAL_LOGIN_RESPONSE);
    expect(parsed.data.accounts[0]!.ad_person_id).toBe(74236);
  });

  it('accepts null in the unread fields', () => {
    // Every field the app does not read may come back null; none of them
    // should be able to fail a login.
    const nulled = {
      ...REAL_LOGIN_RESPONSE,
      data: { ...REAL_LOGIN_RESPONSE.data, expires_in: null, need_auth: null },
    };
    expect(() => v.parse(LoginResponseSchema, nulled)).not.toThrow();
  });

  it('ignores unknown keys', () => {
    // Objects are deliberately not strict: the real responses carry much more
    // than this app reads.
    const extra = { ...REAL_LOGIN_RESPONSE, something_new: 42 };
    expect(() => v.parse(LoginResponseSchema, extra)).not.toThrow();
  });

  it('still rejects a genuinely wrong shape', () => {
    const broken = {
      ...REAL_LOGIN_RESPONSE,
      data: { ...REAL_LOGIN_RESPONSE.data, accounts: [{ email: 'a@b.c', fio: 'x' }] },
    };
    expect(() => v.parse(LoginResponseSchema, broken)).toThrow();
  });
});
