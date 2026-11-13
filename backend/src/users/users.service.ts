import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { NotificationKind, User } from '@hogar/shared';
import { asObject } from '../common/validation';
import { parseKinds } from '../notifications/kinds';
import { PrismaService } from '../prisma/prisma.service';
import { AVATAR_FILE_RE, avatarUrl, PHOTO_MAX_BYTES, photoExtension, photosDir } from '../recipes/photos';

/** La foto de perfil ya llega reducida (AVATAR_SIDE): con esto sobra. */
const AVATAR_MAX_BYTES = Math.min(PHOTO_MAX_BYTES, 2 * 1024 * 1024);

/** Foto de perfil de cada persona. Se guarda junto a las de las recetas (y entra en la copia diaria). */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async setAvatar(userId: string, data: unknown): Promise<User> {
    if (!Buffer.isBuffer(data) || !data.length) throw new BadRequestException('Falta la foto');
    if (data.length > AVATAR_MAX_BYTES) throw new BadRequestException('La foto es demasiado grande');
    const file = `avatar-${userId}-${randomBytes(4).toString('hex')}.${photoExtension(data)}`;
    mkdirSync(photosDir(), { recursive: true });
    writeFileSync(join(photosDir(), file), data);
    const before = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { avatar: true } });
    const user = await this.prisma.user.update({ where: { id: userId }, data: { avatar: file } });
    this.deleteFile(before.avatar);
    return { id: user.id, name: user.name, email: user.email, avatarUrl: avatarUrl(user.id, user.avatar) };
  }

  async setNotifyOff(userId: string, body: unknown): Promise<{ off: NotificationKind[] }> {
    const off = parseKinds(asObject(body)['off']);
    await this.prisma.user.update({ where: { id: userId }, data: { notifyOff: JSON.stringify(off) } });
    return { off };
  }

  async removeAvatar(userId: string): Promise<User> {
    const before = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { avatar: true } });
    const user = await this.prisma.user.update({ where: { id: userId }, data: { avatar: null } });
    this.deleteFile(before.avatar);
    return { id: user.id, name: user.name, email: user.email, avatarUrl: null };
  }

  /** Solo la ven quien la puso y quien comparte casa con esa persona. */
  async avatarPath(viewerId: string, userId: string): Promise<string> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        ...(viewerId !== userId && { memberships: { some: { household: { members: { some: { userId: viewerId } } } } } }),
      },
      select: { avatar: true },
    });
    if (!user?.avatar || !AVATAR_FILE_RE.test(user.avatar)) throw new NotFoundException('No tiene foto');
    return join(photosDir(), user.avatar);
  }

  private deleteFile(file: string | null) {
    if (!file || !AVATAR_FILE_RE.test(file)) return;
    try {
      unlinkSync(join(photosDir(), file));
    } catch (err) {
      this.logger.warn(`No se pudo borrar la foto ${file}: ${(err as Error).message}`);
    }
  }
}
