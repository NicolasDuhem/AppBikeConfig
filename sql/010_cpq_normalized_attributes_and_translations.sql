-- Phase 1: normalized CPQ references
-- Keep cpq_products text columns temporarily for backward compatibility.

alter table if exists cpq_import_rows
  alter column import_run_id drop not null;

create table if not exists cpq_product_attributes (
  id bigserial primary key,
  cpq_product_id bigint not null references cpq_products(id) on delete cascade,
  option_name text not null,
  cpq_import_row_id bigint not null references cpq_import_rows(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cpq_product_attributes_product_option_uniq
  on cpq_product_attributes (cpq_product_id, option_name);

create index if not exists cpq_product_attributes_import_row_idx
  on cpq_product_attributes (cpq_import_row_id);

create table if not exists cpq_import_row_translations (
  id bigserial primary key,
  cpq_import_row_id bigint not null references cpq_import_rows(id) on delete cascade,
  locale text not null,
  translated_value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by bigint references app_users(id),
  updated_by bigint references app_users(id)
);

create unique index if not exists cpq_import_row_translations_row_locale_uniq
  on cpq_import_row_translations (cpq_import_row_id, locale);

-- Deduplicate canonical imported rows before adding uniqueness guard.
with ranked as (
  select
    id,
    row_number() over (
      partition by lower(coalesce(option_name, '')), lower(coalesce(choice_value, ''))
      order by id
    ) as rn
  from cpq_import_rows
  where status = 'imported'
    and coalesce(option_name, '') <> ''
    and coalesce(choice_value, '') <> ''
)
delete from cpq_import_rows r
using ranked d
where r.id = d.id
  and d.rn > 1;

create unique index if not exists cpq_import_rows_option_choice_uniq
  on cpq_import_rows (lower(option_name), lower(choice_value))
  where status = 'imported'
    and option_name is not null
    and choice_value is not null;

with mapped as (
  select
    p.id as cpq_product_id,
    p.import_run_id,
    m.option_name,
    trim(m.choice_value) as choice_value
  from cpq_products p
  cross join lateral (
    values
      ('CPQRuleset', p.cpq_ruleset),
      ('ProductAssist', p.product_assist),
      ('ProductFamily', p.product_family),
      ('ProductLine', p.product_line),
      ('ProductModel', p.product_model),
      ('ProductType', p.product_type),
      ('BrakeReverse', p.brake_reverse),
      ('BrakeNonReverse', p.brake_non_reverse),
      ('Description', p.description),
      ('HandlebarType', p.handlebar_type),
      ('Speeds', p.speeds),
      ('MudguardsAndRack', p.mudguardsandrack),
      ('Territory', p.territory),
      ('MainFrameColour', p.mainframecolour),
      ('RearFrameColour', p.rearframecolour),
      ('FrontCarrierBlock', p.frontcarrierblock),
      ('Lighting', p.lighting),
      ('SaddleHeight', p.saddleheight),
      ('GearRatio', p.gearratio),
      ('Saddle', p.saddle),
      ('Tyre', p.tyre),
      ('Brakes', p.brakes),
      ('Pedals', p.pedals),
      ('Saddlebag', p.saddlebag),
      ('Suspension', p.suspension),
      ('BikeType', p.biketype),
      ('Toolkit', p.toolkit),
      ('SaddleLight', p.saddlelight),
      ('ConfigCode', p.configcode),
      ('OptionBox', p.optionbox),
      ('FrameMaterial', p.framematerial),
      ('FrameSet', p.frameset),
      ('ComponentColour', p.componentcolour),
      ('OnBikeAccessories', p.onbikeaccessories),
      ('HandlebarStemColour', p.handlebarstemcolour),
      ('HandlebarPinColour', p.handlebarpincolour),
      ('FrontFrameColour', p.frontframecolour),
      ('FrontForkColour', p.frontforkcolour)
  ) as m(option_name, choice_value)
  where coalesce(trim(m.choice_value), '') <> ''
),
missing_import_rows as (
  insert into cpq_import_rows (
    import_run_id,
    row_number,
    option_name,
    choice_value,
    digit_position,
    code_value,
    status,
    normalized_option_name,
    action_attempted
  )
  select
    null,
    0,
    x.option_name,
    x.choice_value,
    null,
    null,
    'imported',
    x.option_name,
    'backfill_product_attribute'
  from (
    select distinct option_name, choice_value
    from mapped
  ) x
  on conflict do nothing
  returning id
),
mapped_with_row as (
  select
    mapped.cpq_product_id,
    mapped.option_name,
    ir.id as cpq_import_row_id
  from mapped
  join cpq_import_rows ir
    on lower(ir.option_name) = lower(mapped.option_name)
   and lower(ir.choice_value) = lower(mapped.choice_value)
   and ir.status = 'imported'
)
insert into cpq_product_attributes (cpq_product_id, option_name, cpq_import_row_id)
select cpq_product_id, option_name, cpq_import_row_id
from mapped_with_row
on conflict (cpq_product_id, option_name)
do update set cpq_import_row_id = excluded.cpq_import_row_id, updated_at = now();

create or replace view cpq_products_flat as
select
  p.id,
  p.sku_code,
  p.cpq_ruleset,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('ProductAssist')), p.product_assist) as product_assist,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('ProductFamily')), p.product_family) as product_family,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('ProductLine')), p.product_line) as product_line,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('ProductModel')), p.product_model) as product_model,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('ProductType')), p.product_type) as product_type,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('HandlebarType')), p.handlebar_type) as handlebar_type,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('Speeds')), p.speeds) as speeds,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('MudguardsAndRack')), p.mudguardsandrack) as mudguards_and_rack,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('Territory')), p.territory) as territory,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('MainFrameColour')), p.mainframecolour) as main_frame_colour,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('RearFrameColour')), p.rearframecolour) as rear_frame_colour,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('FrontCarrierBlock')), p.frontcarrierblock) as front_carrier_block,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('Lighting')), p.lighting) as lighting,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('SaddleHeight')), p.saddleheight) as saddle_height,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('GearRatio')), p.gearratio) as gear_ratio,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('Saddle')), p.saddle) as saddle,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('Tyre')), p.tyre) as tyre,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('Brakes')), p.brakes) as brakes,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('Pedals')), p.pedals) as pedals,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('Saddlebag')), p.saddlebag) as saddlebag,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('Suspension')), p.suspension) as suspension,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('BikeType')), p.biketype) as bike_type,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('Toolkit')), p.toolkit) as toolkit,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('SaddleLight')), p.saddlelight) as saddle_light,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('ConfigCode')), p.configcode) as config_code,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('OptionBox')), p.optionbox) as option_box,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('FrameMaterial')), p.framematerial) as frame_material,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('FrameSet')), p.frameset) as frame_set,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('ComponentColour')), p.componentcolour) as component_colour,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('OnBikeAccessories')), p.onbikeaccessories) as on_bike_accessories,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('HandlebarStemColour')), p.handlebarstemcolour) as handlebar_stem_colour,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('HandlebarPinColour')), p.handlebarpincolour) as handlebar_pin_colour,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('FrontFrameColour')), p.frontframecolour) as front_frame_colour,
  coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('FrontForkColour')), p.frontforkcolour) as front_fork_colour
from cpq_products p
left join cpq_product_attributes pa on pa.cpq_product_id = p.id
left join cpq_import_rows ir on ir.id = pa.cpq_import_row_id
group by p.id;
