import { Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UserRole } from '../user-roles/entities/user-role.entity';
import * as bcrypt from 'bcrypt';

import { Asset } from '../assets/entities/asset.entity';
import { Assignment } from '../assignments/entities/assignment.entity';
import { Status } from '../statuses/entities/status.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(UserRole)
    private rolesRepository: Repository<UserRole>,
    @InjectRepository(Asset)
    private assetsRepository: Repository<Asset>,
    @InjectRepository(Assignment)
    private assignmentsRepository: Repository<Assignment>,
    @InjectRepository(Status)
    private statusesRepository: Repository<Status>,
  ) { }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(createUserDto.password, salt);

    // Resolve roleId — accept either roleId (uuid) or role name string
    let roleId: string | undefined = (createUserDto as any).roleId;
    if (!roleId && (createUserDto as any).role) {
      const found = await this.rolesRepository.findOne({ where: { name: (createUserDto as any).role } });
      roleId = found?.id;
    }
    if (!roleId) {
      // Default to 'viewer'
      const viewer = await this.rolesRepository.findOne({ where: { name: 'viewer' } });
      roleId = viewer?.id;
    }

    const user = this.usersRepository.create({ name: createUserDto.name, email: createUserDto.email, passwordHash, roleId });
    return this.usersRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    const users = await this.usersRepository.find({ relations: ['role', 'assets'] });
    return users;
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['role', 'assets', 'assets.category', 'assets.status', 'assignments', 'assignments.asset']
    });
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);

    // Sort assignments by date desc
    if (user.assignments) {
      user.assignments.sort((a, b) => b.assignedAt.getTime() - a.assignedAt.getTime());
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email }, relations: ['role'] });
  }

  async update(id: string, updateUserDto: any): Promise<User> {
    const user = await this.findById(id);

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existing = await this.findByEmail(updateUserDto.email);
      if (existing) throw new ConflictException('Email already in use');
    }

    if (updateUserDto.password) {
      const salt = await bcrypt.genSalt(10);
      updateUserDto.passwordHash = await bcrypt.hash(updateUserDto.password, salt);
      delete updateUserDto.password;
    }

    Object.assign(user, updateUserDto);
    return this.usersRepository.save(user);
  }

  async updateRole(id: string, roleId: string): Promise<User> {
    await this.usersRepository.update(id, { roleId });
    return this.findById(id);
  }

  async count(): Promise<number> {
    return this.usersRepository.count();
  }

  async bulkImportEmployees(names: string[]): Promise<{ imported: number, skipped: number, errors: string[] }> {
    const employeeRole = await this.rolesRepository.findOne({ where: { name: 'employee' } });
    if (!employeeRole) {
      throw new Error('Employee role not found. Please ensure roles are seeded.');
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Use a fixed random hash for all employees since they can't login anyway
    const dummyHash = await bcrypt.hash(Math.random().toString(36), 10);

    for (const name of names) {
      const trimmedName = name.trim();
      if (!trimmedName) continue;

      try {
        // Check if user with same name already exists
        const existingByName = await this.usersRepository.findOne({ where: { name: trimmedName } });
        if (existingByName) {
          skipped++;
          continue;
        }

        // Generate a unique-ish email
        const sanitized = trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '.');
        const email = `${sanitized}.${Math.floor(Math.random() * 1000)}@employee.internal`;

        const user = this.usersRepository.create({
          name: trimmedName,
          email,
          passwordHash: dummyHash,
          roleId: employeeRole.id,
          isActive: true
        });

        await this.usersRepository.save(user);
        imported++;
      } catch (err) {
        errors.push(`Error importing ${trimmedName}: ${err.message}`);
      }
    }

    return { imported, skipped, errors };
  }

  async remove(id: string, requestingUserId?: string, force: boolean = false): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['assets']
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (user.email === 'admin@test.com') {
      throw new ForbiddenException('The system administrator account (admin@test.com) cannot be deleted.');
    }

    if (id === requestingUserId) {
      throw new ForbiddenException('You cannot delete your own account while logged in.');
    }

    if (user.assets && user.assets.length > 0 && !force) {
      throw new ConflictException(`${user.name} has ${user.assets.length} assets assigned. Unassign them first or use force delete.`);
    }

    await this.usersRepository.manager.transaction(async (transactionalEntityManager) => {
      // 1. Unassign all assets currently held by this user
      const assets = await transactionalEntityManager.find(Asset, { where: { assignedUserId: id } });

      if (assets.length > 0) {
        // Find Stock status
        const stockStatus = await transactionalEntityManager.findOne(Status, {
          where: [
            { slug: 'available' },
            { name: 'Stock' },
            { name: 'Available' }
          ]
        });

        for (const asset of assets) {
          await transactionalEntityManager.update(Asset, asset.id, {
            assignedUserId: null,
            statusId: stockStatus?.id || asset.statusId,
            lastTransactionDate: new Date()
          });
        }
      }

      // 2. Delete all assignment history for this user
      await transactionalEntityManager.delete(Assignment, { userId: id });

      // 3. Delete the user
      await transactionalEntityManager.remove(User, user);
    });
  }

  async bulkRemove(ids: string[], requestingUserId?: string, force: boolean = false): Promise<{ count: number; errors: string[] }> {
    let count = 0;
    const errors: string[] = [];
    for (const id of ids) {
      try {
        await this.remove(id, requestingUserId, force);
        count++;
      } catch (err) {
        errors.push(err.message);
      }
    }
    return { count, errors };
  }
}
