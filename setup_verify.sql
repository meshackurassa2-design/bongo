-- Create verification requests table
CREATE TABLE IF NOT EXISTS public.verification_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) NOT NULL UNIQUE,
    social_links TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can insert their own verification request"
ON public.verification_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own verification request"
ON public.verification_requests FOR SELECT
USING (auth.uid() = user_id);

-- Optional: Create index
CREATE INDEX IF NOT EXISTS idx_verification_requests_user_id ON public.verification_requests(user_id);
