import { Global, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { models } from './models';

@Global()
@Module({
  imports: [
    SequelizeModule.forRoot({
      dialect: 'postgres',
      uri: process.env.DATABASE_URL!,
      sync: { alter: true },
      synchronize: true,
      logging: process.env.SEQUELIZE_LOGGING === 'true' ? console.log : false,
      autoLoadModels: true,
      define: {
        underscored: false,
        freezeTableName: true,
      },
      models,
    }),
    SequelizeModule.forFeature(models),
  ],
  exports: [SequelizeModule],
})
export class DatabaseModule {}
