const { categorize, categorizeMany, resetRulesCache } = require('../services/categorization');

beforeEach(() => {
  resetRulesCache();
});

describe('categorize()', () => {
  describe('debit transactions', () => {
    test('matches a hotel booking', () => {
      // Pattern in CSV is \bbookings?\scom (space, not dot) or \bbookingcom\b
      const result = categorize('BOOKING COM AMSTERDAM', 'debit');
      expect(result.matched).toBe(true);
      expect(result.primary).toBe('Holiday');
      expect(result.secondary).toBe('Accomodation');
    });

    test('matches a supermarket', () => {
      const result = categorize('WOOLWORTHS METRO SYDNEY', 'debit');
      expect(result.matched).toBe(true);
      expect(result.primary).toBe('Groceries');
    });

    test('matches a petrol station', () => {
      const result = categorize('SHELL SERVICE STATION MELB', 'debit');
      expect(result.matched).toBe(true);
    });

    test('returns Uncategorized for unknown description', () => {
      const result = categorize('XYZZY INCOMPREHENSIBLE MERCHANT 999', 'debit');
      expect(result.matched).toBe(false);
      expect(result.primary).toBe('Uncategorized');
    });
  });

  describe('credit transactions', () => {
    test('matches salary deposit', () => {
      const result = categorize('SALARY PAYMENT FROM EMPLOYER', 'credit');
      expect(result.matched).toBe(true);
      expect(result.primary).toBe('Income');
    });

    test('matches a dividend', () => {
      const result = categorize('BHP DIVIDEND PAYMENT', 'credit');
      expect(result.matched).toBe(true);
      expect(result.primary).toBe('Income');
      expect(result.secondary).toBe('Income');
      expect(result.tertiary).toBe('Dividend');
    });

    test('returns Uncategorized for unknown credit', () => {
      const result = categorize('XYZZY MYSTERY CREDIT 9999', 'credit');
      expect(result.matched).toBe(false);
      expect(result.primary).toBe('Uncategorized');
    });
  });
});

describe('categorizeMany()', () => {
  test('categorizes an array of transactions', () => {
    const txns = [
      { description: 'BOOKING COM RESERVATION', type: 'debit', amount: 250 },
      { description: 'SALARY ACME CORP', type: 'credit', amount: 5000 },
      { description: 'XYZZY UNKNOWN', type: 'debit', amount: 10 },
    ];
    const results = categorizeMany(txns);
    expect(results).toHaveLength(3);
    expect(results[0].category.primary).toBe('Holiday');
    expect(results[1].category.primary).toBe('Income');
    expect(results[2].category.primary).toBe('Uncategorized');
    // All have categorizedAutomatically flag
    results.forEach(r => expect(r.categorizedAutomatically).toBe(true));
  });

  test('returns original fields alongside category', () => {
    const txns = [{ description: 'WOOLWORTHS METRO', type: 'debit', amount: 45.5 }];
    const [result] = categorizeMany(txns);
    expect(result.amount).toBe(45.5);
    expect(result.description).toBe('WOOLWORTHS METRO');
    expect(result.category).toBeDefined();
  });
});
