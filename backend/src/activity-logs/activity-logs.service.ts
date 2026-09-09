import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Assignment } from '../assignments/entities/assignment.entity';
import { ActivityAction, ActivityLog } from './entities/activity-log.entity';

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

export class ActivityLogsQueryDto {
  limit?: number;
  page?: number;
  search?: string;
  action?: string;
  category?: 'all' | 'assets' | 'assignments' | 'users' | 'deletions';
  startDate?: string;
  endDate?: string;
  entityId?: string;
  actorId?: string;
}

export interface ActivityStats {
  totalCount: number;
  assetEventsCount: number;
  assignmentEventsCount: number;
  userEventsCount: number;
  last24hCount: number;
}

@Injectable()
export class ActivityLogsService {
  constructor(
    @InjectRepository(ActivityLog)
    private repo: Repository<ActivityLog>,
    @InjectRepository(Assignment)
    private assignmentRepo: Repository<Assignment>,
  ) {}

  async log(dto: LogActivityDto): Promise<void> {
    try {
      const entry = this.repo.create(dto);
      await this.repo.save(entry);
    } catch (err: any) {
      // Never let logging crash the main flow
      console.error('[ActivityLog] Failed to write log:', err?.message);
    }
  }

  async findAll(query: ActivityLogsQueryDto = {}): Promise<{ data: ActivityLog[]; total: number; page: number; limit: number }> {
    const limit = Math.min(Math.max(query.limit ? Number(query.limit) : 200, 1), 1000);
    const page = Math.max(query.page ? Number(query.page) : 1, 1);
    const skip = (page - 1) * limit;

    const qb = this.repo.createQueryBuilder('log');

    if (query.search) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(log.message) LIKE :search OR LOWER(log.entityName) LIKE :search OR LOWER(log.secondaryName) LIKE :search OR LOWER(log.actorName) LIKE :search)',
        { search }
      );
    }

    if (query.action) {
      qb.andWhere('log.action = :action', { action: query.action });
    } else if (query.category) {
      if (query.category === 'assets') {
        qb.andWhere("log.action LIKE 'asset_%' AND log.action NOT IN ('asset_assigned', 'asset_returned')");
      } else if (query.category === 'assignments') {
        qb.andWhere("log.action IN ('asset_assigned', 'asset_returned')");
      } else if (query.category === 'users') {
        qb.andWhere("log.action LIKE 'user_%'");
      } else if (query.category === 'deletions') {
        qb.andWhere("log.action IN ('asset_deleted', 'user_deleted')");
      }
    }

    if (query.entityId) {
      qb.andWhere('log.entityId = :entityId', { entityId: query.entityId });
    }

    if (query.actorId) {
      qb.andWhere('log.actorId = :actorId', { actorId: query.actorId });
    }

    if (query.startDate) {
      qb.andWhere('log.createdAt >= :startDate', { startDate: new Date(query.startDate) });
    }

    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      qb.andWhere('log.createdAt <= :endDate', { endDate: end });
    }

    qb.orderBy('log.createdAt', 'DESC');
    qb.skip(skip);
    qb.take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }

  async getStats(): Promise<ActivityStats> {
    const logsTotalCount = await this.repo.count();
    
    const assetEventsCount = await this.repo
      .createQueryBuilder('log')
      .where("log.action LIKE 'asset_%' AND log.action NOT IN ('asset_assigned', 'asset_returned')")
      .getCount();

    const loggedAssignmentEvents = await this.repo
      .createQueryBuilder('log')
      .where("log.action IN ('asset_assigned', 'asset_returned')")
      .getCount();

    const assignmentsCount = await this.assignmentRepo.count();
    const returnsCount = await this.assignmentRepo
      .createQueryBuilder('a')
      .where('a.returnedAt IS NOT NULL')
      .getCount();

    const assignmentEventsCount = Math.max(loggedAssignmentEvents, assignmentsCount + returnsCount);

    const userEventsCount = await this.repo
      .createQueryBuilder('log')
      .where("log.action LIKE 'user_%'")
      .getCount();

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const logsLast24h = await this.repo
      .createQueryBuilder('log')
      .where('log.createdAt >= :yesterday', { yesterday })
      .getCount();

    const assignmentsLast24h = await this.assignmentRepo
      .createQueryBuilder('a')
      .where('a.assignedAt >= :yesterday', { yesterday })
      .getCount();

    const returnsLast24h = await this.assignmentRepo
      .createQueryBuilder('a')
      .where('a.returnedAt >= :yesterday', { yesterday })
      .getCount();

    const last24hCount = logsLast24h + assignmentsLast24h + returnsLast24h;
    const totalCount = logsTotalCount + (assignmentsCount + returnsCount);

    return {
      totalCount,
      assetEventsCount,
      assignmentEventsCount,
      userEventsCount,
      last24hCount,
    };
  }
}
