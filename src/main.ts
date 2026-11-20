import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import Redis from 'ioredis';
import { RedisIoAdapter } from './infrastructure/socket/redis-io.adapter';
import cookieParser from 'cookie-parser';

const logger = new Logger('Telegram Root');
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const redisUrl = process.env.REDIS_URL!;

  if (!redisUrl) {
    throw new Error('REDIS_URL is not configured');
  }
  logger.log('Connecting Redis Pub/Sub...');
  const pubClient = new Redis(redisUrl, { lazyConnect: true });
  const subClient = new Redis(redisUrl, { lazyConnect: true });
  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);

    logger.log('Redis Pub/Sub connected successfully');

    const redisIoAdapter = new RedisIoAdapter(app, pubClient, subClient);

    app.useWebSocketAdapter(redisIoAdapter);

    app.enableShutdownHooks();

    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        forbidNonWhitelisted: true,
        whitelist: true,
      }),
    );

    app.enableCors({
      origin: ['http://localhost:5173'],
      credentials: true,
    });

    app.use(cookieParser());

    const config = new DocumentBuilder()
      .setTitle('Telegram apis')
      .setDescription('The Telegram API description')
      .setVersion('1.0')
      .addTag('Telegram')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'jwt' },
        'access-token',
      )
      .build();
    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, documentFactory);

    const PORT = process.env.PORT!;
    await app.listen(PORT);
    logger.log(`Server started on PORT ${PORT}`);

    app.getHttpServer().on('close', async () => {
      await Promise.all([pubClient.quit(), subClient.quit()]);
    });
  } catch (error) {
    logger.error('Application startup failed', error);

    await Promise.allSettled([pubClient.quit(), subClient.quit()]);

    throw error;
  }
}
bootstrap();
