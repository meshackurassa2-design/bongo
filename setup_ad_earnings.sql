-- ============================================================
-- Feature: Ad Monetization and Dynamic Earnings Split
-- Execute this entire file in your Supabase SQL Editor
-- ============================================================

-- 1. Create a ledger table to track every single earning event
CREATE TABLE IF NOT EXISTS public.ad_earnings_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
    listener_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, 
    action_type TEXT NOT NULL, 
    ad_value_micros BIGINT NOT NULL, 
    currency TEXT NOT NULL DEFAULT 'USD',
    artist_share_amount BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_ad_earnings_artist_id ON public.ad_earnings_ledger(artist_id);
CREATE INDEX IF NOT EXISTS idx_ad_earnings_track_id ON public.ad_earnings_ledger(track_id);

-- Enable RLS
ALTER TABLE public.ad_earnings_ledger ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Artists can view their own ad earnings" ON public.ad_earnings_ledger;
CREATE POLICY "Artists can view their own ad earnings" ON public.ad_earnings_ledger
    FOR SELECT USING (auth.uid() = artist_id);

DROP POLICY IF EXISTS "Admins can view all ad earnings" ON public.ad_earnings_ledger;
CREATE POLICY "Admins can view all ad earnings" ON public.ad_earnings_ledger
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 2. Create the dynamic payout function
CREATE OR REPLACE FUNCTION public.reward_artist_dynamic_ad(
    p_track_id UUID, 
    p_action_type TEXT, 
    p_ad_value_micros BIGINT, 
    p_currency TEXT DEFAULT 'USD'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_artist_id UUID;
    v_artist_share BIGINT;
    v_conversion_rate INT := 2600; -- Example: 1 USD = 2600 TZS. 
    v_artist_share_tzs INT;
BEGIN
    -- Calculate 70% of the actual Google Ad value
    v_artist_share := (p_ad_value_micros * 70) / 100;
    
    -- Convert micros to whole currency, then apply TZS exchange rate
    -- Formula: (micros / 1,000,000) * conversion_rate
    v_artist_share_tzs := (v_artist_share * v_conversion_rate) / 1000000;
    
    -- Prevent zero payouts for extremely small micro-fractions
    IF v_artist_share_tzs < 1 THEN
        v_artist_share_tzs := 1;
    END IF;

    -- Get the artist ID for the track
    SELECT user_id INTO v_artist_id FROM public.tracks WHERE id = p_track_id;
    
    IF v_artist_id IS NOT NULL THEN
        -- A. Update the artist's total balance
        UPDATE public.profiles 
        SET earnings_balance = COALESCE(earnings_balance, 0) + v_artist_share_tzs 
        WHERE id = v_artist_id;

        -- B. Log the exact transaction in the ledger
        INSERT INTO public.ad_earnings_ledger (
            artist_id, track_id, listener_id, action_type, ad_value_micros, currency, artist_share_amount
        ) VALUES (
            v_artist_id, p_track_id, auth.uid(), p_action_type, p_ad_value_micros, p_currency, v_artist_share_tzs
        );
    END IF;
    
    RETURN TRUE;
END;
$$;
