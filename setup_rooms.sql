-- Create rooms table
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artist_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'live', 'finished')),
    listener_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on rooms
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view rooms" 
    ON public.rooms FOR SELECT 
    USING (true);

CREATE POLICY "Artists can insert rooms" 
    ON public.rooms FOR INSERT 
    WITH CHECK (auth.uid() = artist_id);

CREATE POLICY "Artists can update their rooms" 
    ON public.rooms FOR UPDATE 
    USING (auth.uid() = artist_id);


-- Create room_messages table
CREATE TABLE IF NOT EXISTS public.room_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on room_messages
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view room messages" 
    ON public.room_messages FOR SELECT 
    USING (true);

CREATE POLICY "Logged in users can insert room messages" 
    ON public.room_messages FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

-- Create a function to delete old finished rooms to save space (Optional)
CREATE OR REPLACE FUNCTION cleanup_old_rooms()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.rooms WHERE status = 'finished' AND created_at < NOW() - INTERVAL '24 hours';
END;
$$;
