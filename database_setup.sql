-- This script creates the two tables we need for our database.

-- ----------------------------
-- Table 1: items
-- Stores the list of all loaner items and their CURRENT status.
-- ----------------------------
CREATE TABLE IF NOT EXISTS "items" (
  "id" TEXT NOT NULL PRIMARY KEY, -- e.g., "laptop1", "laptop2"
  "name" TEXT NOT NULL,             -- e.g., "Loaner Laptop 1"
  "status" TEXT NOT NULL,           -- "Available" or "Checked Out"
  "checkedOutBy" TEXT,              -- The ID of the user, e.g., "987654321"
  "checkedOutByName" TEXT           -- The display name, e.g., "Jane Doe"
);

-- ----------------------------
-- Table 2: checkout_log
-- Stores a permanent history of all transactions for the admin.
-- ----------------------------
CREATE TABLE IF NOT EXISTS "checkout_log" (
  "log_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, -- A unique ID for each log entry
  "timestamp" DATETIME NOT NULL,                         -- The exact time of the action
  "item_id" TEXT NOT NULL,                             -- The ID of the item
  "item_name" TEXT NOT NULL,                           -- The name of the item
  "action" TEXT NOT NULL,                              -- "Checked Out" or "Returned"
  "user_id" TEXT NOT NULL,                             -- The user's ID
  "user_name" TEXT NOT NULL                            -- The user's display name
);

-- ----------------------------
-- (Optional) Add our initial items
-- This pre-populates the 'items' table with your devices.
-- You can change these to match your real items.
-- ----------------------------
INSERT INTO "items" (id, name, status, checkedOutBy, checkedOutByName) 
VALUES 
  ('laptop1', 'Loaner Laptop 1', 'Available', NULL, NULL),
  ('laptop2', 'Loaner Laptop 2', 'Available', NULL, NULL),
  ('projector1', 'Portable Projector', 'Available', NULL, NULL)
ON CONFLICT(id) DO NOTHING; -- This prevents errors if you run the script twice
