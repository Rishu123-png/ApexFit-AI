'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
  type User,
} from 'firebase/auth';
import { getFirebase, isFirebaseConfigured } from '@/lib/firebase/client';
import { createProfile } from '@/lib/db';

interface AuthContextValue {
  user: User | null;
  /** true until the first onAuthStateChanged callback fires */
  loading: boolean;
  configured: boolean;
  /** Get a fresh ID token for server-side verification in API routes. */
  getIdToken: () => Promise<string>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Map Firebase error codes to clear, user-facing messages. */
export function authErrorMessage(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password. Please check your details and try again.';
    case 'auth/invalid-email':
      return 'That email address doesn’t look valid.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email. Try signing in instead.';
    case 'auth/weak-password':
      return 'Password is too weak — use at least 8 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/popup-closed-by-user':
      return 'The Google sign-in popup was closed before completing.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in isn’t enabled for this app yet.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isFirebaseConfigured();

  useEffect(() => {
    const fb = getFirebase();
    if (!fb) {
      setLoading(false);
      return;
    }
    // Session persistence: user stays signed in across browser restarts.
    setPersistence(fb.auth, browserLocalPersistence).catch(() => undefined);
    const unsub = onAuthStateChanged(fb.auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const requireAuth = useCallback(() => {
    const fb = getFirebase();
    if (!fb) throw new Error('Firebase is not configured.');
    return fb.auth;
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      await signInWithEmailAndPassword(requireAuth(), email, password);
    },
    [requireAuth],
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      const auth = requireAuth();
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      // Only create the database profile after Firebase confirms the account.
      await createProfile(cred.user.uid, {
        displayName: name,
        email,
        goal: 'general-fitness',
        experience: 'beginner',
      });
    },
    [requireAuth],
  );

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(requireAuth(), new GoogleAuthProvider());
  }, [requireAuth]);

  const resetPassword = useCallback(
    async (email: string) => {
      await sendPasswordResetEmail(requireAuth(), email);
    },
    [requireAuth],
  );

  const logout = useCallback(async () => {
    await signOut(requireAuth());
  }, [requireAuth]);

  const getIdToken = useCallback(async () => {
    if (!user) throw new Error('Not signed in.');
    return user.getIdToken();
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      configured,
      getIdToken,
      signIn,
      signUp,
      signInWithGoogle,
      resetPassword,
      logout,
    }),
    [user, loading, configured, getIdToken, signIn, signUp, signInWithGoogle, resetPassword, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
