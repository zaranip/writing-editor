-- Add OpenRouter as a supported provider
-- This migration updates the provider constraint to include 'openrouter'

-- Drop the existing constraint and recreate with openrouter
ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_provider_check;
ALTER TABLE api_keys ADD CONSTRAINT api_keys_provider_check 
  CHECK (provider IN ('openai', 'anthropic', 'google', 'openrouter'));
