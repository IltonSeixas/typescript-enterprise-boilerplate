import { z } from 'zod';

export const ChangeRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'member']),
});

export type ChangeRoleDto = z.infer<typeof ChangeRoleSchema>;
