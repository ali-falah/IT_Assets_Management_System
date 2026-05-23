import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from '../assets/entities/asset.entity';
import { Assignment } from '../assignments/entities/assignment.entity';
import { Maintenance } from '../maintenance/entities/maintenance.entity';
import { Status } from '../statuses/entities/status.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Asset)
    private assetsRepo: Repository<Asset>,
    @InjectRepository(Assignment)
    private assignmentsRepo: Repository<Assignment>,
    @InjectRepository(Maintenance)
    private maintenanceRepo: Repository<Maintenance>,
    @InjectRepository(Status)
    private statusesRepo: Repository<Status>,
  ) {}

  async getStats() {
    // Total asset count
    const total = await this.assetsRepo.count();

    // Dynamically build status counts from the statuses table
    const statuses = await this.statusesRepo.find({ order: { name: 'ASC' } });
    const byStatus = await Promise.all(
      statuses.map(async (status) => {
        const count = await this.assetsRepo.count({ where: { statusId: status.id } });
        return {
          id: status.id,
          name: status.name,
          colorClass: status.colorClass || 'bg-slate-100 text-slate-700',
          count,
        };
      }),
    );

    // Assets by category — fully from DB
    const byCategory = await this.assetsRepo
      .createQueryBuilder('asset')
      .leftJoin('asset.category', 'category')
      .select('category.name', 'categoryName')
      .addSelect('COUNT(asset.id)', 'count')
      .groupBy('category.name')
      .orderBy('count', 'DESC')
      .limit(8)
      .getRawMany();

    // Expiring warranties — REMOVED
    const warrantiesWithDays: any[] = [];

    // Recent activity
    const recentAssignments = await this.assignmentsRepo.find({
      relations: ['asset', 'user'],
      order: { createdAt: 'DESC' },
      take: 5,
    });

    const recentMaintenance = await this.maintenanceRepo.find({
      relations: ['asset'],
      order: { createdAt: 'DESC' },
      take: 5,
    });

    const recentActivity = [
      ...recentAssignments.map((a) => ({
        type: 'assignment',
        message: `${a.asset?.name} assigned to ${a.user?.name ?? 'a user'}`,
        date: a.createdAt,
      })),
      ...recentMaintenance.map((m) => ({
        type: 'maintenance',
        message: `${m.asset?.name} ${m.endDate ? 'maintenance completed' : 'sent for maintenance'}`,
        date: m.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);

    return {
      kpi: { total, byStatus },
      byCategory,
      expiringWarranties: warrantiesWithDays,
      recentActivity,
    };
  }
}
