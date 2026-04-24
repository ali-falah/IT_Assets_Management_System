import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { StatusesService } from './statuses.service';
import { CreateStatusDto } from './dto/create-status.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Statuses')
@ApiBearerAuth()
@Controller('statuses')
export class StatusesController {
  constructor(private readonly statusesService: StatusesService) {}

  @Roles('admin', 'technician')
  @Post()
  @ApiOperation({ summary: 'Create a status' })
  create(@Body() createStatusDto: CreateStatusDto) {
    return this.statusesService.create(createStatusDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all statuses' })
  findAll() {
    return this.statusesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a status by id' })
  findOne(@Param('id') id: string) {
    return this.statusesService.findOne(id);
  }

  @Roles('admin', 'technician')
  @Patch(':id')
  @ApiOperation({ summary: 'Update a status' })
  update(@Param('id') id: string, @Body() updateStatusDto: UpdateStatusDto) {
    return this.statusesService.update(id, updateStatusDto);
  }

  @Roles('admin')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a status' })
  remove(@Param('id') id: string) {
    return this.statusesService.remove(id);
  }
}
