-- Add partner_id to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.profiles(id);

-- Create pairing_requests table
CREATE TABLE IF NOT EXISTS public.pairing_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.pairing_requests ENABLE ROW LEVEL SECURITY;

-- Policies for pairing_requests
CREATE POLICY "Users can view their own pairing requests"
    ON public.pairing_requests FOR SELECT
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can insert their own pairing requests"
    ON public.pairing_requests FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their received pairing requests"
    ON public.pairing_requests FOR UPDATE
    USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

-- Create RPC to search users by username
CREATE OR REPLACE FUNCTION search_users_by_username(p_username TEXT)
RETURNS TABLE (
    id UUID,
    username TEXT,
    display_name TEXT,
    avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.username, p.display_name, p.avatar_url
    FROM public.profiles p
    WHERE p.username ILIKE p_username || '%';
END;
$$;

-- Create RPC to accept a pairing request (handles the mutual connection securely)
CREATE OR REPLACE FUNCTION accept_pairing_request(p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sender_id UUID;
    v_receiver_id UUID;
    v_status TEXT;
BEGIN
    -- Get the request details
    SELECT sender_id, receiver_id, status 
    INTO v_sender_id, v_receiver_id, v_status
    FROM public.pairing_requests 
    WHERE id = p_request_id;

    -- Verify it exists, is pending, and the current user is the receiver
    IF v_status != 'pending' OR auth.uid() != v_receiver_id THEN
        RETURN FALSE;
    END IF;

    -- Update the request status
    UPDATE public.pairing_requests SET status = 'accepted', updated_at = NOW() WHERE id = p_request_id;

    -- Reject all other pending requests for both users
    UPDATE public.pairing_requests 
    SET status = 'rejected', updated_at = NOW()
    WHERE (sender_id = v_sender_id OR sender_id = v_receiver_id OR receiver_id = v_sender_id OR receiver_id = v_receiver_id)
      AND id != p_request_id
      AND status = 'pending';

    -- Pair them up in the profiles table!
    UPDATE public.profiles SET partner_id = v_receiver_id WHERE id = v_sender_id;
    UPDATE public.profiles SET partner_id = v_sender_id WHERE id = v_receiver_id;

    RETURN TRUE;
END;
$$;

-- Create RPC to unpair (break up)
CREATE OR REPLACE FUNCTION unpair_account()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_partner_id UUID;
BEGIN
    -- Find current partner
    SELECT partner_id INTO v_partner_id
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_partner_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Unlink both
    UPDATE public.profiles SET partner_id = NULL WHERE id = auth.uid();
    UPDATE public.profiles SET partner_id = NULL WHERE id = v_partner_id;

    RETURN TRUE;
END;
$$;
