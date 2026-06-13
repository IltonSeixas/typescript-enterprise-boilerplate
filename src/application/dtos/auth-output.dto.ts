import type { UserRole } from '../../domain/entities/user.entity.js';

export interface AuthOutputDto {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface UserOutputDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
