-- Create track_likes table
CREATE TABLE IF NOT EXISTS public.track_likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  track_id uuid REFERENCES public.tracks(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, track_id)
);

-- Enable RLS
ALTER TABLE public.track_likes ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Users can view their own likes" ON public.track_likes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own likes" ON public.track_likes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes" ON public.track_likes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Create RPC to safely toggle like and update like_count
CREATE OR REPLACE FUNCTION toggle_track_like(p_track_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_exists boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if like already exists
  SELECT EXISTS (
    SELECT 1 FROM track_likes 
    WHERE user_id = v_user_id AND track_id = p_track_id
  ) INTO v_exists;

  IF v_exists THEN
    -- Remove like
    DELETE FROM track_likes WHERE user_id = v_user_id AND track_id = p_track_id;
    -- Decrement count
    UPDATE tracks SET like_count = GREATEST(0, like_count - 1) WHERE id = p_track_id;
    RETURN false; -- currently not liked
  ELSE
    -- Add like
    INSERT INTO track_likes (user_id, track_id) VALUES (v_user_id, p_track_id);
    -- Increment count
    UPDATE tracks SET like_count = like_count + 1 WHERE id = p_track_id;
    RETURN true; -- currently liked
  END IF;
END;
$$;
