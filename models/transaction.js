const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TransactionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'user',
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    type: {
      type: String,
      enum: ['debit', 'credit'],
      required: true,
    },
    category: {
      primary: { type: String, default: 'Uncategorized' },
      secondary: { type: String, default: '' },
      tertiary: { type: String, default: '' },
      merchant: { type: String, default: '' },
    },
    categorizedAutomatically: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Index for efficient queries per user
TransactionSchema.index({ user: 1, date: -1 });
TransactionSchema.index({ user: 1, 'category.primary': 1 });

const TransactionModel = mongoose.model('transaction', TransactionSchema);

module.exports = TransactionModel;
