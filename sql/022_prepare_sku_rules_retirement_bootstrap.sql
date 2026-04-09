-- Prepare sku_rules retirement by moving setup/bootstrap derivation to cpq_import_rows.
-- This keeps sku_digit_option_config in sync without reading legacy sku_rules.

insert into sku_digit_option_config (digit_position, option_name, is_required, selection_mode, is_active)
select distinct
  r.digit_position,
  r.option_name,
  false,
  'multi',
  true
from cpq_import_rows r
where r.status = 'imported'
  and coalesce(r.is_active, true) = true
  and r.digit_position between 1 and 30
on conflict (digit_position) do update
set option_name = excluded.option_name,
    updated_at = now();

-- Rollback posture:
-- No destructive data change; revert by restoring prior bootstrap derivation logic.
