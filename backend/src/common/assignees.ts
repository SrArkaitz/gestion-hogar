import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Lista de personas asignadas: sin repetidos y todas miembros de la casa. */
export async function parseAssigneeIds(prisma: PrismaService, householdId: string, value: unknown): Promise<string[]> {
  if (!Array.isArray(value) || !value.every((id) => typeof id === 'string')) {
    throw new BadRequestException('assigneeIds tiene que ser una lista de usuarios');
  }
  const unique = [...new Set(value as string[])];
  const members = unique.length
    ? await prisma.householdMember.count({ where: { householdId, userId: { in: unique } } })
    : 0;
  if (members !== unique.length) throw new BadRequestException('Solo se puede asignar a miembros de la casa');
  return unique;
}
