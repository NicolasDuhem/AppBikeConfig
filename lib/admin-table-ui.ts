export function toggleColumnVisibility(current: string[], allColumns: string[], column: string, nextVisible: boolean) {
  if (nextVisible) {
    return allColumns.filter((item) => item === column || current.includes(item));
  }
  return current.filter((item) => item !== column);
}

export function rowMatchesMultiSelectFilters(row: Record<string, string>, filters: Record<string, string[]>) {
  return Object.entries(filters).every(([key, values]) => !values?.length || values.includes(String(row[key] || '')));
}
