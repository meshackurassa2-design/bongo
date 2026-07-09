-- Policy to allow Admins to update profiles (like giving them the verified tick)
CREATE POLICY "Admins can update profiles"
ON public.profiles FOR UPDATE
USING (public.is_admin());
