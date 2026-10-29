-- CreateTable
CREATE TABLE "TaskAssignee" (
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    PRIMARY KEY ("taskId", "userId"),
    CONSTRAINT "TaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Las tareas que tenían una persona asignada pasan a tenerla en la lista nueva.
INSERT INTO "TaskAssignee" ("taskId", "userId") SELECT "id", "assigneeId" FROM "Task" WHERE "assigneeId" IS NOT NULL;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HouseholdMember" (
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'miembro',
    "color" TEXT NOT NULL DEFAULT 'azul',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("householdId", "userId"),
    CONSTRAINT "HouseholdMember_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HouseholdMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
-- Paleta nueva (la de las etiquetas de Trello): cada miembro recibe un color distinto
-- dentro de su casa, por orden de llegada.
INSERT INTO "new_HouseholdMember" ("householdId", "joinedAt", "role", "userId", "color")
SELECT "householdId", "joinedAt", "role", "userId",
  CASE (ROW_NUMBER() OVER (PARTITION BY "householdId" ORDER BY "joinedAt") - 1) % 10
    WHEN 0 THEN 'azul' WHEN 1 THEN 'verde' WHEN 2 THEN 'naranja' WHEN 3 THEN 'morado' WHEN 4 THEN 'rojo'
    WHEN 5 THEN 'celeste' WHEN 6 THEN 'rosa' WHEN 7 THEN 'lima' WHEN 8 THEN 'amarillo' ELSE 'gris'
  END
FROM "HouseholdMember";
DROP TABLE "HouseholdMember";
ALTER TABLE "new_HouseholdMember" RENAME TO "HouseholdMember";
CREATE INDEX "HouseholdMember_userId_idx" ON "HouseholdMember"("userId");
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'por_hacer',
    "priority" TEXT NOT NULL DEFAULT 'media',
    "due" TEXT,
    "category" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("category", "createdAt", "createdById", "due", "householdId", "id", "notes", "priority", "status", "title", "updatedAt") SELECT "category", "createdAt", "createdById", "due", "householdId", "id", "notes", "priority", "status", "title", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_householdId_status_idx" ON "Task"("householdId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TaskAssignee_userId_idx" ON "TaskAssignee"("userId");

