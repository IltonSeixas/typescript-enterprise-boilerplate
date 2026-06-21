import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: ['owner', 'admin', 'member'] })
      .notNull()
      .default('member'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
    roleIdx: index('users_role_idx').on(table.role),
    ownerUniqueIdx: uniqueIndex('users_owner_unique_idx')
      .on(table.role)
      .where(sql`role = 'owner'`),
  }),
);

export type UserRow = typeof users.$inferSelect;
export type InsertUserRow = typeof users.$inferInsert;

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey(),
    eventType: text('event_type').notNull(),
    actorId: uuid('actor_id'),
    targetId: uuid('target_id'),
    detail: text('detail').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    occurredAtIdx: index('audit_log_occurred_at_idx').on(table.occurredAt),
    actorIdIdx: index('audit_log_actor_id_idx').on(table.actorId),
  }),
);

export type AuditLogRow = typeof auditLog.$inferSelect;
export type InsertAuditLogRow = typeof auditLog.$inferInsert;
