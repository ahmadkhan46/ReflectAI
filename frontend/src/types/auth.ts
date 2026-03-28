/** Authenticated user profile returned by GET /api/auth/me */
export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_verified: boolean;
  is_admin: boolean;
  age_verified: boolean;
  consent_given: boolean;
  consent_date: string | null;
  created_at: string;
}

/** Token response from POST /api/auth/login */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/** Registration request payload */
export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  age_verified: boolean;
  consent_given: boolean;
}

/** Login request payload */
export interface LoginPayload {
  email: string;
  password: string;
}
