import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import { allowedSchoolIds, type AuthedRequest, type SessionUser } from './session';

export const IS_PUBLIC = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): SessionUser => {
  return (ctx.switchToHttp().getRequest<AuthedRequest>().user) as SessionUser;
});

// The schools this request may touch (null = all of them).
export const Scope = createParamDecorator((_: unknown, ctx: ExecutionContext): string[] | null => {
  return allowedSchoolIds((ctx.switchToHttp().getRequest<AuthedRequest>().user) as SessionUser);
});
