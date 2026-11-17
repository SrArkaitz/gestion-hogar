-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN "nameKey" TEXT;
ALTER TABLE "Recipe" ADD COLUMN "source" TEXT;

-- CreateTable
CREATE TABLE "RecipeSave" (
    "householdId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "savedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("householdId", "recipeId"),
    CONSTRAINT "RecipeSave_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecipeSave_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecipeSave_savedById_fkey" FOREIGN KEY ("savedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RecipeSave_recipeId_idx" ON "RecipeSave"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_nameKey_key" ON "Recipe"("nameKey");


-- Cada casa tiene guardadas sus recetas y las favoritas que tuviera de otras casas.
INSERT INTO "RecipeSave" ("householdId", "recipeId", "savedById", "createdAt")
SELECT "householdId", "id", "createdById", "createdAt" FROM "Recipe";
INSERT OR IGNORE INTO "RecipeSave" ("householdId", "recipeId", "savedById", "createdAt")
SELECT "householdId", "recipeId", "userId", "createdAt" FROM "RecipeFavorite";
-- nameKey se rellena al arrancar (RecipesService), renombrando las repetidas.
