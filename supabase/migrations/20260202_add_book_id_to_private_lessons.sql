-- Add book_id to private_lessons if it was missed in the initial creation
alter table private_lessons 
add column if not exists book_id uuid;
