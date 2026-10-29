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
  // Las fotos de las recetas llegan tal cual (sin multipart), ya reducidas en el navegador.
  // El límite de verdad (8 MB, con un mensaje claro) lo pone RecipesService; este es solo un tope.
  app.useBodyParser('raw', { type: ['image/jpeg', 'image/png', 'image/webp'], limit: '20mb' });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`Gestión del hogar escuchando en http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
