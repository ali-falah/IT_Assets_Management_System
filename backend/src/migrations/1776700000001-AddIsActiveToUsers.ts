import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsActiveToUsers1776700000001 implements MigrationInterface {
  name = 'AddIsActiveToUsers1776700000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "isActive" boolean NOT NULL DEFAULT true`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isActive"`);
  }
}
