/**
 * Lecture-room and schedule lookups.
 *
 * This host is unauthenticated -- none of these calls take a token.
 */

import * as v from 'valibot';
import { Hosts, request } from './client';
import type { LocalStorageRoomData } from './types';

/**
 * Shape returned by the room endpoint.
 *
 * The real response carries more than this -- `room.territory`, `content`,
 * `image`, and a `room.uid` that is a different uuid from `uuid_url`. Only the
 * fields this app reads are described; see the note in types.ts.
 */
export const RoomResponseSchema = v.object({
  uuid_url: v.string(),
  name: v.string(),
  room: v.object({
    id: v.number(),
    short_name: v.string(),
  }),
});
export type RoomResponse = v.InferOutput<typeof RoomResponseSchema>;

/** Which days in a range have at least one lecture. Keys are ISO dates. */
export const HasLectureResponseSchema = v.object({
  has_lecture: v.record(v.string(), v.boolean()),
});
export type HasLectureResponse = v.InferOutput<typeof HasLectureResponseSchema>;

/** Look up a room by the UUID encoded in its door QR code. */
export function getRoom(uuid: string): Promise<RoomResponse> {
  return request(`${Hosts.Qr}/lecture_room/room/${uuid}/`, RoomResponseSchema);
}

/** Normalise a room response into the form persisted in localStorage. */
export function toStoredRoom(data: RoomResponse): LocalStorageRoomData {
  return {
    uuid: data.uuid_url,
    name: data.name,
    short_name: data.room.short_name,
    room_id: data.room.id,
  };
}

/** Which days between firstDay and lastDay (ISO dates) have lectures. */
export function getLectureDays(
  uuid: string,
  firstDay: string,
  lastDay: string,
): Promise<HasLectureResponse> {
  return request(
    `${Hosts.Qr}/lecture_room/schedule/${uuid}/${firstDay}/${lastDay}/`,
    HasLectureResponseSchema,
  );
}

/**
 * The lectures in a room on one day. Note this is keyed by the numeric room id,
 * not the UUID used by the other two calls. A 404 means "no schedule", which is
 * a normal empty state rather than an error.
 */
export function getLecturesForDay(roomId: number, day: string): Promise<unknown> {
  // Shaped by its only caller rather than here: RoomInfo renders this directly.
  return request(`${Hosts.Qr}/lecture_room/schedule/${roomId}/${day}/`, v.unknown());
}
