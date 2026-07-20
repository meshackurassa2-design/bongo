-- Create the listening_history table
CREATE TABLE IF NOT EXISTS public.listening_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    track_id uuid REFERENCES public.tracks(id) ON DELETE CASCADE,
    listened_at timestamp with time zone DEFAULT now(),
    duration_listened integer DEFAULT 0 -- seconds listened
);

-- Enable RLS
ALTER TABLE public.listening_history ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own history
CREATE POLICY "Users can insert their own listening history"
ON public.listening_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to view their own history
CREATE POLICY "Users can view their own listening history"
ON public.listening_history FOR SELECT
USING (auth.uid() = user_id);

-- Create index for faster stats queries
CREATE INDEX IF NOT EXISTS idx_listening_history_user_id ON public.listening_history(user_id);
CREATE INDEX IF NOT EXISTS idx_listening_history_track_id ON public.listening_history(track_id);
