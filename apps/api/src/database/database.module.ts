import { Global, Injectable, Module, type OnModuleInit, Inject } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { hashPassword } from '@controle-escolas/domain';
import { MODELS, type M, type SchoolDoc, type UserDoc } from './schemas';
import { MODEL } from './models';
import { env } from '../config/env';

// Seeds what the legacy `connect()` seeded: the two schools, and the owner from the environment when
// there are no users yet.
@Injectable()
class SeedService implements OnModuleInit {
  constructor(@Inject(MODEL.School) private readonly schools: M<SchoolDoc>, @Inject(MODEL.User) private readonly users: M<UserDoc>) {}

  async onModuleInit(): Promise<void> {
    if ((await this.schools.countDocuments()) === 0) await this.schools.create([{ name: 'Novo Mundo' }, { name: 'CIC' }]);
    if ((await this.users.countDocuments()) === 0 && env.seedOwnerEmail && env.seedOwnerPassword) {
      await this.users.create({ email: env.seedOwnerEmail, password_hash: hashPassword(env.seedOwnerPassword), role: 'owner' });
    }
  }
}

const features = MongooseModule.forFeature(Object.entries(MODELS).map(([name, schema]) => ({ name, schema })));

@Global()
@Module({
  imports: [MongooseModule.forRoot(env.mongoUri, { serverSelectionTimeoutMS: 5000 }), features],
  providers: [SeedService],
  exports: [features],
})
export class DatabaseModule {}
