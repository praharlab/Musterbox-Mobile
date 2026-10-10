import { api } from './index';
import { EP } from './endpoints';
import type { LegacyEnvelope } from './envelope';
import { requireIdentity } from '../auth/identity';
import type { GeneratorPayslip, MainPayslip } from '../types/api';

/**
 * Two payslip systems exist (handover §5.E):
 *  - PaySlip Generator: token-scoped list; PDF at a public path (downloaded with the token header).
 *  - Main payroll: no month list (GAP P0-6); PDF returned as base64 per month.
 */
export const payslipApi = {
  generatorList() {
    return api.get<LegacyEnvelope<GeneratorPayslip[]>>(EP.payslip.generatorList);
  },

  /** `status` is never sent: status "01" bypasses the publish flag. The request guard also strips it. */
  mainPayslip(month: string) {
    const { userMasterID } = requireIdentity();
    return api.post<LegacyEnvelope<MainPayslip | null>>(EP.payslip.mainPdf, { userMasterID, yyyymm: month });
  },
};
