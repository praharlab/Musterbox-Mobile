import { ApiError } from '../api/errors';

/**
 * The signed-in user's identity, taken ONLY from the login response.
 *
 * Most backend endpoints read `userMasterID` / `companyMasterID` from the request
 * rather than the token (handover §4). API modules therefore inject these values
 * from here; screens never pass user or company IDs, and there is no UI to change them.
 */
export interface Identity {
  userMasterID: number;
  companyMasterID: number;
}

let current: Identity | null = null;

export function setIdentity(identity: Identity | null): void {
  current = identity ? Object.freeze({ ...identity }) : null;
}

export function getIdentity(): Identity | null {
  return current;
}

export function requireIdentity(): Identity {
  if (!current) {
    throw new ApiError('sessionExpired', 'You are not signed in.');
  }
  return current;
}
