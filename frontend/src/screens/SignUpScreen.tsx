import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { auth, db, googleProvider } from '../lib/firebase';
import { signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export const SignUpScreen = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignUp = async () => {
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
          role: formData.role, // Use selected role
          balance: 0,
          createdAt: serverTimestamp(),
        });

        // Also save Google signup to backend MongoDB so admin can see it.
        const randomPassword = Math.random().toString(36).slice(2, 12);
        await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: user.displayName,
            email: user.email,
            password: randomPassword,
            phoneNumber: user.phoneNumber || '0000000000',
            role: formData.role,
            balance: 0,
            photoURL: user.photoURL
          })
        });
      }

      navigate('/');
    } catch (err: any) {
      console.error("Signup error:", err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError("Signup window was closed. Please try again.");
      } else {
        setError("An error occurred during signup. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    phoneNumber: '',
    role: 'user' as 'user' | 'driver',
    // Driver specific
    panCard: '',
    aadhaarCard: '',
    vehicleRC: '',
    vehicleModel: '',
    plateNumber: '',
    vehicleColor: '',
    vehicleType: 'Go' as 'Go' | 'XL' | 'Premier'
  });

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Attempting email signup with:", formData);
    
    // Validate phone number
    if (!/^\d{10}$/.test(formData.phoneNumber)) {
      console.log("Phone validation failed:", formData.phoneNumber);
      setError("Mobile number must be exactly 10 digits");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload: any = {
        displayName: formData.fullName,
        email: formData.email,
        password: formData.password,
        phoneNumber: formData.phoneNumber,
        role: formData.role,
        balance: 0
      };

      if (formData.role === 'driver') {
        payload.documents = {
          panCard: formData.panCard,
          aadhaarCard: formData.aadhaarCard,
          vehicleRC: formData.vehicleRC
        };
        payload.vehicleInfo = {
          model: formData.vehicleModel,
          plateNumber: formData.plateNumber,
          color: formData.vehicleColor,
          type: formData.vehicleType
        };
      }

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      console.log("Signup response:", data);
      if (!response.ok) throw new Error(data.error || 'Signup failed');

      navigate('/login');
    } catch (err: any) {
      console.error("Signup error catch:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-white flex flex-col p-8 overflow-y-auto">
      <div className="mt-8 mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Create Account</h2>
        <p className="text-slate-500">Join GORIDE and start your journey</p>
      </div>

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
        <div className="flex p-1 bg-slate-100 rounded-xl mb-2">
          <button
            type="button"
            onClick={() => setFormData({ ...formData, role: 'user' })}
            className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${formData.role === 'user' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
          >
            Passenger
          </button>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, role: 'driver' })}
            className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${formData.role === 'driver' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
          >
            Driver
          </button>
        </div>

        <Button 
          className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 shadow-sm" 
          size="lg"
          onClick={handleGoogleSignUp}
          disabled={loading}
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
          {loading ? 'Processing...' : `Sign up as ${formData.role === 'user' ? 'Passenger' : 'Driver'} with Google`}
        </Button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-100" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-slate-400 font-medium">Or use email</span>
          </div>
        </div>

        <form onSubmit={handleEmailSignUp} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Full Name</label>
            <Input 
              placeholder="John Doe" 
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              required
            />
          </div>
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
            <label className="text-sm font-medium text-slate-700">Mobile Number</label>
            <Input 
              placeholder="10-digit number" 
              type="tel" 
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })}
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

          {formData.role === 'driver' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-6 pt-4 border-t border-slate-100"
            >
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Vehicle Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500">Vehicle Model</label>
                    <Input 
                      placeholder="e.g. Swift" 
                      value={formData.vehicleModel}
                      onChange={(e) => setFormData({ ...formData, vehicleModel: e.target.value })}
                      required={formData.role === 'driver'}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500">Plate Number</label>
                    <Input 
                      placeholder="UP 16 AB 1234" 
                      value={formData.plateNumber}
                      onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value })}
                      required={formData.role === 'driver'}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500">Color</label>
                    <Input 
                      placeholder="White" 
                      value={formData.vehicleColor}
                      onChange={(e) => setFormData({ ...formData, vehicleColor: e.target.value })}
                      required={formData.role === 'driver'}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500">Vehicle Type</label>
                    <select 
                      className="w-full h-11 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      value={formData.vehicleType}
                      onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value as any })}
                      required={formData.role === 'driver'}
                    >
                      <option value="Go">GORIDE Go</option>
                      <option value="XL">UberXL</option>
                      <option value="Premier">Premier</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Documents (Numbers)</h3>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500">PAN Card Number</label>
                  <Input 
                    placeholder="ABCDE1234F" 
                    value={formData.panCard}
                    onChange={(e) => setFormData({ ...formData, panCard: e.target.value })}
                    required={formData.role === 'driver'}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500">Aadhaar Number</label>
                  <Input 
                    placeholder="1234 5678 9012" 
                    value={formData.aadhaarCard}
                    onChange={(e) => setFormData({ ...formData, aadhaarCard: e.target.value })}
                    required={formData.role === 'driver'}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500">Vehicle RC Number</label>
                  <Input 
                    placeholder="RC-1234567890" 
                    value={formData.vehicleRC}
                    onChange={(e) => setFormData({ ...formData, vehicleRC: e.target.value })}
                    required={formData.role === 'driver'}
                  />
                </div>
              </div>
            </motion.div>
          )}

          <Button className="w-full" size="lg" type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>
      </div>

      <p className="text-center text-sm text-slate-500 mt-8">
        Already have an account?{" "}
        <span 
          className="text-primary font-semibold cursor-pointer hover:underline"
          onClick={() => navigate('/login')}
        >
          Sign In
        </span>
      </p>
    </div>
  );
};
