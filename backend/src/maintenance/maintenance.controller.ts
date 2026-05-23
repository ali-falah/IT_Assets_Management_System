import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';
import { MaintenanceService } from './maintenance.service';

@ApiTags('Maintenance')
@ApiBearerAuth()
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Roles('admin', 'technician')
  @Post()
  @ApiOperation({ summary: 'Create a maintenance record' })
  create(@Body() createMaintenanceDto: CreateMaintenanceDto) {
    return this.maintenanceService.create(createMaintenanceDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all maintenance records' })
  @ApiQuery({ name: 'assetId', required: false })
  findAll(@Query('assetId') assetId?: string) {
    return this.maintenanceService.findAll(assetId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a maintenance record by id' })
  findOne(@Param('id') id: string) {
    return this.maintenanceService.findOne(id);
  }

  @Roles('admin', 'technician')
  @Patch(':id')
  @ApiOperation({ summary: 'Update a maintenance record' })
  update(@Param('id') id: string, @Body() updateMaintenanceDto: UpdateMaintenanceDto) {
    return this.maintenanceService.update(id, updateMaintenanceDto);
  }

  @Roles('admin')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a maintenance record' })
  remove(@Param('id') id: string) {
    return this.maintenanceService.remove(id);
  }
}
