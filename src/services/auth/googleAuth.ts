/**
 * Real Google Sign-In using Google Identity Services (GIS).
 *
 * The OAuth Client ID is stored in localStorage under 'voxnote_gsi_client_id'
 * (pastable once from Google Cloud Console — the authorized origin must include
 * the site origin, e.g. https://ahmedelromy8.github.io).
 *
 * Decoding the GIS ID-token credential client-side is standard practice for
 * static single-page apps (profile claims only — no secrets involved).
 */

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
export const GSI_CLIENT_ID_KEY = 'voxnote_gsi_client_id';

export interface GoogleIdClaims {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
}

interface GoogleIdConfig {
  client_id: string;
  callback: (response: { credential?: string }) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  use_fedcm_for_prompt?: boolean;
}

interface GoogleNamespace {
  accounts: {
    id: {
      initialize: (config: GoogleIdConfig) => void;
      renderButton: (
        parent: HTMLElement,
        options: Record<string, unknown>
      ) => void;
      prompt: () => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleNamespace;
  }
}

export function getStoredGoogleClientId(): string {
  try {
    return localStorage.getItem(GSI_CLIENT_ID_KEY) || '';
  } catch {
    return '';
  }
}

export function storeGoogleClientId(clientId: string): void {
  localStorage.setItem(GSI_CLIENT_ID_KEY, clientId.trim());
}

/** Decodes the JWT payload of a GIS credential (no verification — client-side only). */
export function decodeGoogleCredential(credential: string): GoogleIdClaims | null {
  try {
    const parts = credential.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(payload)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json) as GoogleIdClaims;
  } catch {
    return null;
  }
}

let gisScriptPromise: Promise<GoogleNamespace> | null = null;

function loadGisScript(): Promise<GoogleNamespace> {
  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google);
  }
  if (gisScriptPromise) return gisScriptPromise;

  gisScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SCRIPT_SRC}"]`
    );
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.google?.accounts?.id) resolve(window.google);
      });
      return;
    }

    const script = document.createElement('script');
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.id) {
        resolve(window.google);
      } else {
        reject(new Error('GIS loaded but namespace missing'));
      }
    };
    script.onerror = () => {
      gisScriptPromise = null;
      reject(new Error('failed-to-load'));
    };
    document.head.appendChild(script);
  });

  return gisScriptPromise;
}

let isGisInitialized = false;

/**
 * Renders the official Google button inside `container` and invokes
 * `onSuccess` with the decoded profile after a successful sign-in.
 * Returns an error string the caller can show if setup is impossible.
 */
export async function renderGoogleSignInButton(
  container: HTMLElement,
  onSuccess: (profile: { id: string; name: string; email: string; avatar?: string }) => void,
  theme: 'outline' | 'filled_blue' = 'outline'
): Promise<string | null> {
  const clientId = getStoredGoogleClientId();
  if (!clientId) {
    return 'no-client-id';
  }

  try {
    const google = await loadGisScript();

    if (!isGisInitialized) {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (!response?.credential) return;
          const claims = decodeGoogleCredential(response.credential);
          if (!claims?.sub) return;
          onSuccess({
            id: `google-${claims.sub}`,
            name: claims.name || claims.email || 'Google User',
            email: claims.email || '',
            avatar: claims.picture,
          });
        },
        auto_select: false,
        cancel_on_tap_outside: true,
        use_fedcm_for_prompt: true,
      });
      isGisInitialized = true;
    }

    container.innerHTML = '';
    google.accounts.id.renderButton(container, {
      type: 'standard',
      theme,
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      logo_alignment: 'center',
      width: 280,
      locale: 'ar',
    });
    return null;
  } catch {
    return 'failed-to-load';
  }
}
