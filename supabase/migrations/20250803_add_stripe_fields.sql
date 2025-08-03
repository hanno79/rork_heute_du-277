-- Add Stripe-related fields to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer_id 
ON user_profiles(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_subscription_id 
ON user_profiles(stripe_subscription_id);

-- Add unique constraints to prevent duplicate Stripe IDs
ALTER TABLE user_profiles 
ADD CONSTRAINT unique_stripe_customer_id UNIQUE (stripe_customer_id);

ALTER TABLE user_profiles 
ADD CONSTRAINT unique_stripe_subscription_id UNIQUE (stripe_subscription_id);

-- Update the updated_at trigger to include new fields
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
