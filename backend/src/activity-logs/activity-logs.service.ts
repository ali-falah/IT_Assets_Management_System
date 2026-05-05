import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog, ActivityAction } from './entities/activity-log.entity';

export interface LogActivityDto {
  action: ActivityAction;
  message: string;
  entityId?: string;
  entityName?: string;
  secondaryId?: string;
  secondaryName?: string;
  actorId?: string;
  actorName?: string;
  meta?: Record<string, any>;
}

@Injectable()
export class ActivityLogsService {
  constructor(
    @InjectRepository(ActivityLog)
    private repo: Repository<ActivityLog>,
  ) {}

  async log(dto: LogActivityDto): Promise<void> {
    try {
      const entry = this.repo.create(dto);
      await this.repo.save(entry);
    } catch (err) {
      // Never let logging crash the main flow
      console.error('[ActivityLog] Failed to write log:', err.message);
    }
  }

  async findAll(limit = 200): Promise<ActivityLog[]> {
    return this.repo.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
