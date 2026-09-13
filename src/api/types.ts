/**
 * Shapes of the RUDN API responses, as valibot schemas.
 *
 * These endpoints are reverse-engineered and undocumented, so a TypeScript
 * interface here was only ever a *claim* about what the server sends. Each
 * shape is a runtime schema instead, and its static type is inferred from it --
 * so the two can never drift apart, and a server that changes shape produces a
 * named error at the call rather than `undefined` several frames later.
 *
 * Two deliberate choices:
 *
 *  - **Objects are not strict.** Unknown keys are ignored, not rejected. The
 *    real responses carry far more than we read (a room also has `territory`,
 *    `content`, `image`, and a second `uid` distinct from `uuid_url`), and a
 *    university adding a field must not break the app.
 *  - **Only what we actually use is required.** Fields the app never reads are
 *    marked optional, so that upstream dropping or renaming one is a no-op
 *    rather than an outage. Requiring a field we ignore would make validation
 *    *reduce* reliability, which is the opposite of the point.
 */

import * as v from 'valibot';

/** A person's name, as returned by both the auth and the /me endpoints. */
const PersonSchema = v.object({
  id: v.number(),
  name_rus: v.string(),
  surname_rus: v.string(),
  patronymic_rus: v.string(),
});

export const LoginErrorSchema = v.object({
  type: v.string(),
  description: v.string(),
});
export type LoginError = v.InferOutput<typeof LoginErrorSchema>;

export const LoginAccountSchema = v.object({
  email: v.string(),
  fio: v.string(),
  // A JSON number upstream, not a string -- localStorage consumers have to
  // String() it on the way in.
  ad_person_id: v.number(),
});
export type LoginAccount = v.InferOutput<typeof LoginAccountSchema>;

export const LoginDataSchema = v.object({
  access_token: v.string(),
  accounts: v.array(LoginAccountSchema),
  // Unread by this app; see the note above.
  expires_in: v.nullish(v.string()),
  need_auth: v.nullish(v.boolean()),
});
export type LoginData = v.InferOutput<typeof LoginDataSchema>;

export const LoginResponseSchema = v.object({
  data: LoginDataSchema,
  error: v.nullish(LoginErrorSchema),
  trace: v.nullish(v.string()),
});
export type LoginResponse = v.InferOutput<typeof LoginResponseSchema>;

/**
 * A response whose `data` we treat as opaque.
 *
 * Used by the OAuth continue call, where `data` is a bare URL string that the
 * next step rewrites and fetches.
 */
export const GenericResponseSchema = v.object({
  data: v.unknown(),
  error: v.unknown(),
});
export type GenericResponse = v.InferOutput<typeof GenericResponseSchema>;

export const ContinueResponseSchema = v.object({
  access_token: v.string(),
  // PickAccount checks this is 'Bearer', so its absence is worth catching.
  token_type: v.string(),
  // TokenManager already treats a missing refresh token as normal.
  refresh_token: v.nullish(v.string()),
  expires_in: v.nullish(v.number()),
});
export type ContinueResponse = v.InferOutput<typeof ContinueResponseSchema>;

export const LkRudnAuthResponseSchema = v.object({
  data: v.object({
    token: v.string(),
    person: PersonSchema,
  }),
  error: v.unknown(),
});
export type LkRudnAuthResponse = v.InferOutput<typeof LkRudnAuthResponseSchema>;

export const LkRudnMeResponseSchema = v.object({
  data: v.object({
    person: PersonSchema,
  }),
  error: v.unknown(),
});
export type LkRudnMeResponse = v.InferOutput<typeof LkRudnMeResponseSchema>;

export const QrPassResponseSchema = v.object({
  data: v.object({
    // The only field this screen actually needs, and the most important single
    // value in the app -- so it is the only one allowed to fail the pass.
    pacs_num: v.string(),
    /**
     * The same pass as hex. Unused by this app: the official app hands it to
     * the Sigur access SDK, which identifies over Bluetooth LE rather than NFC.
     */
    pacs_num_hex: v.nullish(v.string()),
    covid_info_show: v.nullish(v.boolean()),
  }),
  error: v.unknown(),
});
export type QrPassResponse = v.InferOutput<typeof QrPassResponseSchema>;

/** A room record as persisted in localStorage -- our shape, not the server's. */
export const LocalStorageRoomSchema = v.object({
  uuid: v.pipe(v.string(), v.minLength(1)),
  name: v.string(),
  short_name: v.string(),
  room_id: v.pipe(v.number(), v.integer()),
});
export type LocalStorageRoomData = v.InferOutput<typeof LocalStorageRoomSchema>;
