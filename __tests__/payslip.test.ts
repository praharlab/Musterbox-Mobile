import ReactNativeBlobUtil from 'react-native-blob-util';
import { fetchMainPayslip, generatorPdfUrl, openMainPayslip } from '../src/features/payslip/payslipService';
import { secureFiles } from '../src/storage/secureFiles';
import { setupApi } from './support/helpers';

const fs = ReactNativeBlobUtil.fs as unknown as typeof ReactNativeBlobUtil.fs & { __files: Map<string, unknown> };

beforeEach(() => {
  fs.__files.clear();
  jest.clearAllMocks();
});

describe('payslip download', () => {
  it('requests the month without `status` and returns the issued slip', async () => {
    const { mock } = setupApi();
    mock.onPost('salaryTrans/v1/getUserWiseSalarySlip').reply(200, {
      status: 200,
      data: { userMasterID: 345, salaryYYYYMM: '202608', salarySlipIssue: 1, paid: true, path: 'JVBERi0xLjQ=' },
    });
    const r = await fetchMainPayslip('202608');
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ userMasterID: 345, yyyymm: '202608' });
    expect(r.issued).toBe(true);
  });

  it('treats an unissued month as unavailable', async () => {
    const { mock } = setupApi();
    mock.onPost('salaryTrans/v1/getUserWiseSalarySlip').reply(200, { status: 200, data: null });
    expect(await fetchMainPayslip('202607')).toEqual({ issued: false });
  });

  it('writes the base64 PDF to the private cache with a random name and opens it', async () => {
    await openMainPayslip({ userMasterID: 345, salaryYYYYMM: '202608', salarySlipIssue: 1, path: 'JVBERi0xLjQ=' });
    const [path] = [...fs.__files.keys()];
    expect(path).toMatch(/^\/cache\/secure-docs\/doc-[a-z0-9]+\.pdf$/);
    expect(path).not.toContain('345');
    expect(path).not.toContain('202608');
    expect(fs.writeFile).toHaveBeenCalledWith(path, 'JVBERi0xLjQ=', 'base64');
  });

  it('downloads generator payslips with the auth header', async () => {
    await secureFiles.download('https://api.test/uploads/PaySlips/12/1-345.pdf', 'tok');
    const fetch = (ReactNativeBlobUtil.config as jest.Mock).mock.results[0].value.fetch as jest.Mock;
    expect(fetch).toHaveBeenCalledWith('GET', 'https://api.test/uploads/PaySlips/12/1-345.pdf', {
      Authorization: 'Bearer tok',
    });
  });

  it('only accepts payslip paths inside uploads/PaySlips', () => {
    expect(generatorPdfUrl({ yearMonth: '202608', path: 'uploads/PaySlips/12/1-345.pdf' })).toBe(
      'https://api.test/uploads/PaySlips/12/1-345.pdf',
    );
    expect(() => generatorPdfUrl({ yearMonth: '1', path: 'https://evil.example/x.pdf' })).toThrow();
    expect(() => generatorPdfUrl({ yearMonth: '1', path: 'uploads/PaySlips/../../etc/passwd.pdf' })).toThrow();
  });
});

describe('sensitive file retention', () => {
  it('purges files older than the retention window', async () => {
    fs.__files.set('/cache/secure-docs/old.pdf', { lastModified: Date.now() - 60 * 60 * 1000 });
    fs.__files.set('/cache/secure-docs/new.pdf', { lastModified: Date.now() });
    await secureFiles.purgeStale();
    expect([...fs.__files.keys()]).toEqual(['/cache/secure-docs/new.pdf']);
  });

  it('purgeAll removes the whole directory', async () => {
    fs.__files.set('/cache/secure-docs/a.pdf', { lastModified: Date.now() });
    await secureFiles.purgeAll();
    expect(fs.__files.size).toBe(0);
  });
});
