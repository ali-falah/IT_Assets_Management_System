import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStatusEntity1776687014191 implements MigrationInterface {
    name = 'AddStatusEntity1776687014191'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "assets" RENAME COLUMN "status" TO "statusId"`);
        await queryRunner.query(`ALTER TYPE "public"."assets_status_enum" RENAME TO "assets_statusid_enum"`);
        await queryRunner.query(`CREATE TABLE "statuses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "colorClass" character varying, "isSystem" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_037e43ea842b18ce4e5f4dcfd06" UNIQUE ("name"), CONSTRAINT "PK_2fd3770acdb67736f1a3e3d5399" PRIMARY KEY ("id"))`);
        
        // Insert default system statuses
        await queryRunner.query(`INSERT INTO "statuses" ("name", "colorClass", "isSystem") VALUES ('Available', 'bg-green-100 text-green-700', true)`);
        await queryRunner.query(`INSERT INTO "statuses" ("name", "colorClass", "isSystem") VALUES ('Assigned', 'bg-indigo-100 text-indigo-700', true)`);
        await queryRunner.query(`INSERT INTO "statuses" ("name", "colorClass", "isSystem") VALUES ('Under Maintenance', 'bg-amber-100 text-amber-700', true)`);
        await queryRunner.query(`INSERT INTO "statuses" ("name", "colorClass", "isSystem") VALUES ('Retired', 'bg-slate-100 text-slate-700', true)`);

        await queryRunner.query(`ALTER TABLE "assets" DROP COLUMN "statusId"`);
        await queryRunner.query(`ALTER TABLE "assets" ADD "statusId" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "assets" ADD CONSTRAINT "FK_eac224433eb66ded5ab3222718c" FOREIGN KEY ("statusId") REFERENCES "statuses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT "FK_eac224433eb66ded5ab3222718c"`);
        await queryRunner.query(`ALTER TABLE "assets" DROP COLUMN "statusId"`);
        await queryRunner.query(`ALTER TABLE "assets" ADD "statusId" "public"."assets_statusid_enum" NOT NULL DEFAULT 'available'`);
        await queryRunner.query(`DROP TABLE "statuses"`);
        await queryRunner.query(`ALTER TYPE "public"."assets_statusid_enum" RENAME TO "assets_status_enum"`);
        await queryRunner.query(`ALTER TABLE "assets" RENAME COLUMN "statusId" TO "status"`);
    }

}
