-- Function to update the profile when a verification request is approved
CREATE OR REPLACE FUNCTION handle_verification_approval()
RETURNS TRIGGER AS $$
BEGIN
    -- If the status was changed to 'approved'
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
        UPDATE public.profiles
        SET is_verified = TRUE
        WHERE id = NEW.user_id;
    END IF;

    -- If the status was changed to 'rejected' or 'pending' from 'approved'
    IF NEW.status != 'approved' AND OLD.status = 'approved' THEN
        UPDATE public.profiles
        SET is_verified = FALSE
        WHERE id = NEW.user_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run the function whenever a verification_request is updated
DROP TRIGGER IF EXISTS on_verification_approved ON public.verification_requests;
CREATE TRIGGER on_verification_approved
AFTER UPDATE ON public.verification_requests
FOR EACH ROW
EXECUTE FUNCTION handle_verification_approval();
