-- Add lyrics column to tracks table
ALTER TABLE public.tracks
ADD COLUMN IF NOT EXISTS lyrics text;
