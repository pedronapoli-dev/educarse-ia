-- Migration 003: Add application_context to plans table
-- Run in Supabase SQL Editor

alter table public.plans
  add column if not exists application_context text;

comment on column public.plans.application_context
  is 'Student''s real-life goal for studying this subject (Freire/Darcy). Populated from student_profile at plan creation.';
