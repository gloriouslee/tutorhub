-- Migration: Add missing columns to submissions table
-- Run this AFTER schema.sql in Supabase SQL Editor

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS file_name       TEXT,
  ADD COLUMN IF NOT EXISTS file_size       BIGINT,
  ADD COLUMN IF NOT EXISTS student_name    TEXT,
  ADD COLUMN IF NOT EXISTS teacher_file_url  TEXT,
  ADD COLUMN IF NOT EXISTS teacher_file_name TEXT;

-- Add grade column to classes (used in mock data)
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS grade INTEGER;
