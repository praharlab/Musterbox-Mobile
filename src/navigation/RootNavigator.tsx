import React, { useEffect } from 'react';
import BootSplash from 'react-native-bootsplash';
import { StyleSheet, Text } from 'react-native';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useSession } from '../auth/AuthProvider';
import { tabsFor, NavigationMode } from '../auth/capabilities';
import { OfflineBanner } from '../components/OfflineBanner';
import { routeForPushScreen } from '../notifications/screenRouter';
import { push, screenOf } from '../notifications/push';
import { colors, spacing } from '../theme';
import type { RootStackParamList, TabParamList } from './types';

import { ChangePasswordScreen } from '../features/auth/ChangePasswordScreen';
import { ForgotPasswordScreen } from '../features/auth/ForgotPasswordScreen';
import {
  AccountInactiveScreen,
  BootstrapErrorScreen,
  ForceUpdateScreen,
  SplashScreen,
} from '../features/auth/GateScreens';
import { LoginScreen } from '../features/auth/LoginScreen';
import { HomeScreen } from '../features/home/HomeScreen';
import { AttendanceScreen } from '../features/attendance/AttendanceScreen';
import { CalendarScreen } from '../features/attendance/CalendarScreen';
import { DayDetailScreen } from '../features/attendance/DayDetailScreen';
import { RegularizationFormScreen, RegularizationListScreen } from '../features/attendance/RegularizationScreens';
import { LeaveScreen } from '../features/leave/LeaveScreen';
import { ApplyLeaveScreen } from '../features/leave/ApplyLeaveScreen';
import { LeaveDetailScreen } from '../features/leave/LeaveDetailScreen';
import { PayslipScreen } from '../features/payslip/PayslipScreen';
import { NotificationsScreen } from '../features/notifications/NotificationsScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { ProfileSectionScreen } from '../features/profile/ProfileSectionScreen';
import { TeamScreen } from '../features/team/TeamScreen';
import { ApprovalsScreen } from '../features/approvals/ApprovalsScreen';
import { ApprovalDetailScreen } from '../features/approvals/ApprovalDetailScreen';
import { TasksScreen } from '../features/tasks/TasksScreen';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const AuthStack = createNativeStackNavigator<{ Login: undefined; ForgotPassword: undefined }>();
const PasswordStack = createNativeStackNavigator<{ SetPassword: undefined }>();

/** One header look for every stack screen. */
const stackScreenOptions: NativeStackNavigationOptions = {
  headerBackTitle: 'Back',
  headerTitleAlign: 'center',
  headerTintColor: colors.primary,
  headerStyle: { backgroundColor: colors.surface },
  headerTitleStyle: { fontSize: 18, fontWeight: '700', color: colors.text },
  headerShadowVisible: true,
  contentStyle: { backgroundColor: colors.background },
};

const TAB_COMPONENTS: Record<keyof TabParamList, React.ComponentType<any>> = {
  HomeTab: HomeScreen,
  AttendanceTab: AttendanceScreen,
  LeaveTab: LeaveScreen,
  PayslipTab: PayslipScreen,
  NotificationsTab: NotificationsScreen,
  ProfileTab: ProfileScreen,
  TeamTab: TeamScreen,
  ApprovalsTab: ApprovalsScreen,
  TasksTab: TasksScreen,
};

const TAB_GLYPH: Record<keyof TabParamList, string> = {
  HomeTab: '⌂',
  AttendanceTab: '◷',
  LeaveTab: '☼',
  PayslipTab: '₹',
  NotificationsTab: '✉',
  ProfileTab: '☺',
  TeamTab: '☷',
  ApprovalsTab: '✓',
  TasksTab: '☰',
};

function TabIcon({ name, color }: { name: keyof TabParamList; color: string }) {
  return (
    <Text style={[styles.tabIcon, { color }]} accessibilityElementsHidden>
      {TAB_GLYPH[name]}
    </Text>
  );
}

const tabIcon =
  (name: keyof TabParamList) =>
  ({ color }: { color: string }) =>
    <TabIcon name={name} color={color} />;

function Tabs() {
  const { capabilities } = useSession();
  const insets = useSafeAreaInsets();
  const tabs = tabsFor(capabilities);
  // Keep the bar clear of the iOS home indicator / Android gesture or button bar.
  const bottomPad = Math.max(insets.bottom, spacing.sm);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: tabIcon(route.name),
        tabBarStyle: {
          height: 60 + bottomPad,
          paddingTop: spacing.sm,
          paddingBottom: bottomPad,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarItemStyle: { paddingVertical: 2 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600', marginTop: 2 },
        headerStyle: { backgroundColor: colors.surface },
        headerTitleAlign: 'center',
        headerTitleStyle: { fontSize: 18, fontWeight: '700', color: colors.text },
        headerTitleContainerStyle: { paddingHorizontal: spacing.sm },
        headerShadowVisible: true,
        sceneStyle: { backgroundColor: colors.background },
      })}>
      {tabs.map(t => (
        <Tab.Screen
          key={t.name}
          name={t.name as keyof TabParamList}
          component={TAB_COMPONENTS[t.name as keyof TabParamList]}
          options={{ title: t.label, tabBarTestID: `tab-${t.name}` } as object}
        />
      ))}
    </Tab.Navigator>
  );
}

