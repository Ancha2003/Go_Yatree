import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { auth, db, googleProvider } from '../lib/firebase';
import { signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';

export const LoginScreen = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: 'user',
          createdAt: serverTimestamp(),
        });
      }

      navigate('/');
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError("Login window was closed. Please try again.");
      } else if (err.code === 'auth/popup-blocked') {
        setError("Login popup was blocked by your browser. Please enable popups for this site.");
      } else {
        setError("An error occurred during login. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [maskedPhone, setMaskedPhone] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { login } = useAuth();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed');

      if (data.requiresOtp) {
        setShowOtp(true);
        setMaskedPhone(data.phoneNumber);
        setSuccessMessage(data.message);
      } else {
        // Fallback if OTP is not required for some reason
        login(data.user, data.token);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, otp })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Verification failed');

      login(data.user, data.token);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-white flex flex-col p-8 overflow-y-auto">
      <div className="mt-8 mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">
          {showOtp ? 'Verify OTP' : 'Welcome Back'}
        </h2>
        <p className="text-slate-500">
          {showOtp 
            ? `Enter the 4-digit code sent to ${maskedPhone}` 
            : 'Sign in to continue your journey'}
        </p>
      </div>

      {successMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-blue-50 border border-blue-100 text-blue-600 text-sm rounded-xl font-medium"
        >
          {successMessage}
        </motion.div>
      )}

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl"
        >
          {error}
        </motion.div>
      )}

      <div className="space-y-6 flex-1">
        {!showOtp ? (
          <>
            <Button 
              className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 shadow-sm" 
              size="lg"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
              {loading ? 'Processing...' : 'Continue with Google'}
            </Button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-100" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400 font-medium">Or use email</span>
              </div>
            </div>

            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Email Address</label>
                <Input 
                  placeholder="name@example.com" 
                  type="email" 
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Password</label>
                <Input 
                  placeholder="••••••••" 
                  type="password" 
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>

              <Button className="w-full" size="lg" type="submit" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </>
        ) : (
          <form onSubmit={handleOtpVerify} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">One-Time Password</label>
              <Input 
                placeholder="0000" 
                type="text" 
                maxLength={4}
                className="text-center text-2xl tracking-[1em] font-bold"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>

            <Button className="w-full" size="lg" type="submit" disabled={loading || otp.length < 4}>
              {loading ? 'Verifying...' : 'Verify & Login'}
            </Button>

            <button 
              type="button"
              onClick={() => setShowOtp(false)}
              className="w-full text-sm text-slate-500 hover:text-slate-700 font-medium"
            >
              Back to Login
            </button>
          </form>
        )}
      </div>

      <p className="text-center text-sm text-slate-500 mt-8">
        Don't have an account?{" "}
        <span 
          className="text-primary font-semibold cursor-pointer hover:underline"
          onClick={() => navigate('/signup')}
        >
          Sign Up
        </span>
      </p>
    </div>
  );
};
