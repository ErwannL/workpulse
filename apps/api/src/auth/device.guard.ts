import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService, bearerToken, type AuthenticatedDevice } from './auth.service';

/** Requête enrichie par le garde : le reste du code lit `request.device`. */
export interface RequestWithDevice {
  headers: Record<string, string | string[] | undefined>;
  device?: AuthenticatedDevice;
}

@Injectable()
export class DeviceGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithDevice>();
    const header = request.headers.authorization;
    const token = bearerToken(typeof header === 'string' ? header : undefined);
    if (token === null) {
      throw new UnauthorizedException('Jeton d’appareil absent.');
    }
    const device = await this.auth.resolve(token);
    if (device === null) {
      throw new UnauthorizedException('Jeton d’appareil invalide ou révoqué.');
    }
    request.device = device;
    return true;
  }
}
