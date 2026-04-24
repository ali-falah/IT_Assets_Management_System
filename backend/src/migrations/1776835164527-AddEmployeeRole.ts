import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmployeeRole1776835164527 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO "user_roles" ("name", "description", "colorClass")
            VALUES ('employee', 'External employee - no system access', 'bg-slate-50 text-slate-400')
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "user_roles" WHERE "name" = 'employee'`);
    }

}
