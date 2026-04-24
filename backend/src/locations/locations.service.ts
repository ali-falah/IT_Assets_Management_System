import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from './entities/location.entity';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private locationsRepository: Repository<Location>,
  ) {}

  async create(createLocationDto: CreateLocationDto): Promise<Location> {
    const existing = await this.locationsRepository.findOne({ where: { name: createLocationDto.name } });
    if (existing) {
      throw new ConflictException('Location with this name already exists');
    }
    const location = this.locationsRepository.create(createLocationDto);
    return this.locationsRepository.save(location);
  }

  async findAll(): Promise<Location[]> {
    return this.locationsRepository.find();
  }

  async findOne(id: string): Promise<Location> {
    const location = await this.locationsRepository.findOne({ where: { id } });
    if (!location) {
      throw new NotFoundException(`Location with ID ${id} not found`);
    }
    return location;
  }

  async update(id: string, updateLocationDto: UpdateLocationDto): Promise<Location> {
    const location = await this.findOne(id);
    Object.assign(location, updateLocationDto);
    return this.locationsRepository.save(location);
  }

  async remove(id: string): Promise<void> {
    const location = await this.findOne(id);
    await this.locationsRepository.remove(location);
  }

  async getOrCreate(name: string): Promise<Location> {
    const existing = await this.locationsRepository.findOne({ where: { name } });
    if (existing) return existing;
    const location = this.locationsRepository.create({ name });
    return this.locationsRepository.save(location);
  }
}
