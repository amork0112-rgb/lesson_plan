export type Role = 'admin' | 'teacher';
export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type UnitType = 'unit' | 'day' | 'lesson';
export type SpecialDateType = 'no_class' | 'makeup' | 'school_event';

export interface SpecialDate {
  type: SpecialDateType;
  name: string;
}

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
  sessions_per_month: number;
  start_time: string;
  end_time: string;
  dismissal_time?: string; // 하원 시간
  days: Weekday[];
  scp_type?: 'red' | 'orange' | 'yellow' | 'blue' | 'green' | null;
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

export interface LessonUnit {
  id: string;
  book_id: string;
  sequence: number; // 전체 진행 순서 (1,2,3,...)
  unit_no?: number; // 1~12 (nullable)
  day_no?: number; // 1~3 (nullable)
  type: 'lesson' | 'review';
  title: string;
  has_video?: boolean;
}

export interface Book {
  id: string;
  name: string;
  category?: string;
  level?: string;
  series?: string;
  progression_type?: 'volume-day' | 'unit-day' | 'lesson';
  volume_count?: number;
  days_per_volume?: number;
  series_level?: string;
  total_units: number;
  unit_type: UnitType;
  days_per_unit?: number; // Added: How many days per unit
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
  month?: number; // Added for global context
  year?: number; // Added for global context
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
  period?: number;
  unit_text?: string; 
  book_name?: string;
  content?: string;
  unit_no?: number;
  day_no?: number;
}

export interface LessonRow {
  date: string;
  weekday_kr: string;
  book_name: string;
  content: string;
  is_scp?: boolean;
}

export interface Course {
  id: string;
  level: string;
  duration: string;
  mainTB?: string;
  subTB1?: string;
  subTB2?: string;
  secondTB?: string | string[];
  rw?: string;
  speaking?: string;
  voca?: string;
  vocab?: string;
  grammar?: string;
  writing?: string;
  video?: string;
  test?: string;
  certify?: string;
  [key: string]: any;
}
