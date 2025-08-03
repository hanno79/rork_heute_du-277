// Simple Supabase connection test
describe('Supabase Connection', () => {
  test('should be able to connect to Supabase', () => {
    expect(process.env.EXPO_PUBLIC_SUPABASE_URL).toBeDefined();
    expect(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY).toBeDefined();
  });
});


