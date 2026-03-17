const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const RULES_DIR = path.join(__dirname, '..', 'regex_rules');

/**
 * Load and parse a CSV rules file into an array of rule objects.
 * Each rule has: primaryCategory, secondaryCategory, tertiaryCategory,
 * merchantName, includeRegex, excludeRegex.
 */
function loadRules(filename) {
  const filePath = path.join(RULES_DIR, filename);
  const content = fs.readFileSync(filePath, 'utf8');
  const records = parse(content, {
    columns: ['primaryCategory', 'secondaryCategory', 'tertiaryCategory', 'merchantName', 'includeRegex', 'excludeRegex'],
    from_line: 2, // skip header row
    skip_empty_lines: true,
    relax_quotes: true,
  });

  return records
    .filter(r => r.includeRegex)
    .map(r => ({
      ...r,
      includePattern: new RegExp(r.includeRegex, 'i'),
      excludePattern: r.excludeRegex ? new RegExp(r.excludeRegex, 'i') : null,
    }));
}

// Load rules once at startup
let debitRules = null;
let creditRules = null;

function getDebitRules() {
  if (!debitRules) {
    debitRules = loadRules('consumer_debit_categories_niki.csv');
  }
  return debitRules;
}

function getCreditRules() {
  if (!creditRules) {
    creditRules = loadRules('consumer_credit_categories_niki.csv');
  }
  return creditRules;
}

/**
 * Categorize a single transaction description.
 *
 * @param {string} description - The transaction description/narration.
 * @param {'debit'|'credit'} type - Transaction type.
 * @returns {{ primary, secondary, tertiary, merchant, matched: boolean }}
 */
function categorize(description, type) {
  const rules = type === 'credit' ? getCreditRules() : getDebitRules();
  const normalized = description.toLowerCase().trim();

  for (const rule of rules) {
    if (!rule.includePattern.test(normalized)) continue;
    if (rule.excludePattern && rule.excludePattern.test(normalized)) continue;

    return {
      primary: rule.primaryCategory,
      secondary: rule.secondaryCategory,
      tertiary: rule.tertiaryCategory,
      merchant: rule.merchantName,
      matched: true,
    };
  }

  return {
    primary: 'Uncategorized',
    secondary: '',
    tertiary: '',
    merchant: '',
    matched: false,
  };
}

/**
 * Categorize an array of transactions.
 *
 * @param {{ description: string, type: 'debit'|'credit' }[]} transactions
 * @returns {Array} Transactions with category fields populated.
 */
function categorizeMany(transactions) {
  return transactions.map(tx => ({
    ...tx,
    category: categorize(tx.description, tx.type),
    categorizedAutomatically: true,
  }));
}

// Allow tests to reset the cached rules
function resetRulesCache() {
  debitRules = null;
  creditRules = null;
}

module.exports = { categorize, categorizeMany, resetRulesCache };
