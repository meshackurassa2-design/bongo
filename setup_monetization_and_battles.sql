-- ============================================================
-- Feature: Artist Payouts, Earnings Wallet & Song Battles
-- Execute this entire file in your Supabase SQL Editor
-- ============================================================

-- 1. Add earnings and phone number to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS earnings_balance INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- 2. Create payout_requests table
CREATE TABLE IF NOT EXISTS public.payout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount INT NOT NULL,
    phone_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'rejected')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_payout_requests_user_id ON public.payout_requests(user_id);

-- Enable RLS
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

-- 3. Policies for payout_requests
DROP POLICY IF EXISTS "Users can view their own payout requests" ON public.payout_requests;
CREATE POLICY "Users can view their own payout requests" ON public.payout_requests
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create a payout request" ON public.payout_requests;
CREATE POLICY "Users can create a payout request" ON public.payout_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all payouts" ON public.payout_requests;
CREATE POLICY "Admins can view all payouts" ON public.payout_requests
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can update payouts" ON public.payout_requests;
CREATE POLICY "Admins can update payouts" ON public.payout_requests
    FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 4. Function to safely request a payout
CREATE OR REPLACE FUNCTION public.request_payout(p_amount INT, p_phone_number TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_current_earnings INT;
    v_payout_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    IF p_amount < 50000 THEN RAISE EXCEPTION 'Minimum payout is 50,000 TZS'; END IF;

    SELECT earnings_balance INTO v_current_earnings FROM public.profiles WHERE id = v_user_id FOR UPDATE;
    IF v_current_earnings < p_amount THEN RAISE EXCEPTION 'Insufficient earnings balance'; END IF;

    UPDATE public.profiles SET earnings_balance = earnings_balance - p_amount WHERE id = v_user_id;

    INSERT INTO public.payout_requests (user_id, amount, phone_number)
    VALUES (v_user_id, p_amount, p_phone_number) RETURNING id INTO v_payout_id;

    RETURN v_payout_id;
END;
$$;


-- ============================================================
-- Feature: Song Battles (Bongo Verzuz)
-- ============================================================

-- 1. Create song_battles table
CREATE TABLE IF NOT EXISTS public.song_battles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    track1_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
    track2_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
    track1_votes INT DEFAULT 0,
    track2_votes INT DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
    winner_id UUID REFERENCES public.tracks(id) ON DELETE SET NULL,
    end_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.song_battles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view battles" ON public.song_battles;
CREATE POLICY "Everyone can view battles" ON public.song_battles FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Admins and Artists can manage battles" ON public.song_battles;
CREATE POLICY "Admins and Artists can manage battles" ON public.song_battles 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'artist')))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'artist')));

-- 2. Create battle_votes table
CREATE TABLE IF NOT EXISTS public.battle_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    battle_id UUID NOT NULL REFERENCES public.song_battles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
    amount_spent INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_battle_votes_battle_id ON public.battle_votes(battle_id);
CREATE INDEX IF NOT EXISTS idx_battle_votes_user_id ON public.battle_votes(user_id);

-- Enable RLS
ALTER TABLE public.battle_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view votes" ON public.battle_votes;
CREATE POLICY "Everyone can view votes" ON public.battle_votes FOR SELECT USING (TRUE);

-- 3. Function to vote in a battle
CREATE OR REPLACE FUNCTION public.vote_in_battle(p_battle_id UUID, p_track_id UUID, p_amount INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_current_credits INT;
    v_battle_status TEXT;
    v_artist_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be greater than zero'; END IF;

    SELECT status INTO v_battle_status FROM public.song_battles WHERE id = p_battle_id;
    IF v_battle_status != 'active' THEN RAISE EXCEPTION 'This battle has ended'; END IF;

    SELECT credits INTO v_current_credits FROM public.profiles WHERE id = v_user_id FOR UPDATE;
    IF v_current_credits < p_amount THEN RAISE EXCEPTION 'Insufficient Bongo Credits'; END IF;

    UPDATE public.profiles SET credits = credits - p_amount WHERE id = v_user_id;

    INSERT INTO public.battle_votes (battle_id, user_id, track_id, amount_spent)
    VALUES (p_battle_id, v_user_id, p_track_id, p_amount);

    IF p_track_id = (SELECT track1_id FROM public.song_battles WHERE id = p_battle_id) THEN
        UPDATE public.song_battles SET track1_votes = track1_votes + p_amount WHERE id = p_battle_id;
    ELSIF p_track_id = (SELECT track2_id FROM public.song_battles WHERE id = p_battle_id) THEN
        UPDATE public.song_battles SET track2_votes = track2_votes + p_amount WHERE id = p_battle_id;
    ELSE
        RAISE EXCEPTION 'Track is not in this battle';
    END IF;

    SELECT user_id INTO v_artist_id FROM public.tracks WHERE id = p_track_id;
    IF v_artist_id IS NOT NULL THEN
        UPDATE public.profiles SET earnings_balance = earnings_balance + (p_amount * 0.7)::INT WHERE id = v_artist_id;
    END IF;

    RETURN TRUE;
END;
$$;
