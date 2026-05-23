import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
config(); // Load from .env

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'it_assets',
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/**/migrations/*.js'],
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
