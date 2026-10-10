import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiError } from '../src/api/errors';
import { LoginScreen } from '../src/features/auth/LoginScreen';

const mockSignIn = jest.fn();
jest.mock('../src/auth/AuthProvider', () => ({
  useAuth: () => ({ signIn: mockSignIn }),
}));

function renderLogin(notice?: string) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}>
      <LoginScreen onForgotPassword={jest.fn()} notice={notice} />
    </SafeAreaProvider>,
  );
}

beforeEach(() => mockSignIn.mockReset());

describe('LoginScreen', () => {
  it('submits the entered credentials and clears the password', async () => {
    mockSignIn.mockResolvedValue(undefined);
    await renderLogin();
    await fireEvent.changeText(screen.getByTestId('login-phone'), '9876500001');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'secret');
    await fireEvent.press(screen.getByTestId('login-submit'));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith('9876500001', 'secret'));
    await waitFor(() => expect(screen.getByTestId('login-password').props.value).toBe(''));
  });

  it("shows the server's error message", async () => {
    mockSignIn.mockRejectedValue(new ApiError('validation', 'Please enter valid loginid and password.'));
    await renderLogin();
    await fireEvent.changeText(screen.getByTestId('login-phone'), '9876500001');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'bad');
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText('Please enter valid loginid and password.')).toBeTruthy();
  });

  it('shows a network error clearly', async () => {
    mockSignIn.mockRejectedValue(new ApiError('network', ''));
    await renderLogin();
    await fireEvent.changeText(screen.getByTestId('login-phone'), '9876500001');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'x');
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText('No connection. Check your internet and try again.')).toBeTruthy();
  });

  it('shows the session-expired notice and hides forgot-password when the backend flow is unsafe', async () => {
    await renderLogin('Your session has expired. Please sign in again.');
    expect(screen.getByText('Your session has expired. Please sign in again.')).toBeTruthy();
    expect(screen.getByText(/contact your HR team/)).toBeTruthy();
  });

  it('does not submit twice on a double tap', async () => {
    let resolve: () => void = () => {};
    mockSignIn.mockImplementation(() => new Promise<void>(r => (resolve = r)));
    await renderLogin();
    await fireEvent.changeText(screen.getByTestId('login-phone'), '9876500001');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'x');
    const button = screen.getByTestId('login-submit');
    // The first press stays in flight (sign-in unresolved) while the second one lands.
    const presses = [fireEvent.press(button), fireEvent.press(button)];
    resolve();
    await Promise.all(presses);
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(1));
  });
});
