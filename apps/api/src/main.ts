import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { env } from './config/env';
import { InputError } from '@controle-escolas/domain';

const isAllowedOrigin = (origin: string | undefined): boolean =>
  !!origin && (env.corsOrigins.includes(origin) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin));

export async function createApp(): Promise<NestExpressApplication> {
  // Body parsing is done here (not by Nest's default) so the 1 MB limit and the error messages match the legacy API.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false, logger: process.env.NEST_LOG ? ['error', 'warn', 'log'] : ['error', 'warn'] });
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(json({ limit: env.maxBody }));
  // A JSON body must be an object (arrays are valid JSON but never a valid request here).
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (Array.isArray(req.body)) return next(new InputError('corpo da requisição não é um JSON de objeto válido'));
    next();
  });
  app.enableCors({
    origin: (origin, cb) => cb(null, isAllowedOrigin(origin) ? origin : false),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    maxAge: 600,
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  return app;
}

async function bootstrap(): Promise<void> {
  const app = await createApp();
  await app.listen(env.port, env.host);
  console.log(`Controle das Escolas API em http://${env.host}:${env.port}`);
}

if (require.main === module) void bootstrap();
