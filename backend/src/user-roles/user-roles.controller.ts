import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { UserRolesService } from './user-roles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('User Roles')
@ApiBearerAuth()
@Controller('user-roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserRolesController {
  constructor(private readonly service: UserRolesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @Roles('admin')
  create(@Body() body: { name: string; description?: string; colorClass?: string }) {
    return this.service.create(body);
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; colorClass?: string },
  ) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
