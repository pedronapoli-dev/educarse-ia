-- Migration 004: Suporte a múltiplos tiers de plano + tracking de API calls
-- Run in Supabase SQL Editor

-- 1. Atualizar constraint de plan na tabela users
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_plan_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_plan_check
  CHECK (plan IN ('free', 'basic', 'pro', 'max', 'beta'));

-- 2. Adicionar colunas de tracking de API calls
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS api_calls_this_month integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS api_calls_reset_at   timestamptz;

-- 3. Inicializar api_calls_reset_at para usuários existentes
UPDATE public.users
  SET api_calls_reset_at = date_trunc('month', now()) + interval '1 month'
  WHERE api_calls_reset_at IS NULL;
