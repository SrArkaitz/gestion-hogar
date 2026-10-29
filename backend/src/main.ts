import 'reflect-metadata';
import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  // La sesión va en una cookie. Sin CORS: la web y la API se sirven desde el mismo
  // origen (en desarrollo, a través del proxy de Angular).
  app.use(cookieParser());

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`Gestión del hogar escuchando en http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
