const mongoose = require('mongoose');
const { EXPENSE_STATUSES } = require('../utils/constants');

// Shared team contract: created here so the approval workflow has something to
// act on. The expense CRUD teammate owns the endpoints and may extend this
// schema (e.g. extra fields), but keep the approval-related fields intact:
// status, rejectionReason, reviewedBy, reviewedAt.
const expenseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [120, 'Title must be at most 120 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description must be at most 500 characters'],
      default: '',
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },
    category: {
      type: String,
      trim: true,
      maxlength: [60, 'Category must be at most 60 characters'],
      default: '',
    },
    expenseDate: {
      type: Date,
      required: [true, 'Expense date is required'],
    },
    status: {
      type: String,
      enum: {
        values: EXPENSE_STATUSES,
        message: 'Status must be one of: pending, approved, rejected',
      },
      default: 'pending',
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Rejection reason must be at most 500 characters'],
      default: null,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'submittedBy is required'],
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

expenseSchema.set('toJSON', { virtuals: true });
expenseSchema.set('toObject', { virtuals: true });

const Expense = mongoose.model('Expense', expenseSchema);

module.exports = { Expense };
