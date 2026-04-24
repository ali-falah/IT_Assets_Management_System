import { Controller, Get, Post, Body, UseGuards, Param, Patch, Delete, Request, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('admin')
  findAll() {
    return this.usersService.findAll();
  }

  @Post('import')
  @Roles('admin')
  import(@Body('users') users: string[]) {
    return this.usersService.bulkImportEmployees(users);
  }

  @Get(':id')
  @Roles('admin')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() updateUserDto: any) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string, @Request() req: any, @Query('force') force: string) {
    return this.usersService.remove(id, req.user?.id, force === 'true');
  }

  @Post('bulk-delete')
  @Roles('admin')
  bulkRemove(@Body('ids') ids: string[], @Request() req: any, @Query('force') force: string) {
    return this.usersService.bulkRemove(ids, req.user?.id, force === 'true');
  }
}
