insert into countries (country, region)
values ('France','EMEA'),('United Kingdom','EMEA'),('Germany','EMEA')
on conflict (country) do nothing;

insert into products (sku_code, handlebar, speed, rack, bike_type, colour, light, seatpost_length, saddle, description)
values ('24_R','Medium','4 speed','R-Version','C Line','Black','Battery','Standard','Standard','Starter bike')
on conflict (sku_code) do nothing;

insert into setup_options (option_name, choice_value, sort_order)
values
('Handlebar','Medium',1),('Handlebar','High',2),('Handlebar','Low',3),
('Speed','2 speed',1),('Speed','4 speed',2),
('Rack','None',1),('Rack','R-Version',2),
('Bike type','C Line',1),('Bike type','P Line',2)
on conflict do nothing;

insert into sku_rules (digit_position, option_name, code_value, choice_value, description_element)
values
(1,'Handlebar','2','Medium','Handlebar'),
(2,'Speed','4','4 speed','Speed'),
(3,'Rack','R','R-Version','Rack')
on conflict do nothing;

insert into availability (product_id, country_id, available)
select p.id, c.id, true
from products p cross join countries c
where p.sku_code = '24_R'
on conflict (product_id, country_id) do update set available = excluded.available;
