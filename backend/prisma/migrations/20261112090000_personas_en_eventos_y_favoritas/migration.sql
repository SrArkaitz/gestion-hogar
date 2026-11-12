-- CreateTable
CREATE TABLE "CalendarEventPerson" (
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    PRIMARY KEY ("eventId", "userId"),
    CONSTRAINT "CalendarEventPerson_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CalendarEventPerson_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecipeFavorite" (
    "householdId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("householdId", "recipeId"),
    CONSTRAINT "RecipeFavorite_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecipeFavorite_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecipeFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CalendarEventPerson_userId_idx" ON "CalendarEventPerson"("userId");

-- CreateIndex
CREATE INDEX "RecipeFavorite_recipeId_idx" ON "RecipeFavorite"("recipeId");

