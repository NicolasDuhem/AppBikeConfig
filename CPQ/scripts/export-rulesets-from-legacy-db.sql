-- Export rows from legacy Trade SQL for building CPQ_RULESETS_JSON in tp2-bike-builder-poc.
--
-- What the beta DB has:
--   frt.CpqBikeType.Rulset, Namespace, HeaderID, Name, BikeTypeCategory, AlternativeRuleset, ...
-- What it does NOT store:
--   CPQ Design Studio variantKey strings — those live in Infor CPQ only (see docs/cpq-variant-enumeration-notes.md).
--
-- Run against your beta / TRN database (scripts in repo often use BromptonBeta). Adjust database name if needed.

-- USE BromptonBeta;
-- GO

SELECT
  bt.ID,
  bt.Name,
  bt.Rulset AS ruleset,
  bt.Namespace AS namespace,
  bt.HeaderID AS headerId,
  bt.BikeTypeCategory,
  bt.AlternativeRuleset,
  mt.Name AS modelTypeName,
  bt.OrderNo
FROM frt.CpqBikeType AS bt
LEFT JOIN frt.ModelType AS mt ON mt.ID = bt.BikeTypeID
WHERE bt.IsDeleted = 0
  AND bt.IsActive = 1
ORDER BY ISNULL(bt.OrderNo, 999999), bt.Name;

-- After export: build JSON objects for CPQ_RULESETS_JSON, e.g.
--   { "id": "cpq-<ID>", "ruleset": "<Rulset>", "namespace": "<Namespace>", "headerId": "<HeaderID>",
--     "line": "c"|"p"|"g"|"t"|"special", "isElectric": true|false, "displayTitle": "<Name>" }
--
-- BikeTypeCategory → POC `line` (as used in one beta snapshot; confirm against frt.BikeTypeCategory if needed):
--   1 → c        2 → special (e.g. A line)   3 → t   4 → p   5 → g
-- `isElectric`: true if Name contains "Electric" (word) or Rulset matches Elec/Electric (e.g. G-LineElec*, *Electric*).
--
-- See server/src/lib/cpq/catalogue.ts for category filtering (all-bikes / electric-c-line / special-editions / …).
