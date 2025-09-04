-- ========================================================================
-- FIX: Add RLS Policies for profiles table
-- Description: This script enables RLS on the public.profiles table and adds
-- policies to allow users to manage their own profile information securely.
-- Without these policies, users cannot insert or update their own profiles,
-- leading to 500 errors from the API.
--
-- Run this script in the Supabase SQL Editor.
-- ========================================================================

-- 1. Enable Row Level Security on the profiles table
-- This ensures that the policies below will be enforced.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Add policy for users to view their own profile
-- This allows a user to select their own profile data.
CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- 3. Add policy for users to insert their own profile
-- This allows a new user to create their profile entry.
-- The `WITH CHECK` clause ensures a user can only create a profile for themselves.
CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- 4. Add policy for users to update their own profile
-- This allows a user to update their own profile information.
-- The `USING` clause specifies which rows can be updated (only their own).
-- The `WITH CHECK` clause ensures they can't change the id to someone else's.
CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Verification
SELECT 'Successfully enabled RLS and created policies for the profiles table.' as status;
