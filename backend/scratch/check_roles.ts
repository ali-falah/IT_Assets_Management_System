import { DataSource } from 'typeorm';
import { UserRole } from '../src/user-roles/entities/user-role.entity';
import { dataSourceOptions } from '../src/data-source';

async function check() {
  const ds = new DataSource({
    ...dataSourceOptions,
    entities: [UserRole],
    synchronize: false,
  });
  await ds.initialize();
  const repo = ds.getRepository(UserRole);
  const roles = await repo.find();
  await ds.destroy();
}

check().catch(console.error);
