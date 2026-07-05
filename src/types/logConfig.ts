export interface LogEntryFieldOption {
  id: string;
  field_id: string;
  label: string;
  sort_order: number;
  rate_type?: "per_hour" | "per_unit" | null;
  rate_amount?: number | null;
}

export interface LogEntryField {
  id: string;
  type_id: string;
  label: string;
  field_key: string;
  field_type: "dropdown" | "number" | "text";
  sort_order: number;
  is_required: boolean;
  options: LogEntryFieldOption[];
  rate_type?: "per_hour" | "per_unit" | null;
  rate_amount?: number | null;
}

export interface LogEntryType {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  is_timed: boolean;
  time_mode: "job" | "day" | "none";
  fields: LogEntryField[];
  is_priced: boolean;
  rate_type?: "per_hour" | "per_unit" | null;
  rate_amount?: number | null;
}
