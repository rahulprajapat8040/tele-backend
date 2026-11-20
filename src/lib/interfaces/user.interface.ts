export interface IAuthUser {
  userId: string;
  deviceId: string;
  sessionId: string;

  firstName?: string;
  lastName?: string;
  countryCode?: string;
  phoneNo?: string;
}

export interface IJwtPayload {
  userId: string;
  deviceId: string;
  sessionId: string;
}
