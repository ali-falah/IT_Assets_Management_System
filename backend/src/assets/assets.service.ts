import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { Assignment } from '../assignments/entities/assignment.entity';
import { CategoriesService } from '../categories/categories.service';
import { LocationsService } from '../locations/locations.service';
import { RedisService } from '../redis/redis.service';
import { StatusesService } from '../statuses/statuses.service';
import { AssetImportDto } from './dto/asset-import.dto';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { Asset } from './entities/asset.entity';

@Injectable()
export class AssetsService {
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    @InjectRepository(Asset)
    private assetsRepository: Repository<Asset>,
    @InjectRepository(Assignment)
    private assignmentsRepository: Repository<Assignment>,
    private redisService: RedisService,
    private categoriesService: CategoriesService,
    private locationsService: LocationsService,
    private statusesService: StatusesService,
    private activityLogs: ActivityLogsService,
  ) { }

  async bulkImport(importData: AssetImportDto[]) {
    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Get all current statuses to map names to IDs
    const allStatuses = await this.statusesService.findAll();
    const defaultStatus = allStatuses.find(s => s.slug === 'available') || allStatuses[0];

    for (const item of importData) {
      try {
        // 1. Check if serial number already exists (case-insensitive check for safety)
        const existing = await this.assetsRepository.findOne({
          where: { serialNumber: item.serialNumber }
        });

        if (existing) {
          results.skipped++;
          results.errors.push(`Skipped ${item.serialNumber}: Serial number already exists.`);
          continue;
        }

        // 2. Get or create Category
        let category;
        if (item.category) {
          category = await this.categoriesService.getOrCreate(item.category);
        } else {
          category = await this.categoriesService.identifyAndGetCategory(item.name);
        }

        // 3. Get or create Location
        const location = item.location
          ? await this.locationsService.getOrCreate(item.location)
          : null;

        // 4. Find Status by name or fallback to slug
        let status = await this.statusesService.findByName(item.status);
        if (!status) {
          status = defaultStatus;
        }

        // 5. Create Asset
        const asset = this.assetsRepository.create({
          name: item.name,
          serialNumber: item.serialNumber,
          categoryId: category.id,
          locationId: location?.id || (await this.locationsService.findAll())[0]?.id,
          statusId: status.id,
          notes: item.notes,
          lastTransactionDate: new Date(),
        });

        await this.assetsRepository.save(asset);
        results.imported++;
      } catch (err) {
        results.errors.push(`Error importing ${item.serialNumber}: ${err.message}`);
        results.skipped++;
      }
    }

    await this.invalidateCache();
    return results;
  }

  async create(createAssetDto: CreateAssetDto): Promise<Asset> {
    const existing = await this.assetsRepository.findOne({ where: { serialNumber: createAssetDto.serialNumber } });
    if (existing) {
      throw new ConflictException('Asset with this serial number already exists');
    }
    const asset = this.assetsRepository.create({
      ...createAssetDto,
      lastTransactionDate: new Date(),
    });
    const saved = await this.assetsRepository.save(asset);

    // Log activity
    this.activityLogs.log({
      action: 'asset_created',
      message: `Asset "${saved.name}" was added to inventory`,
      entityId: saved.id,
      entityName: saved.name,
    });

    // If initially assigned, create history
    if (saved.assignedUserId) {
      await this.assignmentsRepository.save({
        assetId: saved.id,
        userId: saved.assignedUserId,
        assignedAt: new Date()
      });
    }

    await this.invalidateCache();
    return saved;
  }

  async findAll(query: any): Promise<{ data: Asset[]; total: number; page: number; limit: number }> {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 100;
    const cacheKey = `assets_list_${JSON.stringify(query)}`;

    const cachedData = await this.redisService.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const qb = this.assetsRepository.createQueryBuilder('asset')
      .leftJoinAndSelect('asset.category', 'category')
      .leftJoinAndSelect('asset.location', 'location')
      .leftJoinAndSelect('asset.assignedUser', 'assignedUser')
      .leftJoinAndSelect('asset.status', 'status');

    if (query.statusId) qb.andWhere('asset.statusId = :statusId', { statusId: query.statusId });
    if (query.statusSlug) qb.andWhere('status.slug = :statusSlug', { statusSlug: query.statusSlug });
    if (query.categoryId) qb.andWhere('asset.categoryId = :categoryId', { categoryId: query.categoryId });
    if (query.locationId) qb.andWhere('asset.locationId = :locationId', { locationId: query.locationId });
    if (query.assignedUserId) qb.andWhere('asset.assignedUserId = :assignedUserId', { assignedUserId: query.assignedUserId });

    if (query.search) {
      qb.andWhere('(asset.name ILIKE :search OR asset.serialNumber ILIKE :search OR assignedUser.name ILIKE :search)', { search: `%${query.search}%` });
    }

    qb.skip((page - 1) * limit).take(limit);
    qb.orderBy('asset.createdAt', 'DESC');

    const [data, total] = await qb.getManyAndCount();

    const result = { data, total, page, limit };
    await this.redisService.set(cacheKey, JSON.stringify(result), this.CACHE_TTL);

    return result;
  }

  async findOne(id: string): Promise<Asset> {
    const asset = await this.assetsRepository.findOne({
      where: { id },
      relations: ['category', 'location', 'assignedUser', 'assignments', 'assignments.user', 'maintenanceLogs', 'status'],
    });
    if (!asset) {
      throw new NotFoundException(`Asset with ID ${id} not found`);
    }
    // Sort assignments by date desc
    if (asset.assignments) {
      asset.assignments.sort((a, b) => b.assignedAt.getTime() - a.assignedAt.getTime());
    }
    return asset;
  }

  async update(id: string, updateAssetDto: UpdateAssetDto): Promise<Asset> {
    const asset = await this.findOne(id);
    const oldAssigneeId = asset.assignedUserId;
    const newAssigneeId = updateAssetDto.assignedUserId;

    return await this.assetsRepository.manager.transaction(async (transactionalEntityManager) => {

      // 1. History Tracking logic (same as before)
      const isAssigneeChanging = updateAssetDto.hasOwnProperty('assignedUserId') && oldAssigneeId !== newAssigneeId;



      if (isAssigneeChanging) {
        if (oldAssigneeId) {
          const activeAssignment = await transactionalEntityManager.findOne(Assignment, {
            where: { assetId: id, userId: oldAssigneeId, returnedAt: IsNull() },
            order: { assignedAt: 'DESC' }
          });
          if (activeAssignment) {
            activeAssignment.returnedAt = new Date();
            await transactionalEntityManager.save(Assignment, activeAssignment);
          }
        }

        if (newAssigneeId) {
          const existingActive = await transactionalEntityManager.findOne(Assignment, {
            where: { assetId: id, userId: newAssigneeId, returnedAt: IsNull() }
          });
          if (!existingActive) {
            await transactionalEntityManager.save(Assignment, {
              assetId: id,
              userId: newAssigneeId,
              assignedAt: new Date()
            });
          }
        }
      }

      // 2. Build explicit update object (only provided fields)
      const updateData: any = {
        lastTransactionDate: new Date(),
        updatedAt: new Date()
      };

      // 2.1. Aggressive Automatic Status Transition
      // This runs if the assignee changed, regardless of whether a status was provided in the DTO
      if (isAssigneeChanging) {
        const allStatuses = await this.statusesService.findAll();
        const stockStatus = allStatuses.find(s => s.slug === 'available' || s.name.toLowerCase().includes('stock') || s.name.toLowerCase().includes('available'));
        const inUseStatus = allStatuses.find(s => s.slug === 'assigned' || s.slug === 'in-use' || s.name.toLowerCase().includes('assigned') || s.name.toLowerCase().includes('in-use'));

        const providedStatusId = updateAssetDto.statusId;

        if (newAssigneeId) {
          // Being assigned to someone
          // If no status provided, OR if the provided status is the 'Stock' status, force it to 'In-Use'
          if (inUseStatus && (!providedStatusId || providedStatusId === stockStatus?.id || providedStatusId === '')) {
            updateData.statusId = inUseStatus.id;
          }
        } else {
          // Being unassigned (returned to stock)
          // If no status provided, OR if the provided status is the 'In-Use' status, force it to 'Stock'
          if (stockStatus && (!providedStatusId || providedStatusId === inUseStatus?.id || providedStatusId === '')) {
            updateData.statusId = stockStatus.id;
          }
        }
      }

      // Only include fields that are actually in the DTO and not undefined
      const fields = ['name', 'serialNumber', 'statusId', 'categoryId', 'locationId', 'assignedUserId', 'notes', 'imageUrl'];
      const dto = updateAssetDto as any;
      fields.forEach(field => {
        // Only set if not already set by our auto-logic above
        if (dto.hasOwnProperty(field) && dto[field] !== undefined && dto[field] !== '' && !updateData.hasOwnProperty(field)) {
          updateData[field] = dto[field];
        }
      });


      // 3. Perform the update directly on the table to avoid entity state issues
      await transactionalEntityManager.update(Asset, id, updateData);

      await this.invalidateCache();
      const fresh = await this.findOne(id);

      // Log meaningful changes
      const meta: Record<string, any> = {};
      if (updateData.categoryId && updateData.categoryId !== asset.categoryId) meta.category = 'changed';
      if (updateData.locationId && updateData.locationId !== asset.locationId) meta.location = 'changed';
      if (updateData.statusId && updateData.statusId !== asset.statusId) meta.status = 'changed';

      this.activityLogs.log({
        action: 'asset_updated',
        message: `Asset "${asset.name}" was updated`,
        entityId: id,
        entityName: asset.name,
        meta: Object.keys(meta).length ? meta : undefined,
      });

      return fresh;
    });
  }

  async bulkUpdate(ids: string[], updateAssetDto: UpdateAssetDto) {
    const results = {
      updated: 0,
      errors: [] as string[],
    };

    for (const id of ids) {
      try {
        await this.update(id, updateAssetDto);
        results.updated++;
      } catch (err) {
        results.errors.push(`Error updating ${id}: ${err.message}`);
      }
    }

    await this.invalidateCache();
    return results;
  }

  async remove(id: string, force: boolean = false): Promise<void> {
    const asset = await this.assetsRepository.findOne({
      where: { id },
      relations: ['assignedUser']
    });
    
    if (!asset) {
      throw new NotFoundException(`Asset with ID ${id} not found`);
    }

    if (asset.assignedUserId && !force) {
      throw new ConflictException(`Asset is currently assigned to ${asset.assignedUser?.name}. Unassign it first or use force delete.`);
    }

    await this.assetsRepository.manager.transaction(async (transactionalEntityManager) => {
      // 1. Delete all assignment history for this asset
      await transactionalEntityManager.delete(Assignment, { assetId: id });

      // 2. Unassign from asset (redundant if deleting, but good for history)
      await transactionalEntityManager.update(Asset, id, { assignedUserId: null });

      // 3. Hard Delete
      await transactionalEntityManager.delete(Asset, id);
    });

    // Log after successful delete
    this.activityLogs.log({
      action: 'asset_deleted',
      message: `Asset "${asset.name}" was removed from inventory`,
      entityId: id,
      entityName: asset.name,
    });

    await this.invalidateCache();
  }

  async bulkRemove(ids: string[], force: boolean = false): Promise<{ count: number; errors: string[] }> {
    let count = 0;
    const errors: string[] = [];
    
    for (const id of ids) {
      try {
        await this.remove(id, force);
        count++;
      } catch (err) {
        errors.push(err.message);
      }
    }
    await this.invalidateCache();
    return { count, errors };
  }

  private async invalidateCache() {
    const keys = await this.redisService.keys('assets_list_*');
    for (const key of keys) {
      await this.redisService.del(key);
    }
  }
}
