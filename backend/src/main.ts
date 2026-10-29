import 'reflect-metadata';
import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  // La sesión va en una cookie. Sin CORS: la web y la API se sirven desde el mismo
  // origen (en desarrollo, a través del proxy de Angular).
  app.use(cookieParser());
  // Las fotos de las recetas y los archivos de los equipos llegan tal cual (sin multipart).
  // Los límites de verdad (8 MB las fotos, 20 MB los archivos, con un mensaje claro) los ponen
  // sus servicios; este es solo un tope.
  app.useBodyParser('raw', { type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], limit: '25mb' });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`Gestión del hogar escuchando en http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
