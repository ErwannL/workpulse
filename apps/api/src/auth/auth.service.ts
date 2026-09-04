import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthenticatedDevice {
  deviceId: string;
  userId: string;
}

/** Vue minimale de Prisma utilisée ici : facilite le test sans base réelle. */
export interface DeviceLookup {
  device: {
    findUnique(args: {
      where: { tokenHash: string };
    }): Promise<{ id: string; userId: string; revokedAt: Date | null } | null>;
    update(args: { where: { id: string }; data: { lastSeenAt: Date } }): Promise<unknown>;
  };
}

/** Jeton d'appariement : 32 octets, présenté une seule fois au moment du lien. */
export function generateDeviceToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Le jeton n'est jamais stocké en clair. Un SHA-256 suffit ici : le secret est
 * déjà à haute entropie, une dérivation lente n'apporterait rien contre une
 * attaque par dictionnaire qui n'a aucune prise.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Comparaison à temps constant de deux empreintes hexadécimales. */
export function tokensMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Extrait le jeton d'un en-tête `Authorization`. */
export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  /** Résout un jeton en appareil actif, ou `null`. Met à jour la dernière vue. */
  async resolve(
    token: string,
    db: DeviceLookup = this.prisma,
  ): Promise<AuthenticatedDevice | null> {
    const device = await db.device.findUnique({ where: { tokenHash: hashToken(token) } });
    if (device === null || device.revokedAt !== null) return null;
    await db.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
    return { deviceId: device.id, userId: device.userId };
  }
}
