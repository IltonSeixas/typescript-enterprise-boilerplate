import { z } from 'zod';
import type { UserOutputDto } from './auth-output.dto.js';

export const ListUsersSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export type ListUsersDto = z.infer<typeof ListUsersSchema>;

export interface PaginationMetadataDto {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ListUsersOutputDto {
  items: UserOutputDto[];
  pagination: PaginationMetadataDto;
}
