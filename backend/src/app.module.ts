import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { AuthModule } from './auth/auth.module';
import { BackupModule } from './backup/backup.module';
import { HealthController } from './health/health.controller';
import { HouseholdsModule } from './households/households.module';
import { IdeasModule } from './ideas/ideas.module';
import { PrismaModule } from './prisma/prisma.module';
import { TasksModule } from './tasks/tasks.module';

// Carpeta con el frontend compilado. En Docker se copia a backend/public.
const publicDir = resolve(process.env.PUBLIC_DIR ?? join(__dirname, '..', 'public'));

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    HouseholdsModule,
    TasksModule,
    IdeasModule,
    BackupModule,
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
