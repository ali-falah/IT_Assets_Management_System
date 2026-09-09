import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ActivityLogsQueryDto, ActivityLogsService } from './activity-logs.service';

@ApiTags('Activity Logs')
@ApiBearerAuth()
@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private readonly service: ActivityLogsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get summary statistics for activity logs' })
  getStats() {
    return this.service.getStats();
  }

  @Get()
  @ApiOperation({ summary: 'Find all activity logs with filtering and pagination' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'entityId', required: false })
  findAll(@Query() query: ActivityLogsQueryDto) {
    return this.service.findAll(query);
  }
}
