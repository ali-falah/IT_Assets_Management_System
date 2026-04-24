import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserRole } from './entities/user-role.entity';
import { UserRolesService } from './user-roles.service';
import { UserRolesController } from './user-roles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserRole])],
  providers: [UserRolesService],
  controllers: [UserRolesController],
  exports: [UserRolesService],
})
export class UserRolesModule {}
