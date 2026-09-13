/**
 * Serialisation for the saved-room backup feature.
 *
 * The saved room list is the only user data that is expensive to recreate --
 * every entry cost a walk to a door -- so it is exported as a set of QR codes
 * and imported back by scanning them.
 *
 * Wire format (one QR carries one code, as a single text string):
 *
 *   RUDN-ROOMS:<version>:<uuid><uuid>...
 *
 *  - "RUDN-ROOMS" is a fixed magic prefix. Its only job is to let the scanner
 *    tell a backup code from an unrelated QR -- a PACS pass, a shop receipt --
 *    and ignore the rest quietly instead of trying to parse every code it sees.
 *  - <version> is the format version (currently "1").
 *  - the rest is a run of 32-char uppercase hex uuids with their dashes
 *    stripped, concatenated without separators. Fixed width makes a separator
 *    unnecessary.
 *
 * A backup code carries **only uuids**. `name`, `short_name` and `room_id` are
 * all re-derivable from the uuid via `getRoom()`, which the scanner already
 * calls for every door code it reads, so storing them would be storing a cache
 * of something we are about to fetch anyway. Dropping them shrank the payload
 * enough that the compression, base64 and chunk-sequencing this module used to
 * carry all became unnecessary.
 *
 * Every character used -- the magic, ':', uppercase hex -- is in QR
 * *alphanumeric* mode's charset, which packs 11 bits per 2 characters instead
 * of 8 bits per character. Lowercase hex would silently drop the encoder into
 * byte mode and inflate every code, so the case here is load-bearing.
 *
 * Codes are independent and unordered. There is no document id, no index, no
 * total, and no all-or-nothing completion state: scanning three codes out of
 * five restores exactly the rooms those three carry. That is the honest model
 * for a scanner pointed at a screen, where giving up part-way through is a
 * normal thing to do.
 */

import * as v from 'valibot';
import type { LocalStorageRoomData } from 'src/api/types';
import { LocalStorageRoomSchema } from 'src/api/types';
import { LkRudnRu } from 'src/consts/store-consts';

export const BACKUP_MAGIC = 'RUDN-ROOMS';
export const BACKUP_VERSION = 1;

/**
 * How many uuids go into one QR code.
 *
 * 50 uuids is 1600 payload characters, which at error-correction level M lands
 * around QR version 27. That is about as dense as a phone camera can reliably
 * read off another phone's screen; going higher trades a code or two saved for
 * scans that need several attempts.
 */
export const UUIDS_PER_CODE = 50;

/**
 * Defensive upper bound on the uuids in a single code.
 *
 * Nothing we generate comes close; this only bounds the work a hostile or
 * corrupt code can ask for before it is rejected.
 */
export const MAX_UUIDS_PER_CODE = 500;

export type DecodeResult =
  | { ok: true; uuids: string[] }
  | { ok: false; reason: string; looksLikeBackup: boolean };

/**
 * Structural check for the room records persisted in localStorage.
 *
 * The schema lives with the other shapes in api/types.ts so that this check and
 * the `LocalStorageRoomData` type cannot drift apart.
 */
export function isRoomRecord(value: unknown): value is LocalStorageRoomData {
  return v.is(LocalStorageRoomSchema, value);
}

/** Read the saved rooms, tolerating a missing or corrupt localStorage entry. */
export function readStoredRooms(): LocalStorageRoomData[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LkRudnRu.CheckInRooms) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRoomRecord);
  } catch {
    return [];
  }
}

const DASHED_UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Pack a dashed uuid into the 32 uppercase hex chars the wire format uses. */
function packUuid(uuid: string): string {
  return uuid.replaceAll('-', '').toUpperCase();
}

/** Restore the canonical dashed lowercase form of a packed uuid. */
function unpackUuid(hex: string): string {
  const lower = hex.toLowerCase();
  return [
    lower.slice(0, 8),
    lower.slice(8, 12),
    lower.slice(12, 16),
    lower.slice(16, 20),
    lower.slice(20, 32),
  ].join('-');
}

/**
 * Turn a room list into a set of QR payloads.
 *
 * Rooms whose uuid is not a well-formed uuid are skipped rather than encoded:
 * they could not be looked up on the far side anyway, and one bad localStorage
 * entry should not cost the user the whole backup.
 */
export function encodeRoomsBackup(rooms: LocalStorageRoomData[]): string[] {
  const packed = rooms.filter((room) => DASHED_UUID.test(room.uuid)).map((room) => packUuid(room.uuid));

  const codes: string[] = [];
  for (let i = 0; i < packed.length; i += UUIDS_PER_CODE) {
    const slice = packed.slice(i, i + UUIDS_PER_CODE);
    codes.push(`${BACKUP_MAGIC}:${BACKUP_VERSION}:${slice.join('')}`);
  }
  return codes;
}

/**
 * Parse and validate a single scanned payload. Never throws.
 *
 * `looksLikeBackup` distinguishes "this is not our code, say nothing" from
 * "this is one of ours and it is broken, which the user wants to hear about".
 * The returned uuids are deduplicated and in canonical dashed lowercase form.
 */
export function decodeBackupCode(text: string): DecodeResult {
  const prefix = `${BACKUP_MAGIC}:`;
  const looksLikeBackup = text.startsWith(prefix);
  if (!looksLikeBackup) return { ok: false, reason: 'not a room-backup code', looksLikeBackup };

  const rest = text.slice(prefix.length);
  const sep = rest.indexOf(':');
  if (sep === -1) return { ok: false, reason: 'missing format version', looksLikeBackup };

  const version = rest.slice(0, sep);
  if (version !== String(BACKUP_VERSION)) {
    return { ok: false, reason: `unsupported format version ${version}`, looksLikeBackup };
  }

  const body = rest.slice(sep + 1);
  if (body.length === 0) return { ok: false, reason: 'the code carries no rooms', looksLikeBackup };
  if (body.length % 32 !== 0) {
    return { ok: false, reason: 'the room list is truncated', looksLikeBackup };
  }
  if (body.length / 32 > MAX_UUIDS_PER_CODE) {
    return { ok: false, reason: 'the code claims too many rooms', looksLikeBackup };
  }
  if (!/^[0-9A-Fa-f]+$/.test(body)) {
    return { ok: false, reason: 'the room list is not hexadecimal', looksLikeBackup };
  }

  const uuids: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < body.length; i += 32) {
    const uuid = unpackUuid(body.slice(i, i + 32));
    if (seen.has(uuid)) continue;
    seen.add(uuid);
    uuids.push(uuid);
  }
  return { ok: true, uuids };
}

/** Merge incoming rooms into the existing list, deduplicating by uuid. */
export function mergeRooms(
  existing: LocalStorageRoomData[],
  incoming: LocalStorageRoomData[],
): { merged: LocalStorageRoomData[]; added: number; skipped: number } {
  const seen = new Set(existing.map((room) => room.uuid));
  const merged = [...existing];
  let added = 0;
  let skipped = 0;
  for (const room of incoming) {
    if (seen.has(room.uuid)) {
      skipped++;
      continue;
    }
    seen.add(room.uuid);
    merged.push(room);
    added++;
  }
  return { merged, added, skipped };
}
