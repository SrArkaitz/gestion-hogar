import { BirthdayDate, daysInMonth } from '@hogar/shared';
import { BadRequestException } from '@nestjs/common';
import { asObject } from '../common/validation';

/** Cumpleaños guardado (mes y día), o null si no lo ha puesto. */
export function birthdayOf(user: { birthMonth: number | null; birthDay: number | null }): BirthdayDate | null {
  return user.birthMonth && user.birthDay ? { month: user.birthMonth, day: user.birthDay } : null;
}

/** { "month": 1–12, "day": 1–31 } con un día que exista en ese mes (el 29 de febrero vale). */
export function parseBirthday(body: unknown): BirthdayDate {
  const b = asObject(body);
  const month = b['month'], day = b['day'];
  if (!Number.isInteger(month) || (month as number) < 1 || (month as number) > 12) {
    throw new BadRequestException('Mes: valor no válido (1–12)');
  }
  if (!Number.isInteger(day) || (day as number) < 1 || (day as number) > daysInMonth(month as number)) {
    throw new BadRequestException('Ese día no existe en ese mes');
  }
  return { month: month as number, day: day as number };
}
