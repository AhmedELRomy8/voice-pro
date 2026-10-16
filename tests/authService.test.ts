import { describe, it, expect, beforeEach } from 'vitest';
import {
  getStoredUser,
  saveUser,
  clearUser,
  loginWithGoogle,
  loginWithEmail,
  loginAsGuest,
} from '../src/services/auth/authService';

describe('authService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no user is stored', () => {
    expect(getStoredUser()).toBeNull();
  });

  it('saves and retrieves user profile correctly', () => {
    saveUser({
      id: 'test-123',
      name: 'Ahmed',
      email: 'ahmed@test.com',
      provider: 'google',
    });

    const user = getStoredUser();
    expect(user).not.toBeNull();
    expect(user?.name).toBe('Ahmed');
    expect(user?.email).toBe('ahmed@test.com');
    expect(user?.provider).toBe('google');
  });

  it('clears stored user', () => {
    saveUser({
      id: 'test-123',
      name: 'Ahmed',
      email: 'ahmed@test.com',
      provider: 'google',
    });
    clearUser();
    expect(getStoredUser()).toBeNull();
  });

  it('logs in as guest', () => {
    const guest = loginAsGuest();
    expect(guest.provider).toBe('guest');
    expect(guest.name).toBe('Guest User');
    expect(getStoredUser()?.id).toBe(guest.id);
  });

  it('logs in with email', async () => {
    const user = await loginWithEmail('dev@voxnote.app');
    expect(user.provider).toBe('email');
    expect(user.email).toBe('dev@voxnote.app');
    expect(getStoredUser()?.email).toBe('dev@voxnote.app');
  });

  it('logs in with google', async () => {
    const user = await loginWithGoogle();
    expect(user.provider).toBe('google');
    expect(user.email).toContain('@');
    expect(getStoredUser()?.provider).toBe('google');
  });
});
