import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1776678909069 implements MigrationInterface {
    name = 'InitialSchema1776678909069'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_8b0be371d28245da6e4f4b61878" UNIQUE ("name"), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "locations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "address" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_227023051ab1fedef7a3b6c7e2a" UNIQUE ("name"), CONSTRAINT "PK_7cc1c9e3853b94816c094825e74" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "assignments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "assetId" uuid NOT NULL, "userId" uuid NOT NULL, "assignedAt" TIMESTAMP NOT NULL, "returnedAt" TIMESTAMP, "notes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c54ca359535e0012b04dcbd80ee" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "maintenance" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "assetId" uuid NOT NULL, "technicianId" uuid NOT NULL, "description" character varying NOT NULL, "startDate" date NOT NULL, "endDate" date, "cost" numeric(10,2), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_542fb6a28537140d2df95faa52a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."assets_status_enum" AS ENUM('available', 'assigned', 'under_maintenance', 'retired')`);
        await queryRunner.query(`CREATE TABLE "assets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "serialNumber" character varying NOT NULL, "status" "public"."assets_status_enum" NOT NULL DEFAULT 'available', "purchaseDate" date, "warrantyExpiry" date, "categoryId" uuid NOT NULL, "locationId" uuid NOT NULL, "assignedUserId" uuid, "imageUrl" character varying, "notes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_6d1ff17a763abe352afe92921d6" UNIQUE ("serialNumber"), CONSTRAINT "PK_da96729a8b113377cfb6a62439c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('admin', 'technician', 'viewer')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'viewer', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "assignments" ADD CONSTRAINT "FK_4b8be0008f0435cc90587a16638" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assignments" ADD CONSTRAINT "FK_a6f942932652357658b130088ad" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "maintenance" ADD CONSTRAINT "FK_9058b16f0503ef1df0b88fa0448" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "maintenance" ADD CONSTRAINT "FK_1e16264d8c6b72bfb8f88c0df81" FOREIGN KEY ("technicianId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assets" ADD CONSTRAINT "FK_2e847f9d0120b4ca0d7269dda0e" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assets" ADD CONSTRAINT "FK_b594ab59868668b4a1fdbcd97f6" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assets" ADD CONSTRAINT "FK_b9879eb8360ce4bdea3aed0f00a" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT "FK_b9879eb8360ce4bdea3aed0f00a"`);
        await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT "FK_b594ab59868668b4a1fdbcd97f6"`);
        await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT "FK_2e847f9d0120b4ca0d7269dda0e"`);
        await queryRunner.query(`ALTER TABLE "maintenance" DROP CONSTRAINT "FK_1e16264d8c6b72bfb8f88c0df81"`);
        await queryRunner.query(`ALTER TABLE "maintenance" DROP CONSTRAINT "FK_9058b16f0503ef1df0b88fa0448"`);
        await queryRunner.query(`ALTER TABLE "assignments" DROP CONSTRAINT "FK_a6f942932652357658b130088ad"`);
        await queryRunner.query(`ALTER TABLE "assignments" DROP CONSTRAINT "FK_4b8be0008f0435cc90587a16638"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP TABLE "assets"`);
        await queryRunner.query(`DROP TYPE "public"."assets_status_enum"`);
        await queryRunner.query(`DROP TABLE "maintenance"`);
        await queryRunner.query(`DROP TABLE "assignments"`);
        await queryRunner.query(`DROP TABLE "locations"`);
        await queryRunner.query(`DROP TABLE "categories"`);
    }

}
