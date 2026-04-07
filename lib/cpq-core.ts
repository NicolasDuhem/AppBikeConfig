export {
  CPQ_OPTION_DEFINITIONS,
  CPQ_OPTION_NAMES,
  CPQ_COLUMNS,
  normalizeOptionName,
  mapOptionNameToCanonical,
  optionScopeKey
} from './cpq-normalization';

export {
  buildCpqCombinations,
  buildCpqCombinationsDetailed,
  normalizeCharacter17,
  isValidCharacter17
} from './cpq-generation';

export type { CpqMetadata, GenerationDiagnostics } from './cpq-generation';
