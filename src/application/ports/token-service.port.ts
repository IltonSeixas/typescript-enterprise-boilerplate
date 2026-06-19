export interface AccessTokenPayload {
  sub: string;
  jti: string;
}

export interface TokenServicePort {
  signAccessToken(payload: AccessTokenPayload): Promise<string>;
  verifyAccessToken(token: string): Promise<AccessTokenPayload>;
  issueRefreshToken(userId: string): Promise<string>;
  consumeRefreshToken(token: string): Promise<string>;
  revokeRefreshToken(token: string): Promise<void>;
}
