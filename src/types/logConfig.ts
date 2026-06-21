export interface LogEntryFieldOption {
  id: string;
  field_id: string;
  label: string;
  sort_order: number;
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
}

export interface LogEntryType {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  is_timed: boolean;
  fields: LogEntryField[];
}
