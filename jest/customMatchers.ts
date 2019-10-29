declare namespace jest {
  interface CustomMatcherResult {
    pass: boolean;
    message: string | (() => string);
  }
  interface Matchers<R, T> {
    toBeInDateRange: (beginDate: Date, endDate: Date) => CustomMatcherResult;
    toBeInRange: (floor: number, ceiling: number) => CustomMatcherResult;
  }
}

function toBeInDateRange(
  this: jest.MatcherUtils,
  received: Date,
  beginDate: Date,
  endDate: Date
) {
  const ensureIsDate = (actual: any, label: any) => {
    if (!(actual instanceof Date)) {
      throw new Error(
        this.utils.matcherHint('[.not].toBeInDateRange', undefined, '') +
          '\n\n' +
          `${label} value must be a Date.\n` +
          this.utils.printWithType(label, actual, this.utils.printReceived)
      );
    }
  };

  ensureIsDate(received, 'Received');
  ensureIsDate(beginDate, 'Begin date');
  ensureIsDate(endDate, 'End date');

  const pass = received >= beginDate && received <= endDate;

  const message = pass
    ? () =>
        this.utils.matcherHint('.not.toBeInDateRange') +
        '\n\n' +
        'Expected value to be outside range:\n' +
        `  ${this.utils.printExpected(beginDate)} ≤` +
        ` (date) ≤ ${this.utils.printExpected(endDate)}\n` +
        'Received:\n' +
        `  ${this.utils.printReceived(received)}`
    : () =>
        this.utils.matcherHint('.toBeInDateRange') +
        '\n\n' +
        'Expected value to be in range:\n' +
        `    ${this.utils.printExpected(beginDate)}\n` +
        `  ≤ ${this.utils.printReceived(received)}\n` +
        `  ≤ ${this.utils.printExpected(endDate)}`;

  return { actual: received, message, pass };
}

// Straight from the jest docs:
// https://jestjs.io/docs/en/expect#expectextendmatchers
function toBeInRange(
  this: jest.MatcherUtils,
  received: number,
  floor: number,
  ceiling: number
) {
  const pass = received >= floor && received <= ceiling;
  if (pass) {
    return {
      actual: received,
      message: () =>
        `expected ${received} not to be within range ${floor} - ${ceiling}`,
      pass: true,
    };
  } else {
    return {
      actual: received,
      message: () =>
        `expected ${received} to be within range ${floor} - ${ceiling}`,
      pass: false,
    };
  }
}

expect.extend({ toBeInDateRange, toBeInRange });
