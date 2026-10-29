-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Recipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "minutes" INTEGER,
    "servings" INTEGER NOT NULL,
    "ingredients" TEXT NOT NULL DEFAULT '[]',
    "steps" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT NOT NULL DEFAULT '',
    "photo" TEXT,
    "private" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Recipe_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Recipe_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Recipe" ("createdAt", "createdById", "duration", "householdId", "id", "ingredients", "kind", "minutes", "name", "notes", "photo", "servings", "steps", "updatedAt") SELECT "createdAt", "createdById", "duration", "householdId", "id", "ingredients", "kind", "minutes", "name", "notes", "photo", "servings", "steps", "updatedAt" FROM "Recipe";
DROP TABLE "Recipe";
ALTER TABLE "new_Recipe" RENAME TO "Recipe";
CREATE INDEX "Recipe_householdId_idx" ON "Recipe"("householdId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

