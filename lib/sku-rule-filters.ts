import type { SkuRule } from '@/lib/types';

export type RuleFilters = {
  search: string;
  digit: string;
  option: string;
  code: string;
  choice: string;
  status: 'all' | 'active' | 'inactive';
  reason: string;
};

export const defaultRuleFilters: RuleFilters = {
  search: '',
  digit: '',
  option: '',
  code: '',
  choice: '',
  status: 'all',
  reason: ''
};

export function filterSkuRules(rules: SkuRule[], filters: RuleFilters) {
  const query = filters.search.trim().toLowerCase();

  return rules.filter((rule) => {
    const statusMatch = filters.status === 'all' || (filters.status === 'active' ? rule.is_active : !rule.is_active);
    if (!statusMatch) return false;

    const globalSearch =
      !query ||
      [
        rule.digit_position,
        rule.option_name,
        rule.code_value,
        rule.choice_value,
        rule.deactivation_reason,
        rule.description_element
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);

    const digitMatch = !filters.digit || String(rule.digit_position).includes(filters.digit.trim());
    const optionMatch = !filters.option || rule.option_name.toLowerCase().includes(filters.option.trim().toLowerCase());
    const codeMatch = !filters.code || rule.code_value.toLowerCase().includes(filters.code.trim().toLowerCase());
    const choiceMatch = !filters.choice || rule.choice_value.toLowerCase().includes(filters.choice.trim().toLowerCase());
    const reasonMatch = !filters.reason || (rule.deactivation_reason || '').toLowerCase().includes(filters.reason.trim().toLowerCase());

    return globalSearch && digitMatch && optionMatch && codeMatch && choiceMatch && reasonMatch;
  });
}

export function getRuleActionLabel(rule: SkuRule) {
  return rule.is_active ? 'Deactivate' : 'Reactivate';
}
