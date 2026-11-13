-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Birthday" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "year" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Birthday_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Birthday" ("createdAt", "day", "householdId", "id", "month", "name", "year") SELECT "createdAt", "day", "householdId", "id", "month", "name", "year" FROM "Birthday";
DROP TABLE "Birthday";
ALTER TABLE "new_Birthday" RENAME TO "Birthday";
CREATE INDEX "Birthday_householdId_idx" ON "Birthday"("householdId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

