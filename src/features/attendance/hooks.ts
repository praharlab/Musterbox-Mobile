import { Alert } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { attendanceApi } from '../../api/attendance.api';
import { useSession } from '../../auth/AuthProvider';
import { qk } from '../../hooks/queries';
import { useSubmitGuard } from '../../hooks/useSubmitGuard';
import { todayIso } from '../../utils/dates';
import { ACTION_LABEL, derivePunchState, nextAction, performPunch, PunchOutcome } from './punch';

export function useTodayStatus() {
  return useQuery({ queryKey: qk('attendance', 'today'), queryFn: () => attendanceApi.todayStatus() });
}

/** Today's row from the month calendar: shift and worked hours. */
export function useTodayCalendar() {
  const today = todayIso();
  return useQuery({
    queryKey: qk('attendance', 'calendar', today, today),
    queryFn: async () => (await attendanceApi.calendar(today, today)).data?.[0] ?? null,
  });
}

function confirmAsync(title: string, message: string, confirmLabel: string): Promise<boolean> {
  return new Promise(resolve =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, onPress: () => resolve(true) },
    ]),
  );
}

export function usePunch() {
  const { capabilities } = useSession();
  const status = useTodayStatus();
  const queryClient = useQueryClient();
  const { run, busy } = useSubmitGuard();

  const state = derivePunchState(status.data);
  const action = capabilities.canPunchFromMobile ? nextAction(state) : null;

  const punch = () =>
    run(async () => {
      if (!action) {
        return;
      }
      if (action === 'checkOut') {
        const ok = await confirmAsync('Check out?', 'Your check-out time will be recorded now.', 'Check out');
        if (!ok) {
          return;
        }
      }
      const outcome: PunchOutcome = await performPunch(action, capabilities, status.data);
      await queryClient.invalidateQueries({ queryKey: qk('attendance') });
      if (outcome.result === 'accepted') {
        Alert.alert(`${ACTION_LABEL[action]} successful`, outcome.message);
      } else if (outcome.result === 'rejected') {
        Alert.alert(`${ACTION_LABEL[action]} not recorded`, outcome.message);
      } else if (outcome.result === 'unconfirmed') {
        Alert.alert('Status unknown', outcome.message);
      }
    });

  return { status, state, action, punch, busy };
}
