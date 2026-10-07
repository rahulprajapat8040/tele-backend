import { Logger } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export const DATABASE = Symbol('DATABASE');

const logger = new Logger('DatabaseProvider');

export const databaseProvider = {
  provide: DATABASE,
  inject: [],
  useFactory: () => {
    const DB_URL = process.env.DATABASE_URL!;
    if (!DB_URL) {
      logger.error('Database url not provided');
    }
    const pool = new Pool({ connectionString: DB_URL });
    return drizzle({ client: pool });
  },
};

export type Database = ReturnType<
  typeof databaseProvider.useFactory
>;