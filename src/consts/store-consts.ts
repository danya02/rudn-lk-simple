export enum IdRudnRu {
  Username = 'id.rudn.ru/username',
  Password = 'id.rudn.ru/password',
  AccessToken = 'id.rudn.ru/access-token',
  AccessTokenExpires = 'id.rudn.ru/access-token-expires',
  SelectedAdPersonId = 'id.rudn.ru/selected-ad-person-id',
  AdPersonOptions = 'id.rudn.ru/ad-person-options',
}
export enum LkRudnRu {
  SuccessfulAccess = 'lk.rudn.ru/successful-access',
  AccessToken = 'lk.rudn.ru/access-token',
  CheckInRooms = 'lk.rudn.ru/check-in-rooms',
}

export enum Device {
  PreferredCameraId = 'device.local/preferred-camera/id',
  PreferredCameraName = 'device.local/preferred-camera/name',
}

export function reset_all_auth() {
  localStorage.removeItem(IdRudnRu.AccessToken);
  localStorage.removeItem(IdRudnRu.AccessTokenExpires);
  localStorage.removeItem(IdRudnRu.Username);
  localStorage.removeItem(IdRudnRu.Password);
  localStorage.removeItem(IdRudnRu.AdPersonOptions);
  localStorage.removeItem(IdRudnRu.SelectedAdPersonId);

  localStorage.removeItem(LkRudnRu.SuccessfulAccess);
  localStorage.removeItem(LkRudnRu.AccessToken);
}
