-- Create event_tickets table
CREATE TABLE IF NOT EXISTS public.event_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    ticket_code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.event_tickets ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own tickets
CREATE POLICY "Users can view own tickets" 
    ON public.event_tickets FOR SELECT 
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own tickets
CREATE POLICY "Users can create own tickets" 
    ON public.event_tickets FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can view all tickets
CREATE POLICY "Admins can view all tickets" 
    ON public.event_tickets FOR SELECT 
    USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));

-- Policy: Admins can update any ticket
CREATE POLICY "Admins can update tickets" 
    ON public.event_tickets FOR UPDATE 
    USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));

-- Policy: Admins can delete tickets
CREATE POLICY "Admins can delete tickets" 
    ON public.event_tickets FOR DELETE 
    USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ));
