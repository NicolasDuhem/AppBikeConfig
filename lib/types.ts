export type Country = { id: number; country: string; region: string };
export type MatrixRow = {
  id: number;
  sku_code: string;
  handlebar: string;
  speed: string;
  rack: string;
  bike_type: string;
  colour: string;
  light: string;
  seatpost_length: string;
  saddle: string;
  description: string;
  bc_status: 'ok' | 'nok' | '';
  availability: Record<string, boolean>;
};

export type MatrixProductColumn =
  | 'sku_code'
  | 'handlebar'
  | 'speed'
  | 'rack'
  | 'bike_type'
  | 'colour'
  | 'light'
  | 'seatpost_length'
  | 'saddle'
  | 'description'
  | 'bc_status';

export type SetupOption = { id: number; option_name: string; choice_value: string; sort_order: number };
export type SkuRule = {
  id: number;
  digit_position: number;
  option_name: string;
  code_value: string;
  choice_value: string;
  description_element: string | null;
  is_active: boolean;
  deactivated_at: string | null;
  deactivation_reason: string | null;
};

export type SkuDigitIssue = {
  digit_position: number;
  option_names: string[];
};


export type BrakeType = 'reverse' | 'non_reverse';
export type CpqCountry = { id: number; country: string; region: string; brake_type: BrakeType };
export type CpqMatrixRow = MatrixRow & {
  cpq_rule_id: number;
  cpq_ruleset: string;
  brake_type: BrakeType;
};
