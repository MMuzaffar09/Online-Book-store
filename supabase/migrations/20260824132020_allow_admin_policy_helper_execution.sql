/*
# Allow authenticated policy evaluation

1. Security Change
- Grant authenticated sessions permission to execute the private `is_admin()` helper.
- The helper remains security-definer, uses a fixed search path, and is only useful for evaluating row policies.
- Anonymous sessions retain no execute permission.

2. Important Notes
- This is required because PostgreSQL checks function execution permission while evaluating admin-only policies.
- No application data or table permissions are changed.
*/

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
