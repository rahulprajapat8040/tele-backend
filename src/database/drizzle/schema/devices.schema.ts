import { pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { SCHEMA_NAMES } from 'src/utils/constant/database.constant';
import { users } from './users.schema';
import { DevicePlatform } from 'src/utils/constant/enums';

export const devicePlatform = pgEnum(
  'device_platform',
  Object.values(DevicePlatform) as [string, ...string[]],
);

export const devices = pgTable(SCHEMA_NAMES.DEVICES, {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, {
      onDelete: 'cascade',
    }),
  platform: devicePlatform('platform').notNull(),
  name: varchar('name', { length: 100 }),
  model: varchar('model', { length: 100 }),
  appVersion: varchar('app_version', { length: 30 }),
  fcmToken: varchar('fcm_token', { length: 500 }),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  revokedAt: timestamp('revoked_at', {
    withTimezone: true,
  }),
});
