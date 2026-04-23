-- Replace the update policy to allow admins to update any profile
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

CREATE POLICY "Users can update their own profile or admin can update any" ON profiles
  FOR UPDATE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true
    )
  );
