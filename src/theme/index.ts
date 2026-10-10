/**
 * Design tokens. Deliberately small: one brand colour, neutral surfaces, and semantic
 * status colours used consistently for attendance and request states.
 */
export const colors = {
  primary: '#1B4F9C',
  primaryDark: '#123A75',
  primarySoft: '#E8EFFA',
  background: '#F4F6FA',
  surface: '#FFFFFF',
  border: '#DDE3EC',
  text: '#16202E',
  textMuted: '#5B6778',
  textInverse: '#FFFFFF',
  success: '#1E7D4F',
  successSoft: '#E3F4EB',
  warning: '#A15C00',
  warningSoft: '#FFF2DD',
  danger: '#B42318',
  dangerSoft: '#FDECEA',
  info: '#1B4F9C',
  infoSoft: '#E8EFFA',
  neutralSoft: '#EEF1F5',
  inputFill: '#F7F9FC',
  disabledFill: '#C9D3E2',
  disabledText: '#F4F6FA',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 10, lg: 14, pill: 999 } as const;

export const font = {
  title: { fontSize: 22, fontWeight: '700' as const, color: colors.text },
  heading: { fontSize: 17, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  label: { fontSize: 13, fontWeight: '500' as const, color: colors.textMuted },
  caption: { fontSize: 12, color: colors.textMuted },
};

/** Minimum touch target (Android 48dp / iOS 44pt). */
export const TOUCH_MIN = 48;

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export function toneColors(tone: Tone): { fg: string; bg: string } {
  switch (tone) {
    case 'success':
      return { fg: colors.success, bg: colors.successSoft };
    case 'warning':
      return { fg: colors.warning, bg: colors.warningSoft };
    case 'danger':
      return { fg: colors.danger, bg: colors.dangerSoft };
    case 'info':
      return { fg: colors.info, bg: colors.infoSoft };
    default:
      return { fg: colors.textMuted, bg: colors.neutralSoft };
  }
}
