-- SQLite stores LibraryKind as TEXT; new values (game/movie/drama) need no DDL.
-- Keep this migration for Prisma history when enum members are added.
SELECT 1;
