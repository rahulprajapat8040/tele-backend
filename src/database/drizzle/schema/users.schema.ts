import { pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { SCHEMA_NAMES } from 'src/utils/constant/database.constant';

export const users = pgTable(
  SCHEMA_NAMES.USERS,
  {
    id: uuid('id').defaultRandom().primaryKey(),
    username: varchar('username', { length: 32 }).unique(),
    firstName: varchar('first_name', { length: 50 }),
    lastName: varchar('last_name', { length: 50 }),
    profilePic: varchar('profile_pic', { length: 100 }),
    bio: varchar('bio', { length: 500 }),
    countryCode: varchar('country_code', { length: 5 }).notNull(),
    phoneNo: varchar('phone_no', { length: 15 }).notNull(),
    email: varchar('email', { length: 50 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    unique('users_phone_unique').on(table.countryCode, table.phoneNo),
  ],
);
