-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RecurringTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "checklist" TEXT NOT NULL DEFAULT '[]',
    "priority" TEXT NOT NULL DEFAULT 'media',
    "category" TEXT,
    "frequency" TEXT NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "weekdays" TEXT NOT NULL DEFAULT '',
    "startDate" TEXT NOT NULL,
    "nextDate" TEXT NOT NULL,
    "lastDate" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecurringTask_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecurringTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RecurringTask" ("active", "category", "createdAt", "createdById", "frequency", "householdId", "id", "interval", "lastDate", "nextDate", "notes", "priority", "startDate", "title", "updatedAt", "weekdays") SELECT "active", "category", "createdAt", "createdById", "frequency", "householdId", "id", "interval", "lastDate", "nextDate", "notes", "priority", "startDate", "title", "updatedAt", "weekdays" FROM "RecurringTask";
DROP TABLE "RecurringTask";
ALTER TABLE "new_RecurringTask" RENAME TO "RecurringTask";
CREATE INDEX "RecurringTask_active_nextDate_idx" ON "RecurringTask"("active", "nextDate");
CREATE INDEX "RecurringTask_householdId_idx" ON "RecurringTask"("householdId");
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
    "doneAt" DATETIME,
    "checklist" TEXT NOT NULL DEFAULT '[]',
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_recurringId_fkey" FOREIGN KEY ("recurringId") REFERENCES "RecurringTask" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("archivedAt", "category", "createdAt", "createdById", "doneAt", "due", "householdId", "id", "notes", "personal", "priority", "recurringId", "status", "title", "updatedAt") SELECT "archivedAt", "category", "createdAt", "createdById", "doneAt", "due", "householdId", "id", "notes", "personal", "priority", "recurringId", "status", "title", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_householdId_status_idx" ON "Task"("householdId", "status");
CREATE INDEX "Task_recurringId_idx" ON "Task"("recurringId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "googleId" TEXT,
    "avatar" TEXT,
    "notifyOff" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("avatar", "createdAt", "email", "googleId", "id", "name", "passwordHash") SELECT "avatar", "createdAt", "email", "googleId", "id", "name", "passwordHash" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

