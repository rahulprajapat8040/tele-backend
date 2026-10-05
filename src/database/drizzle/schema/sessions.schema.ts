import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { SCHEMA_NAMES } from 'src/utils/constant/database.constant';
import { devices } from './devices.schema';

export const sessions = pgTable(SCHEMA_NAMES.SESSIONS, {
  id: uuid('id').defaultRandom().primaryKey(),
  deviceId: uuid('device_id')
    .notNull()
    .references(() => devices.id, { onDelete: 'cascade' }),

  refreshTokenHash: varchar('refresh_token_hash', {
    length: 255,
  }).notNull(),

  createdAt: timestamp('created_at', {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),

  lastUsedAt: timestamp('last_used_at', {
    withTimezone: true,
  }),

  expiresAt: timestamp('expires_at', {
    withTimezone: true,
  }),

  revokedAt: timestamp('revoked_at', {
    withTimezone: true,
  }),
});
