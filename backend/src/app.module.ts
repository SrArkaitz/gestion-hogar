import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { existsSync } from 'fs';
import { join } from 'path';
import { CardsModule } from './cards/cards.module';

// Carpeta con el frontend compilado. En Docker se copia a backend/public.
const publicDir = process.env.PUBLIC_DIR ?? join(__dirname, '..', 'public');

@Module({
  imports: [
    CardsModule,
    ...(existsSync(publicDir)
      ? [
          ServeStaticModule.forRoot({
            rootPath: publicDir,
            exclude: ['/api/{*path}'],
          }),
        ]
      : []),
  ],
})
export class AppModule {}
