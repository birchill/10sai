import { Progress } from '../model';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// We add a small exponential factor when calculating the overdue score of
// cards. This is to prevent high-level but very overdue cards from being
// starved by low-level overdue cards.
//
// The value below is chosen so that a card of level 365 that is half a year
// overdue will have a very slightly higher overdueness than a level 1 card that
// is one day overdue.
const EXP_FACTOR = 0.00225;

export function getOverdueness(progress: Progress, reviewTimeAsNumber: number) {
  if (progress.due === null) {
    return Infinity;
  }

  const daysOverdue =
    (reviewTimeAsNumber - progress.due.getTime()) / MS_PER_DAY;
  const linearComponent = daysOverdue / progress.level;
  const expComponent = Math.exp(EXP_FACTOR * daysOverdue) - 1;

  return linearComponent + expComponent;
}
