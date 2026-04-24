import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { Asset } from './entities/asset.entity';
import { Assignment } from '../assignments/entities/assignment.entity';

import { CategoriesModule } from '../categories/categories.module';
import { LocationsModule } from '../locations/locations.module';
import { StatusesModule } from '../statuses/statuses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Asset, Assignment]),
    CategoriesModule,
    LocationsModule,
    StatusesModule
  ],
  providers: [AssetsService],
  controllers: [AssetsController],
  exports: [AssetsService],
})
export class AssetsModule {}
