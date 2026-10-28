import 'reflect-metadata';
import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  // En desarrollo el frontend corre en :4200 y usa el proxy de Angular,
  // pero dejamos CORS abierto por si se llama a la API directamente.
  app.enableCors();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`Gestión del hogar escuchando en http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
