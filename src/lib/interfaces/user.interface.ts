export interface IAuthUser {
  userId: string;
  deviceId: string;
}

export interface IJwtPayload {
  userId: string;
  deviceId: string;
}
