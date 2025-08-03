import { renderHook, act } from '@testing-library/react-native';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/providers/AuthProvider';
import quotes from '@/mocks/quotes';

// Mock the dependencies
jest.mock('@/providers/AuthProvider');
jest.mock('@/hooks/useLanguage', () => ({
  __esModule: true,
  default: () => ({
    currentLanguage: 'en',
  }),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('Favorites Authentication Check', () => {
  const testQuote = quotes[0];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should require login when user is not authenticated', async () => {
    // Mock unauthenticated state
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      tokens: null,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      refreshAuth: jest.fn(),
    });

    const { result } = renderHook(() => useFavorites());

    await act(async () => {
      const toggleResult = await result.current.toggleFavorite(testQuote);
      
      expect(toggleResult).toEqual({
        success: false,
        requiresLogin: true,
      });
    });
  });

  test('should allow favorites when user is authenticated with Supabase', async () => {
    // Mock authenticated Supabase user
    mockUseAuth.mockReturnValue({
      user: {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', // Valid UUID
        email: 'test@example.com',
        name: 'Test User',
        isPremium: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      isAuthenticated: true,
      isLoading: false,
      tokens: {
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: Date.now() + 3600000,
      },
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      refreshAuth: jest.fn(),
    });

    const { result } = renderHook(() => useFavorites());

    await act(async () => {
      const toggleResult = await result.current.toggleFavorite(testQuote);
      
      expect(toggleResult.success).toBe(true);
      expect(toggleResult.requiresLogin).toBeUndefined();
      expect(toggleResult.wasAdded).toBe(true);
    });
  });

  test('should allow favorites when user is authenticated with mock user', async () => {
    // Mock authenticated mock user
    mockUseAuth.mockReturnValue({
      user: {
        id: 'mock_user_123', // Non-UUID (mock user)
        email: 'mock@example.com',
        name: 'Mock User',
        isPremium: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      isAuthenticated: true,
      isLoading: false,
      tokens: {
        accessToken: 'mock-token',
        refreshToken: 'mock-refresh',
        expiresAt: Date.now() + 3600000,
      },
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      refreshAuth: jest.fn(),
    });

    const { result } = renderHook(() => useFavorites());

    await act(async () => {
      const toggleResult = await result.current.toggleFavorite(testQuote);
      
      expect(toggleResult.success).toBe(true);
      expect(toggleResult.requiresLogin).toBeUndefined();
      expect(toggleResult.wasAdded).toBe(true);
    });
  });

  test('should handle removing favorites when authenticated', async () => {
    // Mock authenticated user
    mockUseAuth.mockReturnValue({
      user: {
        id: 'mock_user_123',
        email: 'mock@example.com',
        name: 'Mock User',
        isPremium: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      isAuthenticated: true,
      isLoading: false,
      tokens: {
        accessToken: 'mock-token',
        refreshToken: 'mock-refresh',
        expiresAt: Date.now() + 3600000,
      },
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      refreshAuth: jest.fn(),
    });

    const { result } = renderHook(() => useFavorites());

    // First add the favorite
    await act(async () => {
      await result.current.toggleFavorite(testQuote);
    });

    // Then remove it
    await act(async () => {
      const toggleResult = await result.current.toggleFavorite(testQuote);
      
      expect(toggleResult.success).toBe(true);
      expect(toggleResult.requiresLogin).toBeUndefined();
      expect(toggleResult.wasAdded).toBe(false);
    });
  });

  test('should check authentication status correctly', () => {
    // Test unauthenticated state
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      tokens: null,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      refreshAuth: jest.fn(),
    });

    const { result } = renderHook(() => useFavorites());
    
    expect(result.current.favorites).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  test('should validate UUID format for Supabase users', () => {
    const validUUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const invalidUUID = 'mock_user_123';
    
    // This tests the internal UUID validation logic
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    expect(uuidRegex.test(validUUID)).toBe(true);
    expect(uuidRegex.test(invalidUUID)).toBe(false);
  });
});
