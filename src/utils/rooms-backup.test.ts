import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LocalStorageRoomData } from 'src/api/types';
import { LkRudnRu } from 'src/consts/store-consts';
import {
  BACKUP_MAGIC,
  UUIDS_PER_CODE,
  decodeBackupCode,
  encodeRoomsBackup,
  isRoomRecord,
  mergeRooms,
  readStoredRooms,
} from './rooms-backup';

/** The characters QR *alphanumeric* mode can encode. See the module comment. */
const QR_ALPHANUMERIC = /^[0-9A-Z $%*+\-./:]+$/;

function uuidAt(i: number): string {
  return `0123abcd-4567-89ef-0123-${String(i).padStart(12, '0')}`;
}

function roomAt(i: number): LocalStorageRoomData {
  return { uuid: uuidAt(i), name: `Room ${i}`, short_name: `R${i}`, room_id: i };
}

function roomsUpTo(n: number): LocalStorageRoomData[] {
  return Array.from({ length: n }, (_, i) => roomAt(i));
}

/** Decode a whole set of codes back into the uuid list it was built from. */
function decodeAll(codes: string[]): string[] {
  return codes.flatMap((code) => {
    const result = decodeBackupCode(code);
    if (!result.ok) throw new Error(`expected a valid code, got: ${result.reason}`);
    return result.uuids;
  });
}

describe('encodeRoomsBackup', () => {
  it('round-trips a room list through a set of codes', () => {
    const rooms = roomsUpTo(123);
    expect(decodeAll(encodeRoomsBackup(rooms))).toEqual(rooms.map((room) => room.uuid));
  });

  it('splits into UUIDS_PER_CODE-sized codes', () => {
    expect(encodeRoomsBackup(roomsUpTo(123))).toHaveLength(3);
    // Exactly on the boundary: no trailing empty code.
    expect(encodeRoomsBackup(roomsUpTo(UUIDS_PER_CODE))).toHaveLength(1);
    expect(encodeRoomsBackup(roomsUpTo(UUIDS_PER_CODE + 1))).toHaveLength(2);
  });

  it('produces no codes for an empty list', () => {
    expect(encodeRoomsBackup([])).toEqual([]);
  });

  it('stays inside the QR alphanumeric charset', () => {
    // This is the reason uuids are upper-cased and dash-stripped. Lowercase hex
    // would silently drop the encoder into byte mode and inflate every code, so
    // it is worth asserting rather than trusting.
    for (const code of encodeRoomsBackup(roomsUpTo(123))) {
      expect(code).toMatch(QR_ALPHANUMERIC);
    }
  });

  it('skips rooms whose uuid is malformed rather than encoding them', () => {
    const rooms = [roomAt(1), { ...roomAt(2), uuid: 'not-a-uuid' }, roomAt(3)];
    expect(decodeAll(encodeRoomsBackup(rooms))).toEqual([uuidAt(1), uuidAt(3)]);
  });
});

describe('decodeBackupCode', () => {
  it('returns uuids in canonical dashed lowercase form', () => {
    const [code] = encodeRoomsBackup([roomAt(7)]);
    const result = decodeBackupCode(code!);
    expect(result).toEqual({ ok: true, uuids: [uuidAt(7)] });
  });

  it('accepts lowercase hex on the wire', () => {
    const [code] = encodeRoomsBackup([roomAt(7)]);
    // Only the payload is lowered; the magic prefix is still matched exactly.
    const lowered = `${BACKUP_MAGIC}:1:${code!.split(':')[2]!.toLowerCase()}`;
    const result = decodeBackupCode(lowered);
    expect(result.ok && result.uuids).toEqual([uuidAt(7)]);
  });

  it('deduplicates uuids repeated inside one code', () => {
    const hex = 'A'.repeat(32);
    const result = decodeBackupCode(`${BACKUP_MAGIC}:1:${hex}${hex}`);
    expect(result.ok && result.uuids).toHaveLength(1);
  });

  it.each([
    ['https://qr.rudn.ru/18c59a66-9131-4424-8850-906978c3ce51', false],
    ['', false],
    [BACKUP_MAGIC, false],
    [`${BACKUP_MAGIC}:1`, true],
    [`${BACKUP_MAGIC}:2:${'A'.repeat(32)}`, true],
    [`${BACKUP_MAGIC}:1:`, true],
    [`${BACKUP_MAGIC}:1:ABC`, true],
    [`${BACKUP_MAGIC}:1:${'Z'.repeat(32)}`, true],
    [`${BACKUP_MAGIC}:1:${'A'.repeat(32 * 501)}`, true],
  ])('rejects %j', (text, looksLikeBackup) => {
    const result = decodeBackupCode(text);
    expect(result.ok).toBe(false);
    // looksLikeBackup is what decides between warning the user and staying
    // quiet, so it is as much part of the contract as ok is.
    expect(!result.ok && result.looksLikeBackup).toBe(looksLikeBackup);
  });
});

describe('mergeRooms', () => {
  it('appends unseen rooms and counts the rest as skipped', () => {
    const { merged, added, skipped } = mergeRooms([roomAt(1), roomAt(2)], [roomAt(2), roomAt(3)]);
    expect(merged.map((room) => room.uuid)).toEqual([uuidAt(1), uuidAt(2), uuidAt(3)]);
    expect({ added, skipped }).toEqual({ added: 1, skipped: 1 });
  });

  it('leaves the existing list untouched when everything is known', () => {
    const existing = [roomAt(1)];
    const { merged, added, skipped } = mergeRooms(existing, [roomAt(1)]);
    expect(merged).toEqual(existing);
    expect({ added, skipped }).toEqual({ added: 0, skipped: 1 });
  });
});

describe('isRoomRecord', () => {
  it.each([
    ['a well-formed record', roomAt(1), true],
    ['null', null, false],
    ['a string', 'room', false],
    ['a missing uuid', { name: 'n', short_name: 's', room_id: 1 }, false],
    ['an empty uuid', { ...roomAt(1), uuid: '' }, false],
    ['a non-integer room_id', { ...roomAt(1), room_id: 1.5 }, false],
    ['a stringly room_id', { ...roomAt(1), room_id: '1' }, false],
  ])('%s', (_label, value, expected) => {
    expect(isRoomRecord(value)).toBe(expected);
  });
});

describe('readStoredRooms', () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    // A stub rather than jsdom: these tests need three methods, not a DOM.
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
          store[key] = value;
        },
        removeItem: (key: string) => {
          delete store[key];
        },
      },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  function storeRaw(value: string) {
    store[LkRudnRu.CheckInRooms] = value;
  }

  it('returns an empty list when nothing is stored', () => {
    expect(readStoredRooms()).toEqual([]);
  });

  it.each([
    ['unparseable JSON', '{not json'],
    ['a JSON value that is not an array', '{"rooms":[]}'],
  ])('survives %s', (_label, raw) => {
    storeRaw(raw);
    expect(readStoredRooms()).toEqual([]);
  });

  it('drops entries that are not room records, keeping the rest', () => {
    storeRaw(JSON.stringify([roomAt(1), { uuid: uuidAt(2) }, null, roomAt(3)]));
    expect(readStoredRooms().map((room) => room.uuid)).toEqual([uuidAt(1), uuidAt(3)]);
  });
});
