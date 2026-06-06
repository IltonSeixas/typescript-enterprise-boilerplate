export interface AuthOutputDto {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface UserOutputDto {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
