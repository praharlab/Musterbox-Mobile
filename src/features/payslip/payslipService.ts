import { payslipApi } from '../../api/payslip.api';
import { ApiError } from '../../api/errors';
import { currentToken } from '../../auth/sessionService';
import { env } from '../../config/env';
import { secureFiles } from '../../storage/secureFiles';
import type { GeneratorPayslip, MainPayslip } from '../../types/api';

/** Only relative paths inside uploads/PaySlips are accepted - never an arbitrary URL from a row. */
export function generatorPdfUrl(slip: GeneratorPayslip): string {
  const path = String(slip.path ?? '').replace(/^\/+/, '');
  if (!/^uploads\/PaySlips\/[\w\-./]+\.pdf$/i.test(path) || path.includes('..')) {
    throw new ApiError('clientGuard', 'This payslip file is not available.');
  }
  return `${env.fileBaseUrl}${path}`;
}

export async function openGeneratorPayslip(slip: GeneratorPayslip): Promise<void> {
  const local = await secureFiles.download(generatorPdfUrl(slip), currentToken(), 'pdf');
  await secureFiles.open(local);
}

export type MainPayslipResult = { issued: false } | { issued: true; slip: MainPayslip };

/** Fetches a main-payroll payslip; unissued months come back with empty data. */
export async function fetchMainPayslip(month: string): Promise<MainPayslipResult> {
  const body = await payslipApi.mainPayslip(month);
  const slip = body.data;
  if (!slip || !slip.path || Number(slip.salarySlipIssue) !== 1) {
    return { issued: false };
  }
  return { issued: true, slip };
}

export async function openMainPayslip(slip: MainPayslip): Promise<void> {
  const local = await secureFiles.writeBase64Pdf(slip.path as string);
  await secureFiles.open(local);
}
