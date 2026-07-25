ALTER TABLE tracks ADD COLUMN IF NOT EXISTS copyright_cleared BOOLEAN DEFAULT true;

CREATE TABLE IF NOT EXISTS copyright_reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE copyright_reports ENABLE ROW LEVEL SECURITY;

-- Policies for copyright_reports
CREATE POLICY "Users can insert their own reports" ON copyright_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Admins can view and update all reports" ON copyright_reports
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
