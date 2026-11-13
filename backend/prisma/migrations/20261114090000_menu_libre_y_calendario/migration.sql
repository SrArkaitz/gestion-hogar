-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Household" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "hiddenModules" TEXT NOT NULL DEFAULT '',
    "menuInCalendar" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Household" ("createdAt", "hiddenModules", "id", "name") SELECT "createdAt", "hiddenModules", "id", "name" FROM "Household";
DROP TABLE "Household";
ALTER TABLE "new_Household" RENAME TO "Household";
CREATE TABLE "new_MenuEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "meal" TEXT NOT NULL,
    "recipeId" TEXT,
    "title" TEXT,
    "servings" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MenuEntry_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MenuEntry_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MenuEntry" ("createdAt", "date", "householdId", "id", "meal", "recipeId", "servings") SELECT "createdAt", "date", "householdId", "id", "meal", "recipeId", "servings" FROM "MenuEntry";
DROP TABLE "MenuEntry";
ALTER TABLE "new_MenuEntry" RENAME TO "MenuEntry";
CREATE INDEX "MenuEntry_householdId_date_idx" ON "MenuEntry"("householdId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

