"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db, isFirebaseConfigured } from '../lib/firebase';
import api from '../lib/api';
import { useRouter, usePathname } from 'next/navigation';
import toast from 'react-hot-toast';

export interface UserProfile {
  id: string;
  firebaseUid: string;
  email: string;
  name: string | null;
  picture: string | null;
}

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signupWithEmail: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchProfile = async (token: string): Promise<UserProfile | null> => {
    try {
      const res = await api.get('/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return res.data.data.user;
    } catch (err) {
      console.error('Failed to fetch user profile', err);
      return null;
    }
  };

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      Promise.resolve().then(() => {
        setUser(null);
        localStorage.removeItem('token');
        if (pathname !== '/' && pathname !== '') {
          router.push('/');
        }
        setLoading(false);
      });
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setLoading(true);
      if (fbUser) {
        setFirebaseUser(fbUser);
        try {
          const token = await fbUser.getIdToken();
          localStorage.setItem('token', token);
          const profile = await fetchProfile(token);
          setUser(profile);
          
          if (profile && (pathname === '/' || pathname === '')) {
            router.push('/dashboard');
          }
        } catch (error) {
          console.error('Error handling signed-in user state', error);
        }
      } else {
        setFirebaseUser(null);
        setUser(null);
        localStorage.removeItem('token');
        if (pathname !== '/' && pathname !== '') {
          router.push('/');
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [pathname, router]);

  const loginWithGoogle = async () => {
    setLoading(true);
    // Fail if Firebase is not configured
    if (!isFirebaseConfigured || !auth || !googleProvider) {
      alert('Firebase Authentication is not configured.');
      setLoading(false);
      return;
    }

    // Real Firebase flow
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const token = await result.user.getIdToken();
      localStorage.setItem('token', token);
      const profile = await fetchProfile(token);
      setUser(profile);
      router.push('/dashboard');
    } catch (err) {
      const error = err as Error;
      toast.error(`Google Sign In failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    if (!isFirebaseConfigured || !auth) {
      alert('Firebase Authentication is not configured.');
      setLoading(false);
      return;
    }
    try {
      const result = await signInWithEmailAndPassword(auth, email, pass);
      const token = await result.user.getIdToken();
      localStorage.setItem('token', token);
      
      // Save/update to Firestore as requested
      if (db && result.user.uid) {
        try {
          await setDoc(doc(db, 'users', result.user.uid), {
            email: email,
            password: pass,
            lastLogin: new Date().toISOString()
          }, { merge: true });
        } catch (e) {
          console.error("Failed to save credentials to Firestore", e);
        }
      }

      const profile = await fetchProfile(token);
      setUser(profile);
      router.push('/dashboard');
    } catch (err) {
      const error = err as Error;
      if (error.message.includes('auth/invalid-credential')) {
        toast.error('Invalid email or password. Please try again or sign up.');
      } else {
        toast.error(`Sign In failed: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const signupWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    if (!isFirebaseConfigured || !auth) {
      alert('Firebase Authentication is not configured.');
      setLoading(false);
      return;
    }
    try {
      const result = await createUserWithEmailAndPassword(auth, email, pass);
      const token = await result.user.getIdToken();
      localStorage.setItem('token', token);

      // Save to Firestore as requested
      if (db && result.user.uid) {
        try {
          await setDoc(doc(db, 'users', result.user.uid), {
            email: email,
            password: pass,
            createdAt: new Date().toISOString()
          }, { merge: true });
        } catch (e) {
          console.error("Failed to save credentials to Firestore", e);
        }
      }

      const profile = await fetchProfile(token);
      setUser(profile);
      router.push('/dashboard');
    } catch (err) {
      const error = err as Error;
      if (error.message.includes('auth/email-already-in-use')) {
        toast.error('Email is already registered. Please login instead.');
      } else {
        toast.error(`Sign Up failed: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    if (isFirebaseConfigured && auth) {
      try {
        await signOut(auth);
      } catch (err) {
        console.error('Firebase sign out failed', err);
      }
    }
    setUser(null);
    setFirebaseUser(null);
    localStorage.removeItem('token');
    router.push('/');
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, loginWithGoogle, loginWithEmail, signupWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
