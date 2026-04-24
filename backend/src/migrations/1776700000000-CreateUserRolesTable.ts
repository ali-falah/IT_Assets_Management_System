import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserRolesTable1776700000000 implements MigrationInterface {
  name = 'CreateUserRolesTable1776700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create the user_roles table
    await queryRunner.query(`
      CREATE TABLE "user_roles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "description" character varying,
        "colorClass" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_roles_name" UNIQUE ("name"),
        CONSTRAINT "PK_user_roles" PRIMARY KEY ("id")
      )
    `);

    // 2. Seed the three default roles with colors
    await queryRunner.query(`
      INSERT INTO "user_roles" ("name", "description", "colorClass") VALUES
        ('admin',      'Full system access',          'bg-indigo-100 text-indigo-700'),
        ('technician', 'Asset management access',     'bg-blue-100 text-blue-700'),
        ('viewer',     'Read-only access',            'bg-slate-100 text-slate-700')
    `);

    // 3. Add a roleId column to users (nullable first so existing rows don't break)
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN "roleId" uuid
    `);

    // 4. Populate roleId by matching the existing role enum value to the new table
    await queryRunner.query(`
      UPDATE "users" u
      SET "roleId" = r.id
      FROM "user_roles" r
      WHERE u.role::text = r.name
    `);

    // 5. Make roleId NOT NULL now that all rows are populated
    await queryRunner.query(`
      ALTER TABLE "users" ALTER COLUMN "roleId" SET NOT NULL
    `);

    // 6. Add the foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "FK_users_roleId"
      FOREIGN KEY ("roleId") REFERENCES "user_roles"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // 7. Drop the old enum column (role) from users
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);

    // 8. Drop the PostgreSQL ENUM type
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."users_role_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate the old enum column
    await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('admin', 'technician', 'viewer')`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "role" "public"."users_role_enum" NOT NULL DEFAULT 'viewer'`);

    // Restore values from roleId
    await queryRunner.query(`
      UPDATE "users" u
      SET "role" = r.name::"public"."users_role_enum"
      FROM "user_roles" r
      WHERE u."roleId" = r.id
    `);

    // Drop the foreign key and roleId column
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_roleId"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "roleId"`);

    // Drop the user_roles table
    await queryRunner.query(`DROP TABLE "user_roles"`);
  }
}
