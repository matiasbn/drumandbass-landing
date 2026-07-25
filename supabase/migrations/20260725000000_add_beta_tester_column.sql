-- Beta testers del club SUBIDÓN: pueden entrar al club en beta sin ser admins.
-- (El gate del club acepta is_admin OR beta_tester.)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS beta_tester BOOLEAN NOT NULL DEFAULT false;

-- Encender el flag para los admins actuales.
UPDATE profiles SET beta_tester = true
WHERE email IN ('alangf@gmail.com', 'zeroday@dnbchile.cl');
