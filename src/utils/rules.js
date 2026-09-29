// Small, reusable validation rules.
//
// A rule is a function: (value, allValues) => errorMessage | undefined
// Rules are combined per field inside validateBody()/validateParams():
//   { email: [required(), email()] }
//
// Add new rules here instead of re-writing field checks in controllers.

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const MONGO_ID_REGEX = /^[0-9a-fA-F]{24}$/;

function isEmpty(value) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '')
  );
}

function required() {
  return (value) => (isEmpty(value) ? 'is required' : undefined);
}

function string({ trim = true } = {}) {
  return (value) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') return 'must be a string';
    if (trim && value.trim() === '') return 'is required';
    return undefined;
  };
}

function email() {
  return (value) => {
    if (isEmpty(value)) return undefined;
    if (typeof value !== 'string' || !EMAIL_REGEX.test(value.trim())) {
      return 'must be a valid email address';
    }
    return undefined;
  };
}

function minLength(n) {
  return (value) => {
    if (isEmpty(value)) return undefined;
    if (typeof value !== 'string') return 'must be a string';
    if (value.length < n) return `must be at least ${n} characters`;
    return undefined;
  };
}

function maxLength(n) {
  return (value) => {
    if (isEmpty(value)) return undefined;
    if (typeof value !== 'string') return 'must be a string';
    if (value.length > n) return `must be at most ${n} characters`;
    return undefined;
  };
}

function number() {
  return (value) => {
    if (isEmpty(value)) return undefined;
    const n = typeof value === 'string' ? Number(value) : value;
    if (typeof n !== 'number' || Number.isNaN(n)) return 'must be a number';
    return undefined;
  };
}

function greaterThan(min) {
  return (value) => {
    if (isEmpty(value)) return undefined;
    const n = typeof value === 'string' ? Number(value) : value;
    if (typeof n !== 'number' || Number.isNaN(n)) return 'must be a number';
    if (n <= min) return `must be greater than ${min}`;
    return undefined;
  };
}

function oneOf(list) {
  return (value) => {
    if (isEmpty(value)) return undefined;
    if (!list.includes(value)) return `must be one of: ${list.join(', ')}`;
    return undefined;
  };
}

function mongoId() {
  return (value) => {
    if (isEmpty(value)) return undefined;
    if (typeof value !== 'string' || !MONGO_ID_REGEX.test(value)) {
      return 'must be a valid id';
    }
    return undefined;
  };
}

function date() {
  return (value) => {
    if (isEmpty(value)) return undefined;
    const isSupportedType =
      typeof value === 'string' || typeof value === 'number' || value instanceof Date;
    if (!isSupportedType) return 'must be a valid date';
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 'must be a valid date' : undefined;
  };
}

// Skips the wrapped rules when the value is missing, so the field stays optional.
function optional(...rules) {
  return (value, allValues) => {
    if (isEmpty(value)) return undefined;
    for (const rule of rules) {
      const message = rule(value, allValues);
      if (message) return message;
    }
    return undefined;
  };
}

// Cross-field range check: this date must not be after `otherField`.
// Used for ?fromDate= / ?toDate=. Both fields are validated individually too.
function notAfter(otherField) {
  return (value, allValues) => {
    if (isEmpty(value) || isEmpty(allValues[otherField])) return undefined;
    const from = new Date(value).getTime();
    const to = new Date(allValues[otherField]).getTime();
    if (Number.isNaN(from) || Number.isNaN(to)) return undefined;
    return from > to ? `must not be after ${otherField}` : undefined;
  };
}

module.exports = {
  EMAIL_REGEX,
  MONGO_ID_REGEX,
  isEmpty,
  required,
  string,
  email,
  minLength,
  maxLength,
  number,
  greaterThan,
  oneOf,
  mongoId,
  date,
  optional,
  notAfter,
};
