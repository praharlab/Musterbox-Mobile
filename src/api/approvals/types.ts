import type { Page } from '../pagination';

export type ApprovalModule = 'leave' | 'regularization' | 'overtime' | 'expense';

export interface ApprovalItem {
  /** Stable key for lists. */
  key: string;
  module: ApprovalModule;
  requesterName: string;
  title: string;
  subtitle?: string;
  createdAt?: string;
  /** Extra label/value rows for the detail screen (whitelisted fields only). */
  details: Array<{ label: string; value: string }>;
  /** False when the list row lacks the IDs needed to decide; reason is shown to the user. */
  decidable: boolean;
  notDecidableReason?: string;
  /** Module-specific identifiers used by `decide`. */
  ids: Record<string, number | undefined>;
}

export interface ApprovalAdapter {
  module: ApprovalModule;
  label: string;
  list(page: number): Promise<Page<ApprovalItem>>;
  /** approve=true -> authstatus 1, false -> 0. Reject requires remarks (UI enforces). */
  decide(item: ApprovalItem, approve: boolean, remarks: string): Promise<void>;
}
