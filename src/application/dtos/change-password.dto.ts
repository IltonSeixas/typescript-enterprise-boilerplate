import { z } from 'zod';

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(128, 'Password must be at most 128 characters'),
});

export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;
