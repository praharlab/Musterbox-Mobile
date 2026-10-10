import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ApprovalItem, ApprovalModule } from '../api/approvals';
import type { NavigationMode } from '../auth/capabilities';
import type { LeaveApplication } from '../types/api';
import type { ProfileSectionKey } from '../features/profile/sections';

export type TabParamList = {
  HomeTab: undefined;
  AttendanceTab: undefined;
  LeaveTab: undefined;
  PayslipTab: undefined;
  NotificationsTab: { segment?: 'inbox' | 'announcements' } | undefined;
  ProfileTab: undefined;
  TeamTab: undefined;
  ApprovalsTab: { module?: ApprovalModule } | undefined;
  TasksTab: undefined;
};

export type RootStackParamList = {
  Tabs: { screen?: keyof TabParamList; params?: object } | undefined;
  AttendanceCalendar: undefined;
  DayDetail: { date: string };
  Regularizations: undefined;
  RegularizationForm: { date?: string } | undefined;
  ApplyLeave: undefined;
  LeaveDetail: { leave: LeaveApplication };
  /** Stack versions of employee tabs, used from the manager navigation. */
  Leave: undefined;
  Payslip: undefined;
  Notifications: { segment?: 'inbox' | 'announcements' } | undefined;
  ApprovalDetail: { item: ApprovalItem };
  ChangePassword: undefined;
  ProfileSection: { section: ProfileSectionKey };
};

export type AppNavigation = NativeStackNavigationProp<RootStackParamList>;

export function useAppNavigation(): AppNavigation {
  return useNavigation<AppNavigation>();
}

export type Feature = 'leave' | 'payslip' | 'notifications' | 'attendance';

/**
 * Opens a feature regardless of the navigation mode: employees have it as a tab,
 * managers reach Leave/Payslip/Notifications as stacked screens.
 */
export function openFeature(nav: AppNavigation, mode: NavigationMode, feature: Feature): void {
  if (feature === 'attendance') {
    nav.navigate('Tabs', { screen: 'AttendanceTab' });
    return;
  }
  if (mode === 'employee') {
    const tab = { leave: 'LeaveTab', payslip: 'PayslipTab', notifications: 'NotificationsTab' }[
      feature
    ] as keyof TabParamList;
    nav.navigate('Tabs', { screen: tab });
    return;
  }
  const screen = { leave: 'Leave', payslip: 'Payslip', notifications: 'Notifications' }[feature] as
    | 'Leave'
    | 'Payslip'
    | 'Notifications';
  nav.navigate(screen);
}
