import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Lista de personas asignadas: sin repetidos y todas miembros de la casa. */
export function parseAssigneeIds(prisma: PrismaService, householdId: string, value: unknown): Promise<string[]> {
  return parseMemberIds(prisma, householdId, value, 'assigneeIds', 'Solo se puede asignar a miembros de la casa');
}

/**
 * Lista de miembros de la casa, sin repetidos y en el orden en que entraron en ella
 * (así, al repartir un gasto, los céntimos que sobran caen siempre en los mismos).
 */
export async function parseMemberIds(
  prisma: PrismaService,
  householdId: string,
  value: unknown,
  field: string,
  notMember: string,
): Promise<string[]> {
  if (!Array.isArray(value) || !value.every((id) => typeof id === 'string')) {
    throw new BadRequestException(`${field} tiene que ser una lista de usuarios`);
  }
  const unique = [...new Set(value as string[])];
  if (!unique.length) return [];
  const members = await prisma.householdMember.findMany({
    where: { householdId, userId: { in: unique } },
    orderBy: { joinedAt: 'asc' },
    select: { userId: true },
  });
  if (members.length !== unique.length) throw new BadRequestException(notMember);
  return members.map((m) => m.userId);
}
