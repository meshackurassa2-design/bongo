-- STEP 1: Check dapaz current status
SELECT id, username, display_name, is_verified, role 
FROM public.profiles 
WHERE username = 'dapaz';

-- STEP 2: Force set is_verified = true for dapaz
-- (Run this after Step 1 if is_verified is not already true)
UPDATE public.profiles 
SET is_verified = TRUE 
WHERE username = 'dapaz';

-- STEP 3: Confirm it worked
SELECT id, username, display_name, is_verified, role 
FROM public.profiles 
WHERE username = 'dapaz';
