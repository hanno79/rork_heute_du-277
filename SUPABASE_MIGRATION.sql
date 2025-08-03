-- Migration to fix UUID issues with quotes table
-- This script should be run in the Supabase SQL editor

-- First, drop the existing foreign key constraint
ALTER TABLE user_favorites DROP CONSTRAINT IF EXISTS user_favorites_quote_id_fkey;

-- Drop the existing quotes table if it exists
DROP TABLE IF EXISTS quotes CASCADE;

-- Recreate the quotes table with TEXT id instead of UUID
CREATE TABLE quotes (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  author TEXT,
  source TEXT,
  category TEXT,
  language TEXT DEFAULT 'de',
  is_premium BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Update the user_favorites table to use TEXT for quote_id
ALTER TABLE user_favorites ALTER COLUMN quote_id TYPE TEXT;

-- Add the foreign key constraint back
ALTER TABLE user_favorites ADD CONSTRAINT user_favorites_quote_id_fkey 
  FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE;

-- Enable RLS on quotes table
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- Create policies for quotes table
CREATE POLICY "Quotes are viewable by everyone" ON quotes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert quotes" ON quotes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Insert sample quotes with the new UUID-like IDs
INSERT INTO quotes (id, text, author, source, category, language, is_premium) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'An eye for an eye, a tooth for a tooth.', '', 'Exodus 21:24', 'bible', 'de', false),
('b2c3d4e5-f6g7-8901-bcde-f23456789012', 'Love your neighbor as yourself.', '', 'Mark 12:31', 'bible', 'de', false),
('c3d4e5f6-g7h8-9012-cdef-345678901234', 'For I know the plans I have for you, declares the LORD, plans to prosper you and not to harm you, plans to give you hope and a future.', '', 'Jeremiah 29:11', 'bible', 'de', false),
('d4e5f6g7-h8i9-0123-def0-456789012345', 'The only way to do great work is to love what you do.', 'Steve Jobs', 'Steve Jobs', 'quote', 'de', false),
('e5f6g7h8-i9j0-1234-ef01-567890123456', 'In the middle of difficulty lies opportunity.', 'Albert Einstein', 'Albert Einstein', 'quote', 'de', false),
('f6g7h8i9-j0k1-2345-f012-678901234567', 'Be yourself; everyone else is already taken.', 'Oscar Wilde', 'Oscar Wilde', 'quote', 'de', false),
('g7h8i9j0-k1l2-3456-0123-789012345678', 'What doesn''t kill you makes you stronger.', 'Friedrich Nietzsche', 'Friedrich Nietzsche', 'saying', 'de', false),
('h8i9j0k1-l2m3-4567-1234-890123456789', 'The journey of a thousand miles begins with one step.', 'Lao Tzu', 'Lao Tzu', 'saying', 'de', false),
('i9j0k1l2-m3n4-5678-2345-901234567890', 'Cast all your anxiety on him because he cares for you.', '', '1 Peter 5:7', 'bible', 'de', false),
('j0k1l2m3-n4o5-6789-3456-012345678901', 'Trust in the LORD with all your heart and lean not on your own understanding.', '', 'Proverbs 3:5', 'bible', 'de', false),
('k1l2m3n4-o5p6-7890-4567-123456789012', 'The best time to plant a tree was 20 years ago. The second best time is now.', '', 'Chinese Proverb', 'saying', 'de', false),
('l2m3n4o5-p6q7-8901-5678-234567890123', 'Happiness is not something ready made. It comes from your own actions.', 'Dalai Lama', 'Dalai Lama', 'quote', 'de', false),
('m3n4o5p6-q7r8-9012-6789-345678901234', 'Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.', '', 'Philippians 4:6', 'bible', 'de', false),
('n4o5p6q7-r8s9-0123-789a-456789012345', 'It is during our darkest moments that we must focus to see the light.', 'Aristotle', 'Aristotle', 'quote', 'de', false),
('o5p6q7r8-s9t0-1234-89ab-567890123456', 'Family is not an important thing. It''s everything.', 'Michael J. Fox', 'Michael J. Fox', 'quote', 'de', false),
('p6q7r8s9-t0u1-2345-9abc-678901234567', 'The Lord is my shepherd; I shall not want.', '', 'Psalm 23:1', 'bible', 'de', false);

-- Create updated_at trigger for quotes table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON quotes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();