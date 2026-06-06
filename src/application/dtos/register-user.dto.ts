import { z } from 'zod';

export const RegisterUserSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email().max(254).toLowerCase(),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(128, 'Password must be at most 128 characters'),
});

export type RegisterUserDto = z.infer<typeof RegisterUserSchema>;
