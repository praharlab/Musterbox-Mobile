import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/** true while the device has (or may have) connectivity. Unknown reachability counts as online. */
export function useNetworkStatus(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(
    () =>
      NetInfo.addEventListener(state => {
        setOnline(state.isConnected !== false && state.isInternetReachable !== false);
      }),
    [],
  );
  return online;
}
