-- Create a function to check if the user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policy for Admins to view ALL verification requests
CREATE POLICY "Admins can view all verification requests"
ON public.verification_requests FOR SELECT
USING (public.is_admin());

-- Policy for Admins to update verification requests (approve/reject)
CREATE POLICY "Admins can update verification requests"
ON public.verification_requests FOR UPDATE
USING (public.is_admin());
