-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus text,
  class_name text,
  grade text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lesson_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  class_id uuid REFERENCES classes(id),
  content text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY public_read_classes ON classes FOR SELECT USING (true);

CREATE POLICY public_read ON lesson_plans FOR SELECT USING (true);
CREATE POLICY public_insert ON lesson_plans FOR INSERT WITH CHECK (true);
CREATE POLICY public_update ON lesson_plans FOR UPDATE USING (true);
