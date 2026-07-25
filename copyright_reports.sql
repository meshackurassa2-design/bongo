-- Create copyright_reports table
CREATE TABLE IF NOT EXISTS public.copyright_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid REFERENCES public.tracks(id) ON DELETE SET NULL,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dismissed', 'resolved')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.copyright_reports ENABLE ROW LEVEL SECURITY;

-- Admins can read all reports
CREATE POLICY "Admins can read reports"
  ON public.copyright_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Any authenticated user can insert a report
CREATE POLICY "Users can submit reports"
  ON public.copyright_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- Admins can update reports (dismiss/resolve)
CREATE POLICY "Admins can update reports"
  ON public.copyright_reports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
