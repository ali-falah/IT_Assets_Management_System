import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateStatusDto } from './dto/create-status.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { Status } from './entities/status.entity';

@Injectable()
export class StatusesService {
  constructor(
    @InjectRepository(Status)
    private statusesRepository: Repository<Status>,
  ) {}

  create(createStatusDto: CreateStatusDto): Promise<Status> {
    const status = this.statusesRepository.create(createStatusDto);
    return this.statusesRepository.save(status);
  }

  findAll(): Promise<Status[]> {
    return this.statusesRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Status> {
    const status = await this.statusesRepository.findOneBy({ id });
    if (!status) {
      throw new NotFoundException(`Status with ID ${id} not found`);
    }
    return status;
  }

  async findByName(name: string): Promise<Status | null> {
    return this.statusesRepository.findOneBy({ name });
  }

  async findBySlug(slug: string): Promise<Status | null> {
    return this.statusesRepository.findOneBy({ slug });
  }

  async update(id: string, updateStatusDto: UpdateStatusDto): Promise<Status> {
    const status = await this.findOne(id);
    
    // Optional: protect system statuses from renaming
    if (status.isSystem && updateStatusDto.name && status.name !== updateStatusDto.name) {
      throw new BadRequestException(`Cannot rename system status`);
    }

    Object.assign(status, updateStatusDto);
    return this.statusesRepository.save(status);
  }

  async remove(id: string): Promise<void> {
    const status = await this.findOne(id);
    if (status.isSystem) {
      throw new BadRequestException(`Cannot delete system status`);
    }
    await this.statusesRepository.remove(status);
  }
}
