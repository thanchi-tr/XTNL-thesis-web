export interface SopRow {
  id:         number;
  title:      string;
  tags:       string[];
  items:      string[];
  status:     "active" | "archived";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
