/**
 * Lecture-room and schedule lookups.
 *
 * This host is unauthenticated -- none of these calls take a token.
 */

import { Hosts, request } from './client';
import type { LocalStorageRoomData } from './types';

/** Shape returned by the room endpoint. */
export interface RoomResponse {
  uuid_url: string;
  name: string;
  room: {
    id: number;
    short_name: string;
  };
}

/** Which days in a range have at least one lecture. Keys are ISO dates. */
export interface HasLectureResponse {
  has_lecture: Record<string, boolean>;
}

/** Look up a room by the UUID encoded in its door QR code. */
export function getRoom(uuid: string): Promise<RoomResponse> {
  return request<RoomResponse>(`${Hosts.Qr}/lecture_room/room/${uuid}/`);
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
  return request<HasLectureResponse>(
    `${Hosts.Qr}/lecture_room/schedule/${uuid}/${firstDay}/${lastDay}/`,
  );
}

/**
 * The lectures in a room on one day. Note this is keyed by the numeric room id,
 * not the UUID used by the other two calls. A 404 means "no schedule", which is
 * a normal empty state rather than an error.
 */
export function getLecturesForDay(roomId: number, day: string): Promise<unknown> {
  return request<unknown>(`${Hosts.Qr}/lecture_room/schedule/${roomId}/${day}/`);
}
