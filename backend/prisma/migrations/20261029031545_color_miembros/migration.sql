-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HouseholdMember" (
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'miembro',
    "color" TEXT NOT NULL DEFAULT 'teja',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("householdId", "userId"),
    CONSTRAINT "HouseholdMember_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HouseholdMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
-- Cada miembro que ya existía recibe un color distinto dentro de su casa, por orden de llegada.
INSERT INTO "new_HouseholdMember" ("householdId", "joinedAt", "role", "userId", "color")
SELECT "householdId", "joinedAt", "role", "userId",
  CASE (ROW_NUMBER() OVER (PARTITION BY "householdId" ORDER BY "joinedAt") - 1) % 8
    WHEN 0 THEN 'teja' WHEN 1 THEN 'mostaza' WHEN 2 THEN 'oliva' WHEN 3 THEN 'pino'
    WHEN 4 THEN 'azul' WHEN 5 THEN 'ciruela' WHEN 6 THEN 'rosa' ELSE 'pizarra'
  END
FROM "HouseholdMember";
DROP TABLE "HouseholdMember";
ALTER TABLE "new_HouseholdMember" RENAME TO "HouseholdMember";
CREATE INDEX "HouseholdMember_userId_idx" ON "HouseholdMember"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
