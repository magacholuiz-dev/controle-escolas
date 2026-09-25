import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators';
import { clearSessionCookie, sessionToken, setSessionCookie } from '../common/cookies';
import type { Body as Json } from '../common/validation';
import { InputError } from '@controle-escolas/domain';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public() @Post('login') @HttpCode(200)
  async login(@Body() body: Json, @Res({ passthrough: true }) res: Response) {
    const { token, maxAgeSeconds, user } = await this.auth.login(body.email, body.password);
    setSessionCookie(res, token, maxAgeSeconds);
    return { user };
  }

  @Public() @Post('logout') @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(sessionToken(req));
    clearSessionCookie(res);
    return { ok: true };
  }

  @Public() @Get('me')
  async me(@Req() req: Request) {
    const user = await this.auth.userFromToken(sessionToken(req));
    if (!user) throw new InputError('sessão inválida ou ausente', 401);
    return { user };
  }
}
