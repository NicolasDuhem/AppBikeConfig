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
  last_edited_by_email?: string | null;
  last_edited_at?: string | null;
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
  product_assist?: string;
  product_family?: string;
  product_line?: string;
  product_model?: string;
  product_type?: string;
  handlebar_type?: string;
  speeds?: string;
  mudguards_and_rack?: string;
  territory?: string;
  main_frame_colour?: string;
  rear_frame_colour?: string;
  front_carrier_block?: string;
  lighting?: string;
  saddle_height?: string;
  gear_ratio?: string;
  tyre?: string;
  brakes?: string;
  pedals?: string;
  saddlebag?: string;
  suspension?: string;
  toolkit?: string;
  saddle_light?: string;
  config_code?: string;
  option_box?: string;
  frame_material?: string;
  frame_set?: string;
  component_colour?: string;
  on_bike_accessories?: string;
  handlebar_stem_colour?: string;
  handlebar_pin_colour?: string;
  front_frame_colour?: string;
  front_fork_colour?: string;
  picture_asset_url?: string | null;
  picture_png_url?: string | null;
  picture_asset_id?: string | null;
  picture_notes?: string | null;
  picture_selected_at?: string | null;
};
