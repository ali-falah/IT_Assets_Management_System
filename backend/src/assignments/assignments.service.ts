import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Assignment } from './entities/assignment.entity';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { AssetsService } from '../assets/assets.service';
import { StatusesService } from '../statuses/statuses.service';

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectRepository(Assignment)
    private assignmentsRepository: Repository<Assignment>,
    private assetsService: AssetsService,
    private statusesService: StatusesService,
  ) {}

  async create(createAssignmentDto: CreateAssignmentDto): Promise<Assignment> {
    const assignment = this.assignmentsRepository.create(createAssignmentDto);
    const saved = await this.assignmentsRepository.save(assignment);
    
    // Update asset status and assignee
    const assignedStatus = await this.statusesService.findBySlug('assigned');
    if (!assignedStatus) {
      throw new Error('System Status "assigned" not found. Please ensure database is seeded correctly.');
    }
    await this.assetsService.update(createAssignmentDto.assetId, {
      statusId: assignedStatus.id,
      assignedUserId: createAssignmentDto.userId,
    });

    return saved;
  }

  async findAll(assetId?: string): Promise<Assignment[]> {
    const query = this.assignmentsRepository.createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.user', 'user')
      .leftJoinAndSelect('assignment.asset', 'asset')
      .orderBy('assignment.createdAt', 'DESC');

    if (assetId) {
      query.andWhere('assignment.assetId = :assetId', { assetId });
    }

    return query.getMany();
  }

  async findOne(id: string): Promise<Assignment> {
    const assignment = await this.assignmentsRepository.findOne({
      where: { id },
      relations: ['user', 'asset'],
    });
    if (!assignment) {
      throw new NotFoundException(`Assignment with ID ${id} not found`);
    }
    return assignment;
  }

  async update(id: string, updateAssignmentDto: UpdateAssignmentDto): Promise<Assignment> {
    const assignment = await this.findOne(id);
    Object.assign(assignment, updateAssignmentDto);
    const updated = await this.assignmentsRepository.save(assignment);

    if (updateAssignmentDto.returnedAt) {
      // Unassign the asset if returned
      const availableStatus = await this.statusesService.findBySlug('available');
      if (!availableStatus) {
        throw new Error('System Status "available" not found. Please ensure database is seeded correctly.');
      }
      await this.assetsService.update(assignment.assetId, {
        statusId: availableStatus.id,
        assignedUserId: null,
      });
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    const assignment = await this.findOne(id);
    await this.assignmentsRepository.remove(assignment);
  }
}