function useChangePasswordDone() {
  return () => navigationRef.isReady() && navigationRef.goBack();
}

function SignedInStack() {
  const { capabilities } = useSession();
  const onChanged = useChangePasswordDone();
  const ChangePassword = React.useCallback(
    () => <ChangePasswordScreen mode="change" onDone={onChanged} />,
    [onChanged],
  );
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="AttendanceCalendar" component={CalendarScreen} options={{ title: 'Attendance history' }} />
      <Stack.Screen name="DayDetail" component={DayDetailScreen} options={{ title: 'Day details' }} />
      <Stack.Screen name="Regularizations" component={RegularizationListScreen} options={{ title: 'Regularization' }} />
      {capabilities.regularizationSubmit ? (
        <Stack.Screen
          name="RegularizationForm"
          component={RegularizationFormScreen}
          options={{ title: 'Request correction' }}
        />
      ) : null}
      {capabilities.leave ? (
        <>
          <Stack.Screen name="ApplyLeave" component={ApplyLeaveScreen} options={{ title: 'Apply for leave' }} />
          <Stack.Screen name="LeaveDetail" component={LeaveDetailScreen} options={{ title: 'Leave request' }} />
          <Stack.Screen name="Leave" component={LeaveScreen} options={{ title: 'Leave' }} />
        </>
      ) : null}
      <Stack.Screen name="Payslip" component={PayslipScreen} options={{ title: 'Payslips' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      {capabilities.approvals ? (
        <Stack.Screen name="ApprovalDetail" component={ApprovalDetailScreen} options={{ title: 'Review request' }} />
      ) : null}
      <Stack.Screen name="ChangePassword" component={ChangePassword} options={{ title: 'Change password' }} />
      <Stack.Screen name="ProfileSection" component={ProfileSectionScreen} options={{ title: 'Profile' }} />
    </Stack.Navigator>
  );
}

function navigateForPush(screen: string | undefined, mode: NavigationMode) {
  if (!navigationRef.isReady()) {
    return;
  }
  const target = routeForPushScreen(screen, mode);
  if (target.name.endsWith('Tab')) {
    navigationRef.navigate('Tabs', { screen: target.name as keyof TabParamList, params: target.params });
  } else {
    (navigationRef.navigate as (n: string, p?: object) => void)(target.name, target.params);
  }
}

/** Routes notification taps (background and cold start) once the user is signed in. */
function PushRouting() {
  const { capabilities } = useSession();
  useEffect(() => {
    push.requestPermission().catch(() => undefined);
    push.initialNotification().then(msg => msg && navigateForPush(screenOf(msg), capabilities.mode));
    return push.onNotificationOpened(msg => navigateForPush(screenOf(msg), capabilities.mode));
  }, [capabilities.mode]);
  return null;
}

function AuthFlow({ notice }: { notice?: string }) {
  return (
    <AuthStack.Navigator screenOptions={stackScreenOptions}>
      <AuthStack.Screen name="Login" options={{ headerShown: false }}>
        {({ navigation }) => (
          <LoginScreen notice={notice} onForgotPassword={() => navigation.navigate('ForgotPassword')} />
        )}
      </AuthStack.Screen>
      <AuthStack.Screen name="ForgotPassword" options={{ title: 'Reset password' }}>
        {({ navigation }) => <ForgotPasswordScreen onDone={() => navigation.popToTop()} />}
      </AuthStack.Screen>
    </AuthStack.Navigator>
  );
}

export function RootNavigator() {
  const { status, passwordChanged, retryBootstrap, signOut } = useAuth();

  // The native splash stays up while the stored session is read; after that the
  // JS SplashScreen (same look) covers bootstrapping.
  const booting = status.kind === 'loading';
  useEffect(() => {
    if (!booting) {
      BootSplash.hide({ fade: true }).catch(() => undefined);
    }
  }, [booting]);

  let content: React.ReactNode;
  switch (status.kind) {
    case 'loading':
    case 'bootstrapping':
      content = <SplashScreen />;
      break;
    case 'signedOut':
      content = <AuthFlow notice={status.notice} />;
      break;
    case 'mustChangePassword':
      content = (
        <PasswordStack.Navigator screenOptions={stackScreenOptions}>
          <PasswordStack.Screen name="SetPassword" options={{ title: 'Set a new password' }}>
            {() => <ChangePasswordScreen mode="initial" onDone={() => passwordChanged()} />}
          </PasswordStack.Screen>
        </PasswordStack.Navigator>
      );
      break;
    case 'forceUpdate':
      content = <ForceUpdateScreen message={status.message} />;
      break;
    case 'accountInactive':
      content = <AccountInactiveScreen message={status.message} onBack={() => signOut()} />;
      break;
    case 'bootstrapError':
      content = (
        <BootstrapErrorScreen message={status.message} onRetry={() => retryBootstrap()} onSignOut={() => signOut()} />
      );
      break;
    case 'signedIn':
      content = (
        <>
          <PushRouting />
          <SignedInStack />
        </>
      );
      break;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <OfflineBanner />
      {content}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabIcon: { fontSize: 22, lineHeight: 26 },
});
