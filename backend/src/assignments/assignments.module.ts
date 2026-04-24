import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignmentsService } from './assignments.service';
import { AssignmentsController } from './assignments.controller';
import { Assignment } from './entities/assignment.entity';
import { AssetsModule } from '../assets/assets.module';
import { StatusesModule } from '../statuses/statuses.module';

@Module({
  imports: [TypeOrmModule.forFeature([Assignment]), AssetsModule, StatusesModule],
  providers: [AssignmentsService],
  controllers: [AssignmentsController],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
