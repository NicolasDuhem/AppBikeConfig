-- Wave cleanup: remove cpq_products_flat fallback dependency for product identity fields,
-- then drop matched cpq_products compatibility columns.
-- Evidence:
-- 1) cpq_products_flat consumers read these values from the view projection, not raw cpq_products columns,
-- 2) push/import paths persist ProductAssist/ProductFamily/ProductLine/ProductModel/ProductType via cpq_product_attributes,
-- 3) runtime has no direct read/write dependency on cpq_products.product_assist/product_family/product_line/product_model/product_type.

create or replace view cpq_products_flat as
select
  p.id,
  p.sku_code,
  p.cpq_ruleset,
  max(ir.choice_value) filter (where lower(pa.option_name) = lower('ProductAssist')) as product_assist,
  max(ir.choice_value) filter (where lower(pa.option_name) = lower('ProductFamily')) as product_family,
  max(ir.choice_value) filter (where lower(pa.option_name) = lower('ProductLine')) as product_line,
  max(ir.choice_value) filter (where lower(pa.option_name) = lower('ProductModel')) as product_model,
  max(ir.choice_value) filter (where lower(pa.option_name) = lower('ProductType')) as product_type,
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

alter table if exists cpq_products
  drop column if exists product_assist,
  drop column if exists product_family,
  drop column if exists product_line,
  drop column if exists product_model,
  drop column if exists product_type;

-- Rollback (additive, reversible):
-- alter table if exists cpq_products
--   add column if not exists product_assist text,
--   add column if not exists product_family text,
--   add column if not exists product_line text,
--   add column if not exists product_model text,
--   add column if not exists product_type text;
--
-- create or replace view cpq_products_flat as
-- select
--   p.id,
--   p.sku_code,
--   p.cpq_ruleset,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('ProductAssist')), p.product_assist) as product_assist,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('ProductFamily')), p.product_family) as product_family,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('ProductLine')), p.product_line) as product_line,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('ProductModel')), p.product_model) as product_model,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('ProductType')), p.product_type) as product_type,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('HandlebarType')), p.handlebar_type) as handlebar_type,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('Speeds')), p.speeds) as speeds,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('MudguardsAndRack')), p.mudguardsandrack) as mudguards_and_rack,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('Territory')), p.territory) as territory,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('MainFrameColour')), p.mainframecolour) as main_frame_colour,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('RearFrameColour')), p.rearframecolour) as rear_frame_colour,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('FrontCarrierBlock')), p.frontcarrierblock) as front_carrier_block,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('Lighting')), p.lighting) as lighting,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('SaddleHeight')), p.saddleheight) as saddle_height,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('GearRatio')), p.gearratio) as gear_ratio,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('Saddle')), p.saddle) as saddle,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('Tyre')), p.tyre) as tyre,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('Brakes')), p.brakes) as brakes,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('Pedals')), p.pedals) as pedals,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('Saddlebag')), p.saddlebag) as saddlebag,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('Suspension')), p.suspension) as suspension,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('BikeType')), p.biketype) as bike_type,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('Toolkit')), p.toolkit) as toolkit,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('SaddleLight')), p.saddlelight) as saddle_light,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('ConfigCode')), p.configcode) as config_code,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('OptionBox')), p.optionbox) as option_box,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('FrameMaterial')), p.framematerial) as frame_material,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('FrameSet')), p.frameset) as frame_set,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('ComponentColour')), p.componentcolour) as component_colour,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('OnBikeAccessories')), p.onbikeaccessories) as on_bike_accessories,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('HandlebarStemColour')), p.handlebarstemcolour) as handlebar_stem_colour,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('HandlebarPinColour')), p.handlebarpincolour) as handlebar_pin_colour,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('FrontFrameColour')), p.frontframecolour) as front_frame_colour,
--   coalesce(max(ir.choice_value) filter (where lower(pa.option_name) = lower('FrontForkColour')), p.frontforkcolour) as front_fork_colour
-- from cpq_products p
-- left join cpq_product_attributes pa on pa.cpq_product_id = p.id
-- left join cpq_import_rows ir on ir.id = pa.cpq_import_row_id
-- group by p.id;
