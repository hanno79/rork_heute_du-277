# Database Setup Instructions

## Supabase Database Setup

This app uses Supabase as the backend database. Follow these steps to set up the database:

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note down your project URL and anon key

### 2. Run the Migration Script

1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `SUPABASE_MIGRATION.sql`
4. Run the script

This will create the following tables:
- `user_profiles` - User profile information
- `quotes` - Quote data with TEXT id field (not UUID)
- `user_favorites` - User's favorite quotes
- `user_settings` - User notification and app settings

### 3. Configure Environment Variables

Create a `.env` file in your project root with:

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 4. Database Schema

#### Quotes Table
- `id` (TEXT) - Primary key, uses UUID-like format but stored as TEXT
- `text` (TEXT) - The quote content
- `author` (TEXT) - Quote author (nullable)
- `source` (TEXT) - Source reference (nullable)
- `category` (TEXT) - Quote category (bible, quote, saying, poem)
- `language` (TEXT) - Language code (default: 'de')
- `is_premium` (BOOLEAN) - Whether quote requires premium access

#### User Favorites Table
- `id` (UUID) - Primary key
- `user_id` (UUID) - References auth.users
- `quote_id` (TEXT) - References quotes.id
- `created_at` (TIMESTAMP)

#### User Profiles Table
- `id` (UUID) - Primary key, references auth.users
- `name` (TEXT) - User display name
- `is_premium` (BOOLEAN) - Premium subscription status
- `premium_expires_at` (TIMESTAMP) - Premium expiration date

#### User Settings Table
- `id` (UUID) - Primary key
- `user_id` (UUID) - References auth.users
- `language` (TEXT) - User's preferred language
- `notifications_enabled` (BOOLEAN) - Global notification setting
- `notification_time` (TEXT) - Preferred notification time
- `notification_days` (INTEGER[]) - Days of week for notifications
- `daily_quote` (BOOLEAN) - Daily quote notifications
- `motivational_reminders` (BOOLEAN) - Motivational reminder notifications
- `weekly_digest` (BOOLEAN) - Weekly digest notifications

### 5. Row Level Security (RLS)

The migration script automatically sets up RLS policies:

- **Quotes**: Readable by everyone, insertable by authenticated users
- **User Favorites**: Users can only access their own favorites
- **User Profiles**: Users can only access their own profile
- **User Settings**: Users can only access their own settings

### 6. Authentication

The app supports:
- Email/password authentication
- Email confirmation (optional in development)
- Mock user authentication for testing

### 7. Fallback Behavior

The app includes fallback mechanisms:
- If Supabase is unavailable, data is stored locally using AsyncStorage
- Mock users (non-UUID IDs) automatically use local storage
- Real Supabase users (UUID IDs) use the database with local storage fallback

### 8. Testing

To test the setup:
1. Register a new user with a valid email
2. Try adding quotes to favorites
3. Check that data persists across app restarts
4. Verify that different users have separate favorites

### Troubleshooting

**UUID Errors**: If you see UUID validation errors, ensure you've run the migration script that changes the quotes.id field from UUID to TEXT.

**Connection Issues**: Check your environment variables and ensure your Supabase project is active.

**RLS Errors**: Ensure you're authenticated when trying to access protected resources.

**Email Confirmation**: In development, email confirmation is optional. For production, configure your email settings in Supabase.