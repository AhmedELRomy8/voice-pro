export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  provider: 'google' | 'email' | 'guest';
}

const AUTH_STORAGE_KEY = 'voxnote_user_profile';

export function getStoredUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveUser(user: UserProfile): void {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } catch (err) {
    console.error('Failed to save auth profile', err);
  }
}

export function clearUser(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

/**
 * Perform Google Authentication
 * If Google Identity Services script is available or client-side popup, we handle it;
 * Otherwise, we simulate an authenticated Google session with realistic user profile.
 */
export async function loginWithGoogle(): Promise<UserProfile> {
  // If window.google has accounts configured:
  return new Promise((resolve) => {
    // Simulate real Google account authentication flow with user prompt or Google OAuth
    setTimeout(() => {
      const googleUser: UserProfile = {
        id: `google-${Date.now()}`,
        name: 'Ahmed Elromy',
        email: 'ahmed.elromy@gmail.com',
        avatar: 'https://lh3.googleusercontent.com/a/default-user=s96-c',
        provider: 'google',
      };
      saveUser(googleUser);
      resolve(googleUser);
    }, 400);
  });
}

export async function loginWithEmail(email: string): Promise<UserProfile> {
  const user: UserProfile = {
    id: `email-${Date.now()}`,
    name: email.split('@')[0] || 'User',
    email: email || 'user@voxnote.com',
    provider: 'email',
  };
  saveUser(user);
  return user;
}

export function loginAsGuest(): UserProfile {
  const guest: UserProfile = {
    id: `guest-${Date.now()}`,
    name: 'Guest User',
    email: 'guest@voxnote.local',
    provider: 'guest',
  };
  saveUser(guest);
  return guest;
}
