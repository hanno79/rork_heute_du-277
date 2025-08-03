import { supabase } from '@/lib/supabase';

describe('Favorites Integration Test', () => {
  let testUserId: string;
  const testEmail = `test-favorites-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

  beforeAll(async () => {
    // Create a test user
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (error) {
      console.error('Error creating test user:', error);
      throw error;
    }

    testUserId = data.user?.id || '';
    expect(testUserId).toBeTruthy();
  });

  afterAll(async () => {
    // Clean up test data
    if (testUserId) {
      await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', testUserId);
    }
    
    await supabase.auth.signOut();
  });

  test('should be able to add a favorite quote', async () => {
    // Sign in the test user
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    expect(signInError).toBeNull();

    // Test quote ID from the database
    const testQuoteId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

    // Add to favorites
    const { error } = await supabase
      .from('user_favorites')
      .insert({
        user_id: testUserId,
        quote_id: testQuoteId,
      });

    expect(error).toBeNull();

    // Verify it was added
    const { data: favorites, error: fetchError } = await supabase
      .from('user_favorites')
      .select('*')
      .eq('user_id', testUserId)
      .eq('quote_id', testQuoteId);

    expect(fetchError).toBeNull();
    expect(favorites).toHaveLength(1);
    expect(favorites![0].quote_id).toBe(testQuoteId);
  });

  test('should be able to fetch favorites with quote details', async () => {
    // Fetch favorites with joined quote data
    const { data, error } = await supabase
      .from('user_favorites')
      .select(`
        id,
        created_at,
        quotes (
          id,
          text,
          author,
          source,
          category,
          language,
          is_premium
        )
      `)
      .eq('user_id', testUserId);

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.length).toBeGreaterThan(0);

    const favorite = data![0];
    expect(favorite.quotes).toBeTruthy();
    
    const quote = favorite.quotes as any;
    expect(quote.id).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    expect(quote.text).toBe('An eye for an eye, a tooth for a tooth.');
  });

  test('should be able to remove a favorite', async () => {
    const testQuoteId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

    // Remove from favorites
    const { error } = await supabase
      .from('user_favorites')
      .delete()
      .eq('user_id', testUserId)
      .eq('quote_id', testQuoteId);

    expect(error).toBeNull();

    // Verify it was removed
    const { data: favorites, error: fetchError } = await supabase
      .from('user_favorites')
      .select('*')
      .eq('user_id', testUserId)
      .eq('quote_id', testQuoteId);

    expect(fetchError).toBeNull();
    expect(favorites).toHaveLength(0);
  });

  test('should verify quotes table has TEXT IDs', async () => {
    const { data, error } = await supabase
      .from('quotes')
      .select('id, text')
      .limit(1);

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.length).toBeGreaterThan(0);

    const quote = data![0];
    expect(typeof quote.id).toBe('string');
    expect(quote.id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
  });
});
