const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const router = express.Router();
const TransactionModel = require('../models/transaction');
const { categorize, categorizeMany } = require('../services/categorization');

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return false;
  }
  return true;
}

/**
 * POST /transactions
 * Create a single transaction (auto-categorized).
 */
router.post(
  '/',
  [
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('amount').isFloat().withMessage('Amount must be a number'),
    body('date').optional().isISO8601().withMessage('Date must be ISO 8601'),
    body('type').isIn(['debit', 'credit']).withMessage('Type must be debit or credit'),
    body('notes').optional().isString(),
  ],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;
    try {
      const { description, amount, date, type, notes } = req.body;
      const category = categorize(description, type);
      const transaction = await TransactionModel.create({
        user: req.user._id,
        description,
        amount,
        date: date || new Date(),
        type,
        category,
        categorizedAutomatically: category.matched,
        notes: notes || '',
      });
      res.status(201).json({ transaction });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /transactions/bulk
 * Create multiple transactions at once (all auto-categorized).
 * Body: { transactions: [{ description, amount, date, type, notes }] }
 */
router.post(
  '/bulk',
  [
    body('transactions').isArray({ min: 1 }).withMessage('transactions must be a non-empty array'),
    body('transactions.*.description').trim().notEmpty().withMessage('Each transaction needs a description'),
    body('transactions.*.amount').isFloat().withMessage('Each transaction needs a numeric amount'),
    body('transactions.*.type').isIn(['debit', 'credit']).withMessage('Type must be debit or credit'),
    body('transactions.*.date').optional().isISO8601(),
  ],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;
    try {
      const incoming = req.body.transactions;
      const categorized = categorizeMany(incoming);
      const docs = categorized.map(tx => ({
        user: req.user._id,
        description: tx.description,
        amount: tx.amount,
        date: tx.date || new Date(),
        type: tx.type,
        category: tx.category,
        categorizedAutomatically: tx.category.matched,
        notes: tx.notes || '',
      }));
      const created = await TransactionModel.insertMany(docs);
      res.status(201).json({ count: created.length, transactions: created });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /transactions
 * List the authenticated user's transactions with optional filters.
 * Query params: type, category, startDate, endDate, limit, offset
 */
router.get(
  '/',
  [
    query('type').optional().isIn(['debit', 'credit']),
    query('category').optional().isString(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
  ],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;
    try {
      const { type, category, startDate, endDate, limit = 50, offset = 0 } = req.query;
      const filter = { user: req.user._id };
      if (type) filter.type = type;
      if (category) filter['category.primary'] = category;
      if (startDate || endDate) {
        filter.date = {};
        if (startDate) filter.date.$gte = new Date(startDate);
        if (endDate) filter.date.$lte = new Date(endDate);
      }
      const [transactions, total] = await Promise.all([
        TransactionModel.find(filter).sort({ date: -1 }).skip(offset).limit(limit),
        TransactionModel.countDocuments(filter),
      ]);
      res.json({ total, offset, limit, transactions });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /transactions/summary
 * Spending summary grouped by primary category for the authenticated user.
 * Query params: startDate, endDate, type
 */
router.get(
  '/summary',
  [
    query('type').optional().isIn(['debit', 'credit']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;
    try {
      const { type, startDate, endDate } = req.query;
      const match = { user: req.user._id };
      if (type) match.type = type;
      if (startDate || endDate) {
        match.date = {};
        if (startDate) match.date.$gte = new Date(startDate);
        if (endDate) match.date.$lte = new Date(endDate);
      }
      const summary = await TransactionModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$category.primary',
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
        { $project: { _id: 0, category: '$_id', total: 1, count: 1 } },
      ]);
      res.json({ summary });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /transactions/:id
 * Get a single transaction by ID.
 */
router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid transaction ID')],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;
    try {
      const transaction = await TransactionModel.findOne({ _id: req.params.id, user: req.user._id });
      if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
      res.json({ transaction });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /transactions/:id
 * Update a transaction (e.g. override category or add notes).
 */
router.patch(
  '/:id',
  [
    param('id').isMongoId().withMessage('Invalid transaction ID'),
    body('description').optional().trim().notEmpty(),
    body('amount').optional().isFloat(),
    body('date').optional().isISO8601(),
    body('notes').optional().isString(),
    body('category').optional().isObject(),
    body('category.primary').optional().isString(),
    body('category.secondary').optional().isString(),
    body('category.tertiary').optional().isString(),
    body('category.merchant').optional().isString(),
  ],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;
    try {
      const allowed = ['description', 'amount', 'date', 'notes', 'category'];
      const updates = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
      }
      // If category is manually set, mark it as not auto-categorized
      if (updates.category) updates.categorizedAutomatically = false;

      const transaction = await TransactionModel.findOneAndUpdate(
        { _id: req.params.id, user: req.user._id },
        { $set: updates },
        { new: true, runValidators: true }
      );
      if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
      res.json({ transaction });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /transactions/:id
 * Delete a transaction.
 */
router.delete(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid transaction ID')],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;
    try {
      const transaction = await TransactionModel.findOneAndDelete({ _id: req.params.id, user: req.user._id });
      if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
      res.json({ message: 'Transaction deleted' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /transactions/:id/recategorize
 * Re-run automatic categorization on an existing transaction.
 */
router.post(
  '/:id/recategorize',
  [param('id').isMongoId().withMessage('Invalid transaction ID')],
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;
    try {
      const existing = await TransactionModel.findOne({ _id: req.params.id, user: req.user._id });
      if (!existing) return res.status(404).json({ error: 'Transaction not found' });

      const category = categorize(existing.description, existing.type);
      existing.category = category;
      existing.categorizedAutomatically = true;
      await existing.save();
      res.json({ transaction: existing });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
