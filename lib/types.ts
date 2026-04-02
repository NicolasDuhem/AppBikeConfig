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
  availability: Record<string, boolean>;
};
export type SetupOption = { id: number; option_name: string; choice_value: string; sort_order: number };
export type SkuRule = { id: number; digit_position: number; option_name: string; code_value: string; choice_value: string; description_element: string | null };
