-- Add the is_ai column to tracks table to distinguish AI-generated songs from regular uploads
ALTER TABLE public.tracks 
ADD COLUMN IF NOT EXISTS is_ai BOOLEAN DEFAULT FALSE;

-- Update any existing track that looks like AI (optional - leave this commented if unsure)
-- UPDATE public.tracks SET is_ai = TRUE WHERE audio_url LIKE '%ai_tracks%';
