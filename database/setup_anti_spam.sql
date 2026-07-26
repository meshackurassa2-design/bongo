-- Create play_history table to track every single stream
CREATE TABLE IF NOT EXISTS public.play_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- Can be null for anonymous listeners
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Index for fast counting of daily streams
CREATE INDEX IF NOT EXISTS idx_play_history_track_user 
ON public.play_history(track_id, user_id, created_at);

-- Drop the old simple increment function
DROP FUNCTION IF EXISTS increment_play_count(uuid);
DROP FUNCTION IF EXISTS increment_play_count(uuid, uuid);

-- Create the new strict rate-limited function
CREATE OR REPLACE FUNCTION increment_play_count(track_id_input UUID, user_id_input UUID DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    recent_play_count INT;
    DAILY_LIMIT INT := 10; -- Maximum streams allowed per user per track per 24 hours
BEGIN
    -- Only enforce limit if it is a logged-in user
    IF user_id_input IS NOT NULL THEN
        -- Check how many times this user has streamed this track in the last 24 hours
        SELECT COUNT(*)
        INTO recent_play_count
        FROM public.play_history
        WHERE track_id = track_id_input 
          AND user_id = user_id_input
          AND created_at > (NOW() - INTERVAL '24 hours');

        -- If they hit the limit, silently reject the stream
        IF recent_play_count >= DAILY_LIMIT THEN
            RETURN;
        END IF;
    END IF;

    -- Log the valid stream
    INSERT INTO public.play_history (track_id, user_id)
    VALUES (track_id_input, user_id_input);

    -- Increment the public play counter
    UPDATE public.tracks
    SET play_count = COALESCE(play_count, 0) + 1
    WHERE id = track_id_input;
END;
$$;
