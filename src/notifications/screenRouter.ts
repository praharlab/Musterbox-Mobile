import type { NavigationMode } from '../auth/capabilities';

/**
 * Maps push `data.screen` values (handover §12.2) and inbox `activityTable` values
 * to app routes. Unknown values fall back to Home. Matching is case-insensitive.
 */
export interface RouteTarget {
  name: string;
  params?: Record<string, unknown>;
}

const APPROVAL_SCREENS: Record<string, string> = {
  leaveauth: 'leave',
  attendancecorrectionauth: 'regularization',
  expenserequest: 'expense',
  officeexpenserequest: 'expense',
};

export function routeForPushScreen(screen: string | undefined, mode: NavigationMode): RouteTarget {
  const s = (screen ?? '').toLowerCase();
  const home = { name: 'HomeTab' };
  if (!s || s === 'home') {
    return home;
  }
  if (s in APPROVAL_SCREENS) {
    return mode === 'manager' ? { name: 'ApprovalsTab', params: { module: APPROVAL_SCREENS[s] } } : home;
  }
  if (s === 'leave') {
    return mode === 'manager' ? { name: 'Leave' } : { name: 'LeaveTab' };
  }
  if (s === 'announcement') {
    return mode === 'manager'
      ? { name: 'Notifications', params: { segment: 'announcements' } }
      : { name: 'NotificationsTab', params: { segment: 'announcements' } };
  }
  if (s === 'task') {
    return mode === 'manager' ? { name: 'TasksTab' } : home;
  }
  if (s === 'trackingoutside') {
    return mode === 'manager' ? { name: 'TeamTab' } : home;
  }
  // chat, visit, tour, gatepass, expense, resignation, skills, ticket, preboarding: Phase 2 modules.
  return home;
}

export function routeForInboxActivity(activityTable: string | undefined, mode: NavigationMode): RouteTarget {
  const t = (activityTable ?? '').toLowerCase();
  if (t.includes('leaveauthorization')) {
    return routeForPushScreen('leaveauth', mode);
  }
  if (t.includes('attendancecorrection')) {
    return routeForPushScreen('attendanceCorrectionauth', mode);
  }
  if (t.includes('expense')) {
    return routeForPushScreen('expenserequest', mode);
  }
  return { name: 'HomeTab' };
}
