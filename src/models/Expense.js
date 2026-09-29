const mongoose = require('mongoose');
const { EXPENSE_STATUSES } = require('../utils/constants');

// Shared team contract: created here so the approval workflow has something to
// act on. The expense CRUD layer owns create/list/update/delete; keep the
// approval-related fields intact: status, rejectionReason, reviewedBy, reviewedAt.
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
    receiptDetails: {
      type: String,
      trim: true,
      maxlength: [1000, 'Receipt details must be at most 1000 characters'],
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

// Serialize without the internal mongoose version key — it is not part of the
// public API contract.
function stripInternalFields(_doc, ret) {
  delete ret.__v;
  return ret;
}

expenseSchema.set('toJSON', { virtuals: true, transform: stripInternalFields });
expenseSchema.set('toObject', { virtuals: true, transform: stripInternalFields });

const Expense = mongoose.model('Expense', expenseSchema);

module.exports = { Expense };
