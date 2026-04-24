import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceController } from './maintenance.controller';
import { Maintenance } from './entities/maintenance.entity';
import { AssetsModule } from '../assets/assets.module';
import { StatusesModule } from '../statuses/statuses.module';

@Module({
  imports: [TypeOrmModule.forFeature([Maintenance]), AssetsModule, StatusesModule],
  providers: [MaintenanceService],
  controllers: [MaintenanceController],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
