// Public settings for the shared back end. The anon key is public by design (it ships to every browser);
// what each person can read or change is enforced by row level security in supabase/schema.sql.
export const SUPABASE_URL = 'https://supabase.sagibp.com';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogImFub24iLCAiaXNzIjogInN1cGFiYXNlIiwgImlhdCI6IDE3ODI1Mzk5MjUsICJleHAiOiAyMDk3ODk5OTI1fQ.yhMazJ_AchQyaTUuYcCbXMaqgW9r85qCTF8ROmOhePY';
// Email-code sign-in needs the sending domain to be verified in Resend. Flip to true once it is.
export const EMAIL_LOGIN = true;
