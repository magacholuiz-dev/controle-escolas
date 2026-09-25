import { Global, Module } from '@nestjs/common';
import { ResourcesService } from './resources.service';

@Global()
@Module({ providers: [ResourcesService], exports: [ResourcesService] })
export class ResourcesModule {}
