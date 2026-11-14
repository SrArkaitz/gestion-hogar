-- El color lima ya no se puede elegir: quien lo tenía pasa a verde.
UPDATE "HouseholdMember" SET "color" = 'verde' WHERE "color" = 'lima';
