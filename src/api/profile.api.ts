import { api } from './index';
import { EP } from './endpoints';
import type { LegacyEnvelope } from './envelope';
import { requireIdentity } from '../auth/identity';
import type { ManagerRow, ProfileSummary } from '../types/api';

type Rows = LegacyEnvelope<Array<Record<string, unknown>>>;

/**
 * Profile reads. All take the signed-in user's own ID from the session.
 * Several list endpoints also return the full userMaster row (including the password hash);
 * screens must render only whitelisted fields (see features/profile/sections.ts).
 */
export const profileApi = {
  summary() {
    const { userMasterID } = requireIdentity();
    return api.get<LegacyEnvelope<ProfileSummary>>(EP.auth.profileMasked(userMasterID));
  },
  managers() {
    const { userMasterID } = requireIdentity();
    return api.get<LegacyEnvelope<ManagerRow[]>>(EP.profile.managers(userMasterID));
  },
  addresses() {
    return api.get<Rows>(EP.profile.addresses(requireIdentity().userMasterID));
  },
  family() {
    return api.get<Rows>(EP.profile.family(requireIdentity().userMasterID));
  },
  education() {
    return api.get<Rows>(EP.profile.education(requireIdentity().userMasterID));
  },
  experience() {
    return api.get<Rows>(EP.profile.experience(requireIdentity().userMasterID));
  },
  documents() {
    return api.get<Rows>(EP.profile.documents(requireIdentity().userMasterID));
  },
  letters() {
    const { userMasterID } = requireIdentity();
    return api.post<LegacyEnvelope<Array<{ label?: string; path?: string }>>>(EP.profile.letters, { userMasterID });
  },
};
