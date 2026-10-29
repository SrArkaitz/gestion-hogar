-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'por_hacer',
    "priority" TEXT NOT NULL DEFAULT 'media',
    "due" TEXT,
    "category" TEXT,
    "personal" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "recurringId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_recurringId_fkey" FOREIGN KEY ("recurringId") REFERENCES "RecurringTask" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("category", "createdAt", "createdById", "due", "householdId", "id", "notes", "priority", "recurringId", "status", "title", "updatedAt") SELECT "category", "createdAt", "createdById", "due", "householdId", "id", "notes", "priority", "recurringId", "status", "title", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_householdId_status_idx" ON "Task"("householdId", "status");
CREATE INDEX "Task_recurringId_idx" ON "Task"("recurringId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

