import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatusesService } from './statuses.service';
import { StatusesController } from './statuses.controller';
import { Status } from './entities/status.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Status])],
  controllers: [StatusesController],
  providers: [StatusesService],
  exports: [StatusesService],
})
export class StatusesModule {}
