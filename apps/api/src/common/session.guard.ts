import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from './decorators';
import { AuthService } from '../auth/auth.service';
import { sessionToken } from './cookies';
import type { AuthedRequest } from './session';
import { InputError } from '@controle-escolas/domain';

// Every route needs a valid session unless it is marked @Public().
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, @Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const user = await this.auth.userFromToken(sessionToken(req));
    if (!user) throw new InputError('sessão inválida ou ausente', 401);
    req.user = user;
    return true;
  }
}
