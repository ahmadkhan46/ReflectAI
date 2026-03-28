import type { LoginPayload, RegisterPayload, TokenResponse, UserProfile } from '@/types/auth';
import { apiRequest } from './client';

/** Register a new account. */
export async function register(payload: RegisterPayload): Promise<{ message: string }> {
  return apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Authenticate and receive access + refresh tokens. */
export async function login(payload: LoginPayload): Promise<TokenResponse> {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Invalidate session and clear cookies. */
export async function logout(): Promise<{ message: string }> {
  return apiRequest('/api/auth/logout', { method: 'POST' });
}

/** Fetch the authenticated user's profile. */
export async function getMe(): Promise<UserProfile> {
  return apiRequest('/api/auth/me');
}

/** Verify email address using the token from the verification email. */
export async function verifyEmail(token: string): Promise<{ message: string }> {
  return apiRequest(`/api/auth/verify-email/${encodeURIComponent(token)}`);
}
