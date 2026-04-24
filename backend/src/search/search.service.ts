import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import { Asset } from '../assets/entities/asset.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Asset)
    private assetRepository: Repository<Asset>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async globalSearch(query: string) {
    if (!query || query.length < 2) return { assets: [], users: [] };

    const [assets, users] = await Promise.all([
      this.assetRepository.find({
        where: [
          { name: ILike(`%${query}%`) },
          { serialNumber: ILike(`%${query}%`) },
        ],
        take: 10,
        relations: ['category', 'status'],
      }),
      this.userRepository.find({
        where: [
          { name: ILike(`%${query}%`) },
          { email: ILike(`%${query}%`) },
        ],
        take: 10,
        relations: ['role'],
      }),
    ]);

    return {
      assets: assets.map(a => ({
        id: a.id,
        name: a.name,
        subtitle: `${a.category?.name} • ${a.serialNumber}`,
        type: 'asset',
        status: a.status?.name,
      })),
      users: users.map(u => ({
        id: u.id,
        name: u.name,
        subtitle: u.role?.name || 'User',
        type: 'user',
        email: u.email,
      })),
    };
  }
}
