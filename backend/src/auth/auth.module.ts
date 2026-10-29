import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { GoogleService } from './google.service';
import { SessionsService } from './sessions.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionsService, GoogleService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AuthModule {}
