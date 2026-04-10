-- Manual validation query for sampler-source extraction logic used by picture-management sync.
select
  count(*)::int as sampler_rows,
  coalesce(sum(case when jsonb_typeof(json_result -> 'selectedOptions') = 'array' then jsonb_array_length(json_result -> 'selectedOptions') else 0 end), 0)::int as selected_options_entries
from CPQ_sampler_result;

select
  btrim(opt ->> 'featureLabel') as feature_label,
  btrim(opt ->> 'optionLabel') as option_label,
  btrim(opt ->> 'optionValue') as option_value,
  count(*)::int as occurrences
from CPQ_sampler_result src
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(src.json_result -> 'selectedOptions') = 'array' then src.json_result -> 'selectedOptions'
    else '[]'::jsonb
  end
) as opt
where btrim(opt ->> 'featureLabel') <> ''
  and btrim(opt ->> 'optionLabel') <> ''
  and btrim(opt ->> 'optionValue') <> ''
group by 1, 2, 3
order by 1, 2, 3;
