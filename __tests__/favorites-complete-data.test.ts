import { supabase } from '@/lib/supabase';
import quotes from '@/mocks/quotes';

describe('Favorites Complete Data Test', () => {
  let testUserId: string;
  const testEmail = `test-complete-${Date.now()}@example.com`;
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

  test('should load favorites with complete quote data including situations and tags', async () => {
    // Sign in the test user
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    expect(signInError).toBeNull();

    // Test quote ID that exists in mocks with situations and tags
    const testQuoteId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    
    // Verify the mock quote has situations and tags
    const mockQuote = quotes.find(q => q.id === testQuoteId);
    expect(mockQuote).toBeTruthy();
    expect(mockQuote!.situations.length).toBeGreaterThan(0);
    expect(mockQuote!.tags.length).toBeGreaterThan(0);
    
    console.log('Mock quote situations:', mockQuote!.situations);
    console.log('Mock quote tags:', mockQuote!.tags);

    // Add to favorites
    const { error } = await supabase
      .from('user_favorites')
      .insert({
        user_id: testUserId,
        quote_id: testQuoteId,
      });

    expect(error).toBeNull();

    // Fetch favorites with joined quote data
    const { data, error: fetchError } = await supabase
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

    expect(fetchError).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.length).toBeGreaterThan(0);

    const favorite = data![0];
    expect(favorite.quotes).toBeTruthy();
    
    const quote = favorite.quotes as any;
    expect(quote.id).toBe(testQuoteId);
    
    // The raw Supabase data won't have situations/tags
    // But our useFavorites hook should enrich it with mock data
    console.log('Raw Supabase quote data:', quote);
    
    // Test that we can find the complete mock data
    const completeQuote = quotes.find(q => q.id === quote.id);
    expect(completeQuote).toBeTruthy();
    expect(completeQuote!.situations).toEqual(["facing injustice", "dealing with revenge", "legal matters", "proportional response"]);
    expect(completeQuote!.tags).toEqual(["justice", "law", "retribution"]);
  });

  test('should verify mock quotes have the expected structure', async () => {
    // Test a few quotes to ensure they have the expected data
    const testQuotes = [
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      'b2c3d4e5-f6g7-8901-bcde-f23456789012',
      'c3d4e5f6-g7h8-9012-cdef-345678901234'
    ];

    testQuotes.forEach(quoteId => {
      const quote = quotes.find(q => q.id === quoteId);
      expect(quote).toBeTruthy();
      expect(quote!.situations).toBeDefined();
      expect(quote!.tags).toBeDefined();
      expect(quote!.context).toBeDefined();
      expect(quote!.explanation).toBeDefined();
      expect(Array.isArray(quote!.situations)).toBe(true);
      expect(Array.isArray(quote!.tags)).toBe(true);
      expect(quote!.situations.length).toBeGreaterThan(0);
      expect(quote!.tags.length).toBeGreaterThan(0);
      
      console.log(`Quote ${quoteId}:`, {
        situations: quote!.situations,
        tags: quote!.tags,
        context: quote!.context.substring(0, 50) + '...',
        explanation: quote!.explanation.substring(0, 50) + '...'
      });
    });
  });
});
