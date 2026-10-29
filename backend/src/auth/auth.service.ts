import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { LoginInput, Me, NAME_MAX_LENGTH, PASSWORD_MIN_LENGTH, RegisterInput, Role } from '@hogar/shared';
import * as argon2 from 'argon2';
import { RateLimiter } from '../common/rate-limiter';
import { asObject, emailField, requiredText } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';

const MINUTE = 60_000;

@Injectable()
export class AuthService {
  /** 5 fallos seguidos con el mismo correo desde la misma IP. */
  private readonly loginFailures = new RateLimiter(5, 15 * MINUTE);
  /** 20 fallos en total desde una IP, pruebe el correo que pruebe. */
  private readonly loginFailuresByIp = new RateLimiter(20, 15 * MINUTE);
  /** 10 cuentas nuevas por hora desde una IP. */
  private readonly registrations = new RateLimiter(10, 60 * MINUTE);
  /** Hash de relleno para que un correo inexistente tarde lo mismo que uno real. */
  private dummyHash?: Promise<string>;

  constructor(private readonly prisma: PrismaService) {}

  async register(body: unknown, ip: string): Promise<string> {
    this.registrations.check(ip);
    const input = this.validateRegister(body);
    if (await this.prisma.user.findUnique({ where: { email: input.email } })) {
      throw new ConflictException('Ya hay una cuenta con ese correo');
    }
    const user = await this.prisma.user.create({
      data: { name: input.name, email: input.email, passwordHash: await argon2.hash(input.password) },
    });
    this.registrations.hit(ip);
    return user.id;
  }

  async login(body: unknown, ip: string): Promise<string> {
    const b = asObject(body);
    const input: LoginInput = {
      email: emailField(b['email']),
      password: typeof b['password'] === 'string' ? b['password'] : '',
    };
    const key = `${ip}|${input.email}`;
    this.loginFailures.check(key);
    this.loginFailuresByIp.check(ip);

    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    const ok = user
      ? await argon2.verify(user.passwordHash, input.password)
      : await argon2.verify(await this.getDummyHash(), input.password).then(() => false);
    if (!user || !ok) {
      this.loginFailures.hit(key);
      this.loginFailuresByIp.hit(ip);
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }
    this.loginFailures.reset(key);
    return user.id;
  }

  async me(userId: string): Promise<Me> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        memberships: { include: { household: true }, orderBy: { joinedAt: 'asc' } },
      },
    });
    return {
      user: { id: user.id, name: user.name, email: user.email },
      households: user.memberships.map((m) => ({ id: m.household.id, name: m.household.name, role: m.role as Role })),
    };
  }

  private validateRegister(body: unknown): RegisterInput {
    const b = asObject(body);
    const password = typeof b['password'] === 'string' ? b['password'] : '';
    if (password.length < PASSWORD_MIN_LENGTH) {
      throw new BadRequestException(`La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`);
    }
    if (password.length > 200) throw new BadRequestException('La contraseña es demasiado larga');
    return {
      name: requiredText(b['name'], 'El nombre', NAME_MAX_LENGTH),
      email: emailField(b['email']),
      password,
    };
  }

  private getDummyHash(): Promise<string> {
    return (this.dummyHash ??= argon2.hash('contraseña-de-relleno'));
  }
}
