export enum IdRudnRu {
  Username = 'id.rudn.ru/username',
  Password = 'id.rudn.ru/password',
  AccessToken = 'id.rudn.ru/access-token',
  /** Refresh token from continue/direct. Short-lived, so treat it as a
   * shortcut that often fails rather than a dependable way back in. */
  RefreshToken = 'id.rudn.ru/refresh-token',
  /** ms timestamp of when AccessToken was issued, so the ladder can skip
   * refreshing one it just obtained. */
  AccessTokenObtainedAt = 'id.rudn.ru/access-token-obtained-at',
  SelectedAdPersonId = 'id.rudn.ru/selected-ad-person-id',
  AdPersonOptions = 'id.rudn.ru/ad-person-options',
}
export enum LkRudnRu {
  SuccessfulAccess = 'lk.rudn.ru/successful-access',
  AccessToken = 'lk.rudn.ru/access-token',
  CheckInRooms = 'lk.rudn.ru/check-in-rooms',
  PacsCode = 'lk.rudn.ru/pacs-code',
}

export enum Device {
  PreferredCameraId = 'device.local/preferred-camera/id',
  PreferredCameraName = 'device.local/preferred-camera/name',
  /** Whether the QR screen forces full brightness. Absent means off, so the
   * default never surprises anyone with a suddenly bright screen. */
  QrMaxBrightness = 'device.local/qr/max-brightness',
}

export function reset_all_auth() {
  localStorage.removeItem(IdRudnRu.AccessToken);
  localStorage.removeItem(IdRudnRu.RefreshToken);
  localStorage.removeItem(IdRudnRu.AccessTokenObtainedAt);
  localStorage.removeItem(IdRudnRu.Username);
  localStorage.removeItem(IdRudnRu.Password);
  localStorage.removeItem(IdRudnRu.AdPersonOptions);
  localStorage.removeItem(IdRudnRu.SelectedAdPersonId);

  localStorage.removeItem(LkRudnRu.SuccessfulAccess);
  localStorage.removeItem(LkRudnRu.AccessToken);
  localStorage.removeItem(LkRudnRu.PacsCode);
}
