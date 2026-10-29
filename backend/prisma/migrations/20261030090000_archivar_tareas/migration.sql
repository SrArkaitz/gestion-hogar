-- AlterTable
ALTER TABLE "Task" ADD COLUMN "archivedAt" DATETIME;
ALTER TABLE "Task" ADD COLUMN "doneAt" DATETIME;


-- Las que ya estaban hechas empiezan a contar desde su última modificación.
UPDATE "Task" SET "doneAt" = "updatedAt" WHERE "status" = 'hecho';
