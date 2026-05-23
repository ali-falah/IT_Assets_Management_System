import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asset } from '../assets/entities/asset.entity';
import { Assignment } from '../assignments/entities/assignment.entity';
import { Category } from '../categories/entities/category.entity';
import { Maintenance } from '../maintenance/entities/maintenance.entity';
import { Status } from '../statuses/entities/status.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([Asset, Assignment, Maintenance, Category, Status])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
