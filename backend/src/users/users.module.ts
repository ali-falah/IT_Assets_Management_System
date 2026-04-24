import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { UserRole } from '../user-roles/entities/user-role.entity';
import { Asset } from '../assets/entities/asset.entity';
import { Assignment } from '../assignments/entities/assignment.entity';
import { Status } from '../statuses/entities/status.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserRole, Asset, Assignment, Status])],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
