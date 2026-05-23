import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssetsService } from '../assets/assets.service';
import { StatusesService } from '../statuses/statuses.service';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';
import { Maintenance } from './entities/maintenance.entity';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(Maintenance)
    private maintenanceRepository: Repository<Maintenance>,
    private assetsService: AssetsService,
    private statusesService: StatusesService,
  ) {}

  async create(createMaintenanceDto: CreateMaintenanceDto): Promise<Maintenance> {
    const maintenance = this.maintenanceRepository.create(createMaintenanceDto);
    const saved = await this.maintenanceRepository.save(maintenance);
    
    const maintenanceStatus = await this.statusesService.findBySlug('maintenance');
    if (!maintenanceStatus) {
      throw new Error('System Status "maintenance" not found. Please ensure database is seeded correctly.');
    }
    await this.assetsService.update(createMaintenanceDto.assetId, {
      statusId: maintenanceStatus.id,
    });

    return saved;
  }

  async findAll(assetId?: string): Promise<Maintenance[]> {
    const query = this.maintenanceRepository.createQueryBuilder('maintenance')
      .leftJoinAndSelect('maintenance.technician', 'technician')
      .leftJoinAndSelect('maintenance.asset', 'asset')
      .orderBy('maintenance.createdAt', 'DESC');

    if (assetId) {
      query.andWhere('maintenance.assetId = :assetId', { assetId });
    }

    return query.getMany();
  }

  async findOne(id: string): Promise<Maintenance> {
    const maintenance = await this.maintenanceRepository.findOne({
      where: { id },
      relations: ['technician', 'asset'],
    });
    if (!maintenance) {
      throw new NotFoundException(`Maintenance record with ID ${id} not found`);
    }
    return maintenance;
  }

  async update(id: string, updateMaintenanceDto: UpdateMaintenanceDto): Promise<Maintenance> {
    const maintenance = await this.findOne(id);
    Object.assign(maintenance, updateMaintenanceDto);
    const updated = await this.maintenanceRepository.save(maintenance);

    if (updateMaintenanceDto.endDate) {
      const availableStatus = await this.statusesService.findBySlug('available');
      if (!availableStatus) {
        throw new Error('System Status "available" not found. Please ensure database is seeded correctly.');
      }
      await this.assetsService.update(maintenance.assetId, {
        statusId: availableStatus.id,
      });
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    const maintenance = await this.findOne(id);
    await this.maintenanceRepository.remove(maintenance);
  }
}
