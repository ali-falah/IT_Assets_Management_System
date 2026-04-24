import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSlugToStatuses1776710000000 implements MigrationInterface {
    name = 'AddSlugToStatuses1776710000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Add slug column as nullable first
        await queryRunner.query(`ALTER TABLE "statuses" ADD "slug" character varying`);

        // 2. Populate slugs based on current names
        // Mapping:
        // 'Stock' -> 'available'
        // 'In-Use' -> 'assigned'
        // 'Out of service' -> 'maintenance'
        // 'Damaged' -> 'damaged'
        
        await queryRunner.query(`UPDATE "statuses" SET "slug" = 'available' WHERE "name" = 'Stock'`);
        await queryRunner.query(`UPDATE "statuses" SET "slug" = 'assigned' WHERE "name" = 'In-Use'`);
        await queryRunner.query(`UPDATE "statuses" SET "slug" = 'maintenance' WHERE "name" = 'Out of service'`);
        await queryRunner.query(`UPDATE "statuses" SET "slug" = 'damaged' WHERE "name" = 'Damaged'`);
        
        // Populate any others that might have been left out (defaulting to lowercased name)
        await queryRunner.query(`UPDATE "statuses" SET "slug" = LOWER(REPLACE("name", ' ', '_')) WHERE "slug" IS NULL`);

        // 3. Make slug NOT NULL and UNIQUE
        await queryRunner.query(`ALTER TABLE "statuses" ALTER COLUMN "slug" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "statuses" ADD CONSTRAINT "UQ_statuses_slug" UNIQUE ("slug")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "statuses" DROP CONSTRAINT "UQ_statuses_slug"`);
        await queryRunner.query(`ALTER TABLE "statuses" DROP COLUMN "slug"`);
    }

}
