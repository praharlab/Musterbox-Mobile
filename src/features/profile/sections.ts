import { profileApi } from '../../api/profile.api';
import { formatDate } from '../../utils/dates';
import { maskTail, pickString } from '../../utils/pick';

/**
 * Profile sub-sections. These endpoints return the full userMaster row alongside the
 * records (password hash included - handover H4), so each section renders ONLY the
 * whitelisted fields below. Field names come from the matching `add` request shapes.
 */
export type ProfileSectionKey = 'addresses' | 'family' | 'education' | 'experience' | 'documents';

type Row = Record<string, unknown>;

export interface SectionSpec {
  title: string;
  load: () => Promise<{ data: Row[] | Row | null | undefined }>;
  titleOf: (r: Row) => string;
  fields: Array<{ label: string; value: (r: Row) => string | undefined }>;
}

const str = (keys: string[]) => (r: Row) => pickString(r, keys);
const date = (keys: string[]) => (r: Row) => {
  const v = pickString(r, keys);
  return v ? formatDate(v) : undefined;
};
const verified = (r: Row) => {
  const v = pickString(r, ['verifyStatus']);
  return v === '1' ? 'Verified' : v === '0' ? 'Pending HR verification' : undefined;
};

export const PROFILE_SECTIONS: Record<ProfileSectionKey, SectionSpec> = {
  addresses: {
    title: 'Addresses',
    load: profileApi.addresses,
    titleOf: r => `${pickString(r, ['addressType']) ?? 'Address'}`.replace(/^\w/, c => c.toUpperCase()),
    fields: [
      {
        label: 'House',
        value: r => [pickString(r, ['houseNumber']), pickString(r, ['houseName'])].filter(Boolean).join(', '),
      },
      { label: 'Area', value: str(['area']) },
      { label: 'Landmark', value: str(['landmark']) },
      { label: 'PIN code', value: str(['zipcode']) },
      { label: 'Status', value: verified },
    ],
  },
  family: {
    title: 'Family',
    load: profileApi.family,
    titleOf: r => pickString(r, ['memberName']) ?? 'Family member',
    fields: [
      { label: 'Relation', value: str(['relation']) },
      { label: 'Date of birth', value: date(['dob']) },
      { label: 'Nominee', value: str(['nominee']) },
      { label: 'Nominee share %', value: str(['percentForNominee']) },
      { label: 'Status', value: verified },
    ],
  },
  education: {
    title: 'Education',
    load: profileApi.education,
    titleOf: r => pickString(r, ['qualification']) ?? 'Qualification',
    fields: [
      { label: 'Institute', value: str(['institute']) },
      { label: 'University', value: str(['university']) },
      { label: 'Year of passing', value: str(['yearOfPassing']) },
      { label: 'Grade / %', value: r => pickString(r, ['grade']) ?? pickString(r, ['percentageObtained']) },
      { label: 'Status', value: verified },
    ],
  },
  experience: {
    title: 'Experience',
    load: profileApi.experience,
    titleOf: r => pickString(r, ['organization']) ?? 'Employer',
    fields: [
      { label: 'Designation', value: str(['designation']) },
      { label: 'From', value: date(['fromDate']) },
      { label: 'To', value: date(['toDate']) },
      { label: 'Status', value: verified },
    ],
  },
  documents: {
    title: 'Documents',
    load: profileApi.documents,
    titleOf: r =>
      pickString(r, ['documentName']) ??
      pickString((r.documentList as Row | undefined) ?? {}, ['documentName', 'name']) ??
      'Document',
    fields: [
      { label: 'Number', value: r => maskTail(pickString(r, ['documentNumber'])) },
      { label: 'Name on document', value: str(['nameOnDocument']) },
      { label: 'Expiry', value: date(['expiryDate']) },
      { label: 'Status', value: verified },
    ],
  },
};

export function rowsOf(data: Row[] | Row | null | undefined): Row[] {
  if (Array.isArray(data)) {
    return data;
  }
  // Some getbyuserid endpoints wrap rows in the user object.
  if (data && typeof data === 'object') {
    const nested = Object.values(data).find(v => Array.isArray(v));
    return (nested as Row[] | undefined) ?? [];
  }
  return [];
}
