import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

interface UserProfile {
  uid?: string;
  id?: string;
  email: string;
  displayName: string;
  role: 'user' | 'driver' | 'admin';
  photoURL?: string;
  isVerified?: boolean;
  isActive?: boolean;
  balance?: number;
  vehicleInfo?: {
    model: string;
    plateNumber: string;
    color: string;
    type: string;
  };
}

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  isAuthReady: boolean;
  login: (userData: any, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAuthReady: false,
  login: () => {},
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const login = (userData: any, token: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    setProfile(userData);
  };

  const logout = async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setProfile(null);
    await signOut(auth);
  };

  useEffect(() => {
    // Check for existing JWT session
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (savedUser && token && savedUser !== 'undefined') {
      try {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser) {
          setUser(parsedUser);
          setProfile(parsedUser);
          setLoading(false);
          setIsAuthReady(true);
        }
      } catch (e) {
        console.error("Error parsing saved user:", e);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
      }
      setIsAuthReady(true);
      
      if (!firebaseUser && !localStorage.getItem('token')) {
        setProfile(null);
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    // Only fetch from Firestore if we have a Firebase UID.
    // MERN users (who have 'id') already have their profile data from the login API.
    const firebaseUid = user?.uid;
    
    if (firebaseUid && db) {
      const unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUid), (doc) => {
        if (doc.exists()) {
          setProfile(doc.data() as UserProfile);
        }
        setLoading(false);
      }, (error) => {
        console.error("Profile fetch error:", error);
        setLoading(false);
      });

      return () => unsubscribeProfile();
    } else {
      // For MERN users or unauthenticated users, we don't need to fetch from Firestore
      setLoading(false);
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAuthReady, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
