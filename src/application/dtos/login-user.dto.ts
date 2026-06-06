import { z } from 'zod';

export const LoginUserSchema = z.object({
  email: z.string().email().max(254).toLowerCase(),
  password: z.string().min(1).max(128),
});

export type LoginUserDto = z.infer<typeof LoginUserSchema>;
