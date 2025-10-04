export interface LoginResponse {
  data: LoginData;
  error: LoginError | null;
  trace: string;
}

export interface GenericResponse {
  data: unknown;
  error: unknown;
}

export interface LoginError {
  type: string;
  description: string;
}

export interface LoginData {
  access_token: string;
  expires_in: string;
  need_auth: boolean;
  accounts: LoginAccount[];
}

export interface LoginAccount {
  email: string;
  fio: string;
  ad_person_id: string;
}

export interface LkRudnAuthResponse {
  data: {
    token: string;
    person: {
      id: number;
      name_rus: string;
      surname_rus: string;
      patronymic_rus: string;
    };
  };
  error: unknown;
}

export interface LkRudnMeResponse {
  data: {
    person: {
      id: number;
      name_rus: string;
      surname_rus: string;
      patronymic_rus: string;
    };
  };
  error: unknown;
}

export interface QrPassResponse {
  data: {
    pacs_num: string;
    pacs_num_hex: string;
    covid_info_show: boolean;
  };
  error: unknown;
}

export interface LocalStorageRoomData {
  uuid: string;
  name: string;
  short_name: string;
  room_id: number;
}
