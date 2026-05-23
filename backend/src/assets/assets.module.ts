import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Assignment } from '../assignments/entities/assignment.entity';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { Asset } from './entities/asset.entity';

import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { CategoriesModule } from '../categories/categories.module';
import { LocationsModule } from '../locations/locations.module';
import { StatusesModule } from '../statuses/statuses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Asset, Assignment]),
    CategoriesModule,
    LocationsModule,
    StatusesModule,
    ActivityLogsModule,
  ],
  providers: [AssetsService],
  controllers: [AssetsController],
  exports: [AssetsService],
})
export class AssetsModule {}
