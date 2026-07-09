-- Create events table
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    location TEXT NOT NULL,
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    image_url TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Anyone can view events
CREATE POLICY "Anyone can view events" 
    ON public.events FOR SELECT 
    USING (true);

-- Only admins can insert events
CREATE POLICY "Admins can insert events" 
    ON public.events FOR INSERT 
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));

-- Only admins can update events
CREATE POLICY "Admins can update events" 
    ON public.events FOR UPDATE 
    USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));

-- Only admins can delete events
CREATE POLICY "Admins can delete events" 
    ON public.events FOR DELETE 
    USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));


