import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { AssetImportDto } from './dto/asset-import.dto';
import { BulkUpdateAssetDto } from './dto/bulk-update-asset.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Assets')
@ApiBearerAuth()
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Roles('admin', 'technician')
  @Post('import')
  @ApiOperation({ summary: 'Bulk import assets' })
  async import(@Body() importData: AssetImportDto[]) {
    return this.assetsService.bulkImport(importData);
  }

  @Roles('admin', 'technician')
  @Patch('bulk-update')
  @ApiOperation({ summary: 'Bulk update assets' })
  async bulkUpdate(@Body() bulkUpdateDto: BulkUpdateAssetDto) {
    return this.assetsService.bulkUpdate(bulkUpdateDto.ids, bulkUpdateDto.data);
  }

  @Roles('admin', 'technician')
  @Post()
  @ApiOperation({ summary: 'Create an asset' })
  create(@Body() createAssetDto: CreateAssetDto) {
    return this.assetsService.create(createAssetDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all assets with pagination and filters' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'assignedUserId', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(@Query() query: any) {
    return this.assetsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an asset by id' })
  findOne(@Param('id') id: string) {
    return this.assetsService.findOne(id);
  }


  @Roles('admin', 'technician')
  @Patch(':id')
  @ApiOperation({ summary: 'Update an asset' })
  update(@Param('id') id: string, @Body() updateAssetDto: UpdateAssetDto) {
    return this.assetsService.update(id, updateAssetDto);
  }

  @Roles('admin')
  @Post('bulk-delete')
  @ApiOperation({ summary: 'Bulk delete assets' })
  async bulkRemove(@Body('ids') ids: string[], @Query('force') force: string) {
    return this.assetsService.bulkRemove(ids, force === 'true');
  }

  @Roles('admin')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete an asset' })
  remove(@Param('id') id: string, @Query('force') force: string) {
    return this.assetsService.remove(id, force === 'true');
  }
}
