export type Role = 'admin' | 'teacher';
export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type UnitType = 'unit' | 'day' | 'lesson';

export interface User {
  id: string;
  name: string;
  role: Role;
  email: string;
}

export interface Class {
  id: string;
  name: string;
  year: number;
  level_group: string;
  weekly_sessions: number;
  start_time: string;
  end_time: string;
  dismissal_time?: string; // 하원 시간
  days: Weekday[];
}

export interface ScheduleRule {
  id: string;
  class_id: string;
  weekday: Weekday;
}

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  type: 'national' | 'custom';
  year: number;
  affected_classes?: string[]; // If undefined/empty, applies to all
}

export interface Event {
  id: string;
  name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  affected_class?: string | null;
  type: string;
}

export interface LessonUnit {
  id: string;
  book_id: string;
  sequence: number; // 전체 진행 순서 (1,2,3,...)
  unit_no?: number; // 1~12 (nullable)
  day_no?: number; // 1~3 (nullable)
  type: 'lesson' | 'review';
  title: string;
}

export interface Book {
  id: string;
  name: string;
  category?: string;
  level?: string;
  total_units: number;
  unit_type: UnitType;
  review_units?: number;
  total_sessions?: number;
  units?: LessonUnit[]; // Pre-defined structure
}

export interface BookAllocation {
  id: string;
  class_id: string;
  book_id: string;
  sessions_per_week: number;
  priority: number;
  total_sessions_override?: number; // User override for this specific allocation context
  manual_used?: number; // User override for used sessions in this month
}

export interface LessonPlan {
  id: string;
  class_id: string;
  date: string; // YYYY-MM-DD
  book_id: string;
  unit_id?: string;
  display_order: number;
  is_makeup: boolean;
  // Computed fields for display
  unit_text?: string; 
  book_name?: string;
  content?: string;
  unit_range?: string;
}
