import quotes from '@/mocks/quotes';

describe('Favorites Localization Test', () => {
  // Helper function to simulate the getCompleteQuoteData function
  const getCompleteQuoteData = (quoteId: string, basicQuoteData: any, currentLanguage: string) => {
    const mockQuote = quotes.find(q => q.id === quoteId);
    
    if (mockQuote) {
      const localizedQuote = mockQuote.translations?.[currentLanguage];
      
      if (localizedQuote && currentLanguage !== 'en') {
        return {
          ...mockQuote,
          text: localizedQuote.text,
          context: localizedQuote.context,
          explanation: localizedQuote.explanation,
          situations: localizedQuote.situations,
          tags: localizedQuote.tags,
        };
      }
      
      return mockQuote;
    }
    
    return {
      id: basicQuoteData.id,
      text: basicQuoteData.text,
      reference: basicQuoteData.source || '',
      author: basicQuoteData.author || '',
      book: '',
      chapter: 0,
      verse: 0,
      type: (basicQuoteData.category || 'quote'),
      context: '',
      explanation: '',
      situations: [],
      tags: [],
      translations: {}
    };
  };

  test('should return English version when language is en', () => {
    const testQuoteId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const basicData = { id: testQuoteId, text: 'test', source: 'test' };
    
    const result = getCompleteQuoteData(testQuoteId, basicData, 'en');
    
    expect(result.text).toBe("An eye for an eye, a tooth for a tooth.");
    expect(result.situations).toEqual(["facing injustice", "dealing with revenge", "legal matters", "proportional response"]);
    expect(result.tags).toEqual(["justice", "law", "retribution"]);
  });

  test('should return German version when language is de', () => {
    const testQuoteId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const basicData = { id: testQuoteId, text: 'test', source: 'test' };
    
    const result = getCompleteQuoteData(testQuoteId, basicData, 'de');
    
    expect(result.text).toBe("Auge um Auge, Zahn um Zahn.");
    expect(result.situations).toEqual(["Ungerechtigkeit erleben", "mit Rache umgehen", "rechtliche Angelegenheiten", "angemessene Reaktion"]);
    expect(result.tags).toEqual(["Gerechtigkeit", "Gesetz", "Vergeltung"]);
  });

  test('should return English version for unsupported language', () => {
    const testQuoteId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const basicData = { id: testQuoteId, text: 'test', source: 'test' };
    
    const result = getCompleteQuoteData(testQuoteId, basicData, 'fr'); // French not supported
    
    expect(result.text).toBe("An eye for an eye, a tooth for a tooth.");
    expect(result.situations).toEqual(["facing injustice", "dealing with revenge", "legal matters", "proportional response"]);
    expect(result.tags).toEqual(["justice", "law", "retribution"]);
  });

  test('should test multiple quotes for German localization', () => {
    const testQuotes = [
      {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        expectedText: "Auge um Auge, Zahn um Zahn.",
        expectedSituations: ["Ungerechtigkeit erleben", "mit Rache umgehen", "rechtliche Angelegenheiten", "angemessene Reaktion"]
      },
      {
        id: 'b2c3d4e5-f6g7-8901-bcde-f23456789012',
        expectedText: "Liebe deinen Nächsten wie dich selbst.",
        expectedSituations: ["Gemeindekonflikte", "anderen helfen", "ethische Dilemmata", "Beziehungen"]
      },
      {
        id: 'c3d4e5f6-g7h8-9012-cdef-345678901234',
        expectedText: "Denn ich weiß wohl, was ich für Gedanken über euch habe, spricht der HERR: Gedanken des Friedens und nicht des Leides, dass ich euch gebe Zukunft und Hoffnung.",
        expectedSituations: ["Ungewissheit", "Berufsentscheidungen", "schwierige Zeiten", "Lebensübergänge"]
      }
    ];

    testQuotes.forEach(testCase => {
      const basicData = { id: testCase.id, text: 'test', source: 'test' };
      const result = getCompleteQuoteData(testCase.id, basicData, 'de');
      
      expect(result.text).toBe(testCase.expectedText);
      expect(result.situations).toEqual(testCase.expectedSituations);
      expect(result.context).toBeDefined();
      expect(result.explanation).toBeDefined();
      expect(result.tags).toBeDefined();
      
      console.log(`Quote ${testCase.id} German localization:`, {
        text: result.text.substring(0, 50) + '...',
        situations: result.situations,
        tags: result.tags
      });
    });
  });

  test('should verify all test quotes have German translations', () => {
    const testQuoteIds = [
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      'b2c3d4e5-f6g7-8901-bcde-f23456789012',
      'c3d4e5f6-g7h8-9012-cdef-345678901234'
    ];

    testQuoteIds.forEach(quoteId => {
      const quote = quotes.find(q => q.id === quoteId);
      expect(quote).toBeTruthy();
      expect(quote!.translations).toBeDefined();
      expect(quote!.translations.de).toBeDefined();
      expect(quote!.translations.de.text).toBeTruthy();
      expect(quote!.translations.de.situations).toBeDefined();
      expect(quote!.translations.de.tags).toBeDefined();
      expect(Array.isArray(quote!.translations.de.situations)).toBe(true);
      expect(Array.isArray(quote!.translations.de.tags)).toBe(true);
    });
  });
});
