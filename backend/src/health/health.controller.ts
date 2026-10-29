import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';

/** Comprobación rápida de que la API y la base de datos responden. */
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  }
}
