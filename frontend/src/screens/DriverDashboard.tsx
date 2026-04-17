import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Menu, User, LogOut, X, MapPin, Clock, CreditCard, 
  Shield, Settings, HelpCircle, Car, Users, Zap,
  TrendingUp, Star, DollarSign, CheckCircle, AlertCircle,
  Power, Phone, MessageSquare, Send, Navigation, Plus
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { Button } from '../components/Button';
import { socket } from '../lib/socket';
import { db } from '../lib/firebase';
import { doc, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

const SidebarItem = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-6 py-4 transition-colors group ${active ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400 hover:bg-slate-800'}`}
  >
    <div className={`${active ? 'text-blue-400' : 'text-slate-500 group-hover:text-blue-400'} transition-colors`}>
      {icon}
    </div>
    <span className="font-medium">{label}</span>
  </button>
);

export const DriverDashboard = () => {
  const { profile, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'rides' | 'wallet' | 'docs' | 'support'>('home');
  const [rideRequest, setRideRequest] = useState<any>(null);
  const [currentRide, setCurrentRide] = useState<any>(null);
  const [rideStatus, setRideStatus] = useState<'confirmed' | 'arriving' | 'ongoing' | 'completed' | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [timer, setTimer] = useState<number | null>(null);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [photoURLInput, setPhotoURLInput] = useState('');
  const [trips, setTrips] = useState<any[]>([]);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [driverStats, setDriverStats] = useState<any>(null);

  useEffect(() => {
    const driverId = profile?.id || profile?.uid;
    if (!driverId) return;

    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        
        // Fetch Stats
        const statsRes = await fetch('/api/driver/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setDriverStats(statsData);
        }

        // Fetch Rides (for Recent Rides and History)
        const ridesRes = await fetch('/api/driver/rides', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (ridesRes.ok) {
          const ridesData = await ridesRes.json();
          setTrips(ridesData);
        }
      } catch (error) {
        console.error("Error fetching driver data:", error);
      }
    };

    if (activeTab === 'home' || activeTab === 'rides') {
      fetchData();
    }
  }, [activeTab, profile]);

  useEffect(() => {
    const driverId = profile?.id || profile?.uid;
    if (!driverId) return;

    const updateOnlineStatus = async () => {
      const token = localStorage.getItem('token');
      if (isOnline) {
        socket.connect();
        socket.emit('join', driverId);
        
        // Update MongoDB isOnline status
        try {
          const response = await fetch('/api/driver/toggle-online', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ isOnline: true })
          });
          if (!response.ok) {
            const errorText = await response.text();
            console.warn("Toggle online failed:", response.status, errorText);
          }
        } catch (error) {
          console.error("Error updating MongoDB status:", error);
        }

        socket.on('new-ride-request', (data) => {
          setRideRequest(data);
        });
        socket.on('receive-message', (data) => {
          if (data.toDriver === true) {
            setMessages(prev => [...prev, { ...data.message, self: false }]);
          }
        });
        socket.on('ride-cancelled', (data) => {
          if (currentRide && (data.rideId === currentRide.rideId || data.rideId === currentRide._id)) {
            setCurrentRide(null);
            setRideStatus(null);
            setMessages([]);
            setTimer(null);
            alert("The user has cancelled the ride.");
          }
        });

        socket.on('ride-accepted', (data) => {
          setCurrentRide(prev => prev ? { ...prev, ...data } : data);
          setRideStatus('confirmed');
        });

        socket.on('driver-arrived', (data) => {
          setRideStatus('arriving');
        });

        socket.on('start-ride', (data) => {
          setRideStatus('ongoing');
          // Timer is usually started by the driver who clicked, 
          // but for sync we can check if timer is running
          if (timer === null) {
            const durationStr = currentRide?.duration || "1 min";
            const mins = parseInt(durationStr) || 1;
            setTimer(mins * 60);
          }
        });

        socket.on('complete-ride', (data) => {
          setRideStatus('completed');
          setTimer(null);
          setTimeout(() => {
            setCurrentRide(null);
            setRideStatus(null);
            setMessages([]);
          }, 3000);
        });
      } else {
        socket.disconnect();
        setRideRequest(null);

        // Update MongoDB isOnline status
        const token = localStorage.getItem('token');
        try {
          const response = await fetch('/api/driver/toggle-online', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ isOnline: false })
          });
          if (!response.ok) {
            const errorText = await response.text();
            console.warn("Toggle offline failed:", response.status, errorText);
          }
        } catch (error) {
          console.error("Error updating MongoDB status:", error);
        }
      }
    };

    updateOnlineStatus();

    let locationInterval: any;
    if (isOnline) {
      const updateLocation = () => {
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
              const token = localStorage.getItem('token');
              if (!token) return;

              // Update MongoDB
              const updateRes = await fetch('/api/ride/update-location', {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ lat: latitude, lng: longitude })
              });

              if (!updateRes.ok) {
                const errorText = await updateRes.text();
                console.warn("Driver location update failed:", updateRes.status, errorText);
              }
            } catch (error) {
              console.error("Driver location update error:", error);
            }
          });
        }
      };
      updateLocation();
      locationInterval = setInterval(updateLocation, 30000);
    }

    return () => {
      socket.off('new-ride-request');
      socket.off('receive-message');
      socket.off('ride-cancelled');
      socket.off('ride-accepted');
      socket.off('driver-arrived');
      socket.off('start-ride');
      socket.off('complete-ride');
      if (locationInterval) clearInterval(locationInterval);
    };
  }, [isOnline, profile, currentRide]);

  const handleAcceptRide = () => {
    const driverId = profile?.id || profile?.uid;
    socket.emit('accept-ride', {
      rideId: rideRequest.rideId,
      userId: rideRequest.userId,
      driverId: driverId,
      driverName: profile?.displayName,
      vehicleInfo: profile?.vehicleInfo
    });
    setCurrentRide(rideRequest);
    setRideStatus('confirmed');
    setRideRequest(null);
  };

  const handleArrived = () => {
    setRideStatus('arriving');
    socket.emit('driver-arrived', { userId: currentRide.userId, rideId: currentRide.rideId });
  };

  const handleVerifyOTP = () => {
    if (otpInput.length === 4) {
      setRideStatus('ongoing');
      socket.emit('start-ride', { userId: currentRide.userId, rideId: currentRide.rideId });
      setOtpInput('');
      
      // Start timer
      const durationStr = currentRide.duration || "1 min";
      const mins = parseInt(durationStr) || 1;
      setTimer(mins * 60);
    } else {
      alert("Please enter a valid 4-digit OTP");
    }
  };

  const handleCancelRide = async () => {
    if (!currentRide) return;
    if (!cancellationReason.trim()) {
      alert("Please provide a reason for cancellation");
      return;
    }
    const driverId = profile?.id || profile?.uid;
    
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/ride/cancel/${currentRide.rideId || currentRide._id}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          reason: cancellationReason,
          cancelledBy: 'driver'
        })
      });
      
      socket.emit('cancel-ride', { 
        rideId: currentRide.rideId || currentRide._id, 
        userId: currentRide.userId,
        cancelledBy: 'driver',
        reason: cancellationReason
      });
      
      setIsCancelModalOpen(false);
      setCancellationReason('');
      setCurrentRide(null);
      setRideStatus(null);
      setMessages([]);
      
      // Refresh trips
      const token2 = localStorage.getItem('token');
      const ridesRes = await fetch('/api/driver/rides', {
        headers: { 'Authorization': `Bearer ${token2}` }
      });
      if (ridesRes.ok) {
        const ridesData = await ridesRes.json();
        setTrips(ridesData);
      }
    } catch (error) {
      console.error("Error cancelling ride:", error);
    }
  };

  const handleCompleteRide = () => {
    setRideStatus('completed');
    socket.emit('complete-ride', { userId: currentRide.userId, rideId: currentRide.rideId });
    setTimer(null);
    setTimeout(() => {
      setCurrentRide(null);
      setRideStatus(null);
      setMessages([]);
    }, 3000);
  };

  useEffect(() => {
    let interval: any;
    if (timer !== null && timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => (prev !== null && prev > 0) ? prev - 1 : 0);
      }, 1000);
    } else if (timer === 0) {
      handleCompleteRide();
      setTimer(null);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const sendMessage = () => {
    if (!chatMessage.trim()) return;
    const msg = { text: chatMessage, sender: 'driver', timestamp: new Date().toISOString() };
    socket.emit('send-message', { userId: currentRide.userId, message: msg, toDriver: false });
    setMessages(prev => [...prev, { ...msg, self: true }]);
    setChatMessage('');
  };

  const updatePhotoURL = async () => {
    if (!photoURLInput.trim()) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ photoURL: photoURLInput })
      });
      if (response.ok) {
        setIsPhotoModalOpen(false);
        window.location.reload(); // Refresh to show new photo
      }
    } catch (error) {
      console.error("Error updating photo:", error);
    }
  };

  const handleUploadDocument = async (docType: string) => {
    setUploadingDoc(docType);
    // Simulate upload delay
    setTimeout(() => {
      setUploadingDoc(null);
      alert(`${docType} uploaded successfully! It will be reviewed by admin.`);
    }, 2000);
  };

  const stats = [
    { label: 'Total Earnings', value: driverStats ? `₹${driverStats.totalEarnings}` : '₹0', icon: <DollarSign className="w-5 h-5" />, color: 'bg-green-500/10 text-green-500' },
    { label: 'Total Rides', value: driverStats ? driverStats.totalRides.toString() : '0', icon: <Car className="w-5 h-5" />, color: 'bg-blue-500/10 text-blue-500' },
    { label: 'Rating', value: driverStats ? driverStats.rating.toString() : '5.0', icon: <Star className="w-5 h-5" />, color: 'bg-yellow-500/10 text-yellow-500' },
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[2000]"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-0 left-0 bottom-0 w-72 bg-slate-900 shadow-2xl z-[2001] flex flex-col"
            >
              <div className="p-8 border-b border-slate-800">
                <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-600/20 overflow-hidden">
                  {profile?.photoURL ? (
                    <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <Car className="w-8 h-8 text-white" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">{profile?.displayName || 'Driver'}</h3>
                    <p className="text-slate-500 text-sm">{profile?.isVerified ? 'Verified Driver' : 'Pending Verification'}</p>
                  </div>
                  <button 
                    onClick={() => {
                      setPhotoURLInput(profile?.photoURL || '');
                      setIsPhotoModalOpen(true);
                    }}
                    className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 py-4 overflow-y-auto">
                <SidebarItem 
                  icon={<TrendingUp className="w-5 h-5" />} 
                  label="Dashboard" 
                  active={activeTab === 'home'} 
                  onClick={() => { setActiveTab('home'); setIsSidebarOpen(false); }} 
                />
                <SidebarItem 
                  icon={<Clock className="w-5 h-5" />} 
                  label="My Rides" 
                  active={activeTab === 'rides'} 
                  onClick={() => { setActiveTab('rides'); setIsSidebarOpen(false); }} 
                />
                <SidebarItem 
                  icon={<CreditCard className="w-5 h-5" />} 
                  label="Wallet" 
                  active={activeTab === 'wallet'} 
                  onClick={() => { setActiveTab('wallet'); setIsSidebarOpen(false); }} 
                />
                <SidebarItem 
                  icon={<Shield className="w-5 h-5" />} 
                  label="Documents" 
                  active={activeTab === 'docs'} 
                  onClick={() => { setActiveTab('docs'); setIsSidebarOpen(false); }} 
                />
                <SidebarItem 
                  icon={<HelpCircle className="w-5 h-5" />} 
                  label="Support" 
                  active={activeTab === 'support'} 
                  onClick={() => { setActiveTab('support'); setIsSidebarOpen(false); }} 
                />
              </div>

              <div className="p-4 border-t border-slate-800">
                <button 
                  onClick={logout}
                  className="w-full flex items-center gap-3 p-3 text-red-400 hover:bg-red-400/10 rounded-xl transition-colors font-medium"
                >
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="p-4 flex justify-between items-center bg-slate-900/50 backdrop-blur-md border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-300 hover:bg-slate-700 active:scale-95 transition-transform"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-black text-white tracking-tighter">Texi-Booking-App <span className="text-blue-500 text-[10px] uppercase ml-1">Driver</span></h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-800/80 px-4 py-2 rounded-2xl border border-slate-700/50 backdrop-blur-md">
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.6)]' : 'bg-slate-500'} transition-all duration-500`} />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 mr-2">{isOnline ? 'Online' : 'Offline'}</span>
            <button 
              onClick={() => setIsOnline(!isOnline)}
              className={`w-11 h-6 rounded-full relative transition-all duration-500 focus:outline-none ${isOnline ? 'bg-green-500/20 border-green-500/50' : 'bg-slate-700/50 border-slate-600'} border`}
            >
              <motion.div 
                animate={{ x: isOnline ? 22 : 4 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className={`absolute top-1 w-3.5 h-3.5 rounded-full shadow-lg ${isOnline ? 'bg-green-500' : 'bg-slate-400'}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 pb-24">
        {activeTab === 'home' && (
          <div className="space-y-6">
            {/* Verification Banner */}
            {!profile?.isVerified && (
              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex gap-4 items-start">
                <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
                <div>
                  <h4 className="font-bold text-amber-500">Verification Pending</h4>
                  <p className="text-sm text-amber-500/80">Please upload your documents to start accepting rides.</p>
                  <button 
                    onClick={() => setActiveTab('docs')}
                    className="mt-2 text-sm font-bold underline"
                  >
                    Upload Documents
                  </button>
                </div>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 gap-4">
              {stats.map((stat, i) => (
                <div key={i} className="bg-slate-900 p-5 rounded-3xl border border-slate-800 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${stat.color}`}>
                    {stat.icon}
                  </div>
                  <div>
                    <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
                    <h3 className="text-2xl font-bold text-white">{stat.value}</h3>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent Activity */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">Recent Rides</h3>
                <button onClick={() => setActiveTab('rides')} className="text-sm text-blue-400 font-medium">View All</button>
              </div>
              <div className="space-y-4">
                {trips.length > 0 ? trips.slice(0, 3).map(ride => (
                  <div key={ride._id} className="bg-slate-900 p-5 rounded-3xl border border-slate-800">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                          <User className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                          <p className="font-bold text-white">User {ride.userId?.toString().slice(-4)}</p>
                          <p className="text-xs text-slate-500">{new Date(ride.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                      <span className="text-lg font-bold text-green-400">₹{ride.fare}</span>
                    </div>
                    <div className="space-y-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-sm text-slate-400 truncate">{ride.pickup.address}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-teal-500" />
                        <span className="text-sm text-slate-400 truncate">{ride.dropoff.address}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                      <div className="flex flex-col gap-1 w-full">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                            ride.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                            ride.status === 'cancelled' ? 'bg-red-500/10 text-red-500' :
                            'bg-blue-500/10 text-blue-500'
                          }`}>
                            {ride.status.toUpperCase()}
                          </span>
                        </div>
                        {ride.status === 'cancelled' && ride.cancellationReason && (
                          <p className="text-[10px] text-red-400 italic mt-2 font-medium bg-red-500/5 p-2 rounded-xl border border-red-500/10">
                            Reason: {ride.cancellationReason}
                            {ride.cancelledBy && <span className="ml-1 opacity-50">(by {ride.cancelledBy})</span>}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="py-10 text-center bg-slate-900 rounded-3xl border border-slate-800">
                    <Clock className="w-10 h-10 text-slate-800 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">No recent rides.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rides' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">Ride History</h2>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-blue-600 rounded-full text-[10px] font-bold uppercase tracking-wider">All</span>
                <span className="px-3 py-1 bg-slate-800 rounded-full text-[10px] font-bold uppercase tracking-wider text-slate-500">Weekly</span>
              </div>
            </div>

            <div className="space-y-4">
              {trips.length > 0 ? trips.map(ride => (
                <div key={ride._id} className="bg-slate-900 p-5 rounded-3xl border border-slate-800">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                        <User className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="font-bold text-white">User {ride.userId?.toString().slice(-4)}</p>
                        <p className="text-xs text-slate-500">{new Date(ride.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-white">₹{ride.fare}</span>
                  </div>
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-sm text-slate-400 truncate">{ride.pickup.address}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-teal-500" />
                      <span className="text-sm text-slate-400 truncate">{ride.dropoff.address}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                    <div className="flex flex-col gap-1 w-full">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                          ride.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                          ride.status === 'cancelled' ? 'bg-red-500/10 text-red-500' :
                          'bg-blue-500/10 text-blue-500'
                        }`}>
                          {ride.status.toUpperCase()}
                        </span>
                        {ride.rating > 0 && (
                          <div className="flex items-center gap-1 bg-yellow-500/10 px-2 py-1 rounded-md">
                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                            <span className="text-[10px] font-bold text-yellow-500">{ride.rating}</span>
                          </div>
                        )}
                      </div>
                      {ride.status === 'cancelled' && ride.cancellationReason && (
                        <p className="text-[10px] text-red-400 italic mt-2 font-medium bg-red-500/5 p-2 rounded-xl border border-red-500/10">
                          Reason: {ride.cancellationReason}
                          {ride.cancelledBy && <span className="ml-1 opacity-50">(by {ride.cancelledBy})</span>}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="py-20 text-center">
                  <Clock className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                  <p className="text-slate-500">No rides completed yet.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'wallet' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-8 rounded-[2rem] text-white shadow-xl shadow-blue-600/10">
              <p className="text-blue-100 text-sm mb-1">Available Balance</p>
              <h3 className="text-4xl font-bold mb-8">₹{profile?.balance || 0}</h3>
              <div className="grid grid-cols-2 gap-4">
                <Button className="bg-white text-blue-600 hover:bg-blue-50 border-none h-12 rounded-2xl">Withdraw</Button>
                <Button className="bg-white/20 hover:bg-white/30 border-none text-white h-12 rounded-2xl">Add Money</Button>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-white mb-4">Transaction History</h3>
              <div className="bg-slate-900 rounded-3xl border border-slate-800 divide-y divide-slate-800">
                {[
                  { title: 'Ride Earnings', date: 'Today', amount: '+₹142', type: 'credit' },
                  { title: 'Withdrawal', date: 'Yesterday', amount: '-₹2,000', type: 'debit' },
                  { title: 'Ride Earnings', date: 'Yesterday', amount: '+₹210', type: 'credit' },
                ].map((tx, i) => (
                  <div key={i} className="p-5 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.type === 'credit' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                        {tx.type === 'credit' ? <TrendingUp className="w-5 h-5" /> : <TrendingUp className="w-5 h-5 rotate-180" />}
                      </div>
                      <div>
                        <p className="font-bold text-white">{tx.title}</p>
                        <p className="text-xs text-slate-500">{tx.date}</p>
                      </div>
                    </div>
                    <span className={`font-bold ${tx.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>{tx.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'docs' && (
          <div className="space-y-6">
            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800">
              <h3 className="text-lg font-bold text-white mb-2">Required Documents</h3>
              <p className="text-sm text-slate-500 mb-6">Upload clear photos of your documents for verification.</p>
              
              <div className="space-y-4">
                {[
                  { label: 'Aadhaar Card', status: 'Verified', icon: <CheckCircle className="w-5 h-5 text-green-500" /> },
                  { label: 'PAN Card', status: 'Pending', icon: <Clock className="w-5 h-5 text-amber-500" /> },
                  { label: 'Vehicle RC', status: 'Not Uploaded', icon: <AlertCircle className="w-5 h-5 text-slate-500" /> },
                ].map((doc, i) => (
                  <div key={i} className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center text-slate-400">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{doc.label}</p>
                        <p className="text-xs text-slate-500">{doc.status}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {doc.status === 'Not Uploaded' && (
                        <button 
                          onClick={() => handleUploadDocument(doc.label)}
                          disabled={uploadingDoc === doc.label}
                          className="text-xs font-bold text-blue-400 hover:underline disabled:opacity-50"
                        >
                          {uploadingDoc === doc.label ? 'Uploading...' : 'Upload'}
                        </button>
                      )}
                      {doc.icon}
                    </div>
                  </div>
                ))}
              </div>
              
              <Button 
                onClick={() => handleUploadDocument('New Document')}
                className="w-full mt-8 bg-blue-600 hover:bg-blue-700 h-14 rounded-2xl"
              >
                Upload New Document
              </Button>
            </div>

            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800">
              <h3 className="text-lg font-bold text-white mb-4">Vehicle Details</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Model</p>
                    <p className="text-sm font-bold text-white">{profile?.vehicleInfo?.model || 'Maruti Suzuki Swift'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Plate Number</p>
                    <p className="text-sm font-bold text-white">{profile?.vehicleInfo?.plateNumber || 'UP 16 AB 1234'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Color</p>
                    <p className="text-sm font-bold text-white">{profile?.vehicleInfo?.color || 'White'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Type</p>
                    <p className="text-sm font-bold text-white">GORIDE {profile?.vehicleInfo?.type || 'Go'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'support' && (
          <div className="space-y-6">
            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800">
              <h3 className="text-xl font-bold text-white mb-6">How can we help?</h3>
              
              <div className="space-y-4">
                {[
                  { q: 'How do I get paid?', a: 'Earnings are transferred to your linked bank account every Monday.' },
                  { q: 'What if a passenger cancels?', a: 'You may be eligible for a cancellation fee if the passenger cancels after 5 minutes.' },
                  { q: 'How to improve my rating?', a: 'Maintain a clean car, be polite, and follow the best routes.' },
                  { q: 'Safety concerns?', a: 'Use the in-app emergency button or contact our 24/7 support line.' },
                ].map((faq, i) => (
                  <div key={i} className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
                    <p className="font-bold text-sm text-white mb-2">{faq.q}</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{faq.a}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-8 border-t border-slate-800 space-y-4">
                <button className="w-full flex items-center justify-between p-4 bg-blue-600 rounded-2xl text-white font-bold">
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5" />
                    <span>Call Support</span>
                  </div>
                  <Clock className="w-4 h-4 opacity-60" />
                </button>
                <button className="w-full flex items-center justify-between p-4 bg-slate-800 rounded-2xl text-slate-300 font-bold border border-slate-700">
                  <div className="flex items-center gap-3">
                    <HelpCircle className="w-5 h-5" />
                    <span>Chat with Us</span>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                </button>
              </div>
            </div>

            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 text-center">
              <p className="text-xs text-slate-500">GORIDE Support v1.0.4</p>
              <p className="text-[10px] text-slate-600 mt-1">Available 24/7 for your safety and convenience.</p>
            </div>
          </div>
        )}
      </div>

      {/* Active Ride Panel */}
      <AnimatePresence>
        {currentRide && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="absolute bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 z-[2500] p-6 rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-lg">{currentRide.userName}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                      rideStatus === 'confirmed' ? 'bg-blue-400' :
                      rideStatus === 'arriving' ? 'bg-amber-400' :
                      rideStatus === 'ongoing' ? 'bg-green-400' :
                      'bg-slate-400'
                    }`} />
                    <p className={`text-[10px] uppercase tracking-wider font-black ${
                      rideStatus === 'confirmed' ? 'text-blue-400' :
                      rideStatus === 'arriving' ? 'text-amber-400' :
                      rideStatus === 'ongoing' ? 'text-green-400' :
                      'text-slate-500'
                    }`}>
                      {rideStatus ? (rideStatus === 'arriving' ? 'Arrived' : rideStatus) : 'Active Ride'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => window.open(`tel:${currentRide.phone || '9999999999'}`)}
                  className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-blue-400 hover:bg-slate-700 transition-colors"
                >
                  <Phone className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setIsChatOpen(true)}
                  className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-teal-400 hover:bg-slate-700 transition-colors relative"
                >
                  <MessageSquare className="w-5 h-5" />
                  {messages.filter(m => !m.self).length > 0 && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-slate-900 flex items-center justify-center text-[8px] font-bold text-white">
                      {messages.filter(m => !m.self).length}
                    </div>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              {timer !== null && (
                <div className="bg-slate-800/50 p-4 rounded-2xl flex items-center justify-between border border-blue-500/20 mb-4">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-blue-400" />
                    <span className="text-sm font-bold text-slate-300">Remaining Time</span>
                  </div>
                  <span className="text-xl font-black text-blue-500 font-mono tracking-wider">{formatTimer(timer)}</span>
                </div>
              )}
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Pickup</p>
                  <p className="text-sm font-medium text-slate-300">{currentRide.pickup.address}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-teal-500 mt-1.5 shadow-[0_0_8px_rgba(20,184,166,0.5)]" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Dropoff</p>
                  <p className="text-sm font-medium text-slate-300">{currentRide.dropoff.address}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              {rideStatus === 'confirmed' && (
                <Button 
                  onClick={handleArrived}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 h-14 rounded-2xl font-bold flex items-center justify-center gap-2"
                >
                  <Navigation className="w-5 h-5" />
                  I have Arrived
                </Button>
              )}

              {rideStatus === 'arriving' && (
                <div className="flex-1 space-y-4">
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="Enter 4-digit OTP" 
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="w-full h-14 bg-slate-800 border border-slate-700 rounded-2xl px-6 text-center text-xl font-bold tracking-[1em] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                  <Button 
                    onClick={handleVerifyOTP}
                    disabled={otpInput.length !== 4}
                    className="w-full bg-green-600 hover:bg-green-700 h-14 rounded-2xl font-bold"
                  >
                    Verify OTP & Start Ride
                  </Button>
                </div>
              )}

              {rideStatus === 'ongoing' && (
                <Button 
                  onClick={handleCompleteRide}
                  className="flex-1 bg-red-600 hover:bg-red-700 h-14 rounded-2xl font-bold"
                >
                  Complete Ride
                </Button>
              )}

              {(rideStatus === 'confirmed' || rideStatus === 'arriving') && (
                <Button 
                  variant="outline"
                  onClick={() => setIsCancelModalOpen(true)}
                  className="w-20 h-14 rounded-2xl border-slate-700 text-red-500 hover:bg-red-500/10 flex items-center justify-center"
                >
                  <X className="w-6 h-6" />
                </Button>
              )}
            </div>

            {rideStatus === 'completed' && (
              <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-2xl text-center">
                <p className="text-green-500 font-bold">Ride Completed Successfully!</p>
                <p className="text-xs text-green-500/60 mt-1">Earnings will be added to your wallet.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Modal */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950 z-[4000] flex flex-col"
          >
            <div className="p-4 flex items-center gap-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md">
              <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-slate-800 rounded-xl">
                <X className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-white">{currentRide?.userName}</h4>
                  <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest">Online</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.self ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${
                    msg.self ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none'
                  }`}>
                    {msg.text}
                    <p className={`text-[8px] mt-1 opacity-60 ${msg.self ? 'text-right' : 'text-left'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4">
                  <MessageSquare className="w-12 h-12 opacity-20" />
                  <p className="text-sm">No messages yet. Say hello!</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-900/50 backdrop-blur-md border-t border-slate-800 flex gap-3">
              <input 
                type="text" 
                placeholder="Type a message..." 
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                className="flex-1 h-12 bg-slate-800 border border-slate-700 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <button 
                onClick={sendMessage}
                className="w-12 h-12 bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center justify-center text-white transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Photo URL Modal */}
      <AnimatePresence>
        {isPhotoModalOpen && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-slate-900 w-full max-w-sm rounded-[2rem] p-6 border border-slate-800 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">Update Photo</h3>
                <button onClick={() => setIsPhotoModalOpen(false)} className="p-2 hover:bg-slate-800 rounded-lg">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Image URL</label>
                  <input 
                    type="url"
                    className="w-full h-12 px-4 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:border-blue-500 outline-none"
                    placeholder="https://example.com/photo.jpg"
                    value={photoURLInput}
                    onChange={(e) => setPhotoURLInput(e.target.value)}
                  />
                </div>

                <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700 mt-2">
                  <p className="text-[10px] text-slate-400 leading-relaxed uppercase tracking-widest font-bold">Preview</p>
                  <div className="mt-2 w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700">
                    {photoURLInput ? (
                      <img 
                        src={photoURLInput} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <User className="w-6 h-6 text-slate-600" />
                    )}
                  </div>
                </div>

                <Button 
                  onClick={updatePhotoURL}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-xl mt-4"
                >
                  Save Profile Photo
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Cancellation Modal */}
      <AnimatePresence>
        {isCancelModalOpen && (
          <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-slate-900 w-full max-w-sm rounded-[2rem] p-6 border border-slate-800 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">Cancel Ride</h3>
                <button 
                  onClick={() => {
                    setIsCancelModalOpen(false);
                    setCancellationReason('');
                  }} 
                  className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Reason for cancellation</label>
                  <textarea 
                    className="w-full h-32 p-4 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:border-blue-500 outline-none resize-none transition-all"
                    placeholder="Tell the passenger why you're cancelling..."
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                  />
                </div>

                <div className="flex gap-3">
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setIsCancelModalOpen(false);
                      setCancellationReason('');
                    }}
                    className="flex-1 h-12 rounded-xl text-xs font-bold border-slate-700 text-slate-400"
                  >
                    Keep Ride
                  </Button>
                  <Button 
                    onClick={handleCancelRide}
                    className="flex-1 h-12 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold border-none"
                    disabled={!cancellationReason.trim()}
                  >
                    Confirm Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
