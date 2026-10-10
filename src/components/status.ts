import type { Tone } from '../theme';

/** Request authorizationStatus -> label/tone (shared by leave, short leave, comp-off, gate pass). */
export function requestStatus(status: number | undefined | null): { label: string; tone: Tone } {
  switch (Number(status)) {
    case 0:
      return { label: 'No approver set', tone: 'warning' };
    case 1:
    case 2:
      return { label: 'Pending', tone: 'info' };
    case 3:
      return { label: 'Approved', tone: 'success' };
    case 4:
      return { label: 'Rejected', tone: 'danger' };
    case 5:
      return { label: 'Cancelled', tone: 'neutral' };
    default:
      return { label: 'Unknown', tone: 'neutral' };
  }
}

/** Calendar `title` -> tone. */
export function dayTone(title: string | undefined): Tone {
  const t = (title ?? '').toLowerCase();
  if (t.includes('present')) {
    return 'success';
  }
  if (t.includes('half')) {
    return 'warning';
  }
  if (t.includes('absent')) {
    return 'danger';
  }
  if (t.includes('leave')) {
    return 'info';
  }
  return 'neutral';
}
