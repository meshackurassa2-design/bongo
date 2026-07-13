-- This function replaces the existing add_credits function.
-- It ensures that only users with the 'admin' role can add credits.
-- Run this in your Supabase SQL Editor!

CREATE OR REPLACE FUNCTION public.add_credits(user_id uuid, amount integer)
RETURNS void AS $$
BEGIN
  -- Check if the user calling the function is an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can add free credits.';
  END IF;

  -- Add the credits to the target user
  UPDATE public.profiles
  SET credits = coalesce(credits, 0) + amount
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
