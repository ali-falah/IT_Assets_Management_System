import { MigrationInterface, QueryRunner } from "typeorm";

export class MajorUpdateAssetTransactions1776834323856 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Add lastTransactionDate column
        await queryRunner.query(`ALTER TABLE "assets" ADD "lastTransactionDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);

        // 2. Initialize lastTransactionDate from updatedAt
        await queryRunner.query(`UPDATE "assets" SET "lastTransactionDate" = "updatedAt"`);

        // 3. Remove old date columns
        await queryRunner.query(`ALTER TABLE "assets" DROP COLUMN "purchaseDate"`);
        await queryRunner.query(`ALTER TABLE "assets" DROP COLUMN "warrantyExpiry"`);

        // 4. Add 'Removed' status if it doesn't exist
        await queryRunner.query(`
            INSERT INTO "statuses" ("name", "slug", "colorClass", "isSystem")
            VALUES ('Removed', 'removed', 'bg-red-100 text-red-700', true)
            ON CONFLICT ("slug") DO NOTHING
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "assets" ADD "purchaseDate" DATE`);
        await queryRunner.query(`ALTER TABLE "assets" ADD "warrantyExpiry" DATE`);
        await queryRunner.query(`ALTER TABLE "assets" DROP COLUMN "lastTransactionDate"`);
        await queryRunner.query(`DELETE FROM "statuses" WHERE "slug" = 'removed'`);
    }

}
