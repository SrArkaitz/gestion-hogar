import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { HouseholdsModule } from './households/households.module';
import { PrismaModule } from './prisma/prisma.module';

// Carpeta con el frontend compilado. En Docker se copia a backend/public.
const publicDir = resolve(process.env.PUBLIC_DIR ?? join(__dirname, '..', 'public'));

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    HouseholdsModule,
    ...(existsSync(publicDir)
      ? [
          ServeStaticModule.forRoot({
            rootPath: publicDir,
            exclude: ['/api/{*path}'],
          }),
        ]
      : []),
  ],
  controllers: [HealthController],
})
export class AppModule {}
