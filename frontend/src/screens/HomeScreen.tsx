import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { socket } from '../lib/socket';
import { useAuth } from '../lib/AuthContext';
import { Button } from '../components/Button';
import { Search, Menu, User, LogOut, X, MapPin, Clock, CreditCard, Shield, Settings, HelpCircle, Car, Users, Zap, Phone, Star, MessageSquare, Send, Navigation, Plus, Wallet } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { AnimatePresence, motion } from 'motion/react';
import { collection, getDocs, doc, updateDoc, increment } from 'firebase/firestore';
import { Input } from '../components/Input';

const RecenterMap = ({ coords }: { coords: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(coords);
  }, [coords, map]);
  return null;
};

const SidebarItem = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-6 py-4 transition-colors group ${active ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-50'}`}
  >
    <div className={`${active ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-600'} transition-colors`}>
      {icon}
    </div>
    <span className="font-medium">{label}</span>
  </button>
);

export const HomeScreen = () => {
  const navigate = useNavigate();
  const { profile, logout } = useAuth();
  const [location, setLocation] = useState<[number, number]>([51.505, -0.09]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'map' | 'trips' | 'payment' | 'safety' | 'settings' | 'support'>('map');
  const [isSearching, setIsSearching] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [rideOptions, setRideOptions] = useState<any[] | null>(null);
  const [selectedRide, setSelectedRide] = useState<string | null>(null);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [rideStatus, setRideStatus] = useState<'requesting' | 'confirmed' | 'arriving' | 'ongoing' | 'completed' | null>(null);
  const [otp, setOtp] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [nearbyDriversCount, setNearbyDriversCount] = useState(0);
  const [destinationRiders, setDestinationRiders] = useState<[number, number][]>([]);
  const [isAddMoneyOpen, setIsAddMoneyOpen] = useState(false);
  const [timer, setTimer] = useState<number | null>(null);
  const [readyToComplete, setReadyToComplete] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [trips, setTrips] = useState<any[]>([]);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  const fetchTrips = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/ride/user-rides', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTrips(data);
      }
    } catch (error) {
      console.error("Error fetching trips:", error);
    }
  };

  useEffect(() => {
    const userId = profile?.id || profile?.uid;
    if (!userId) return;

    socket.connect();
    socket.emit('join', userId);

    socket.on('ride-accepted', (data) => {
      setActiveRide(prev => prev ? { ...prev, ...data, status: 'confirmed' } : { ...data, status: 'confirmed' });
      setRideStatus('confirmed');
      setOtp(data.otp);
      setStatusMessage(null);
      setRideOptions(null);
      setSearchQuery('');
      setTimer(null);
      setReadyToComplete(false);
    });

    socket.on('ride-request-sent', (data) => {
      setActiveRide(prev => prev ? { ...prev, rideId: data.rideId } : null);
    });

    socket.on('driver-arrived', (data) => {
      setRideStatus('arriving');
      setActiveRide(prev => prev ? { ...prev, status: 'arriving' } : null);
      setStatusMessage("Your Auto has arrived!");
    });

    socket.on('start-ride', (data) => {
      const fixedDurationMinutes = 15;
      setRideStatus('ongoing');
      setActiveRide(prev => {
        const newRide = prev ? { ...prev, status: 'ongoing', duration: fixedDurationMinutes } : null;
        setTimer(fixedDurationMinutes * 60);
        return newRide;
      });
      setReadyToComplete(false);
      setStatusMessage("Trip in progress...");
    });

    socket.on('complete-ride', (data) => {
      setRideStatus('completed');
      setActiveRide(prev => ({
        ...(prev || {}),
        ...data,
        status: 'completed'
      }));
      setTimer(null);
      setReadyToComplete(false);
      setIsRatingOpen(true);
      setStatusMessage("Ride completed!");
      
      // Refresh trips history
      fetchTrips();
    });

    socket.on('no-drivers-available', () => {
      setIsSearching(false);
      setStatusMessage("No drivers available nearby. Please try again later.");
      setTimeout(() => setStatusMessage(null), 5000);
    });

    socket.on('receive-message', (data) => {
      if (data.toDriver === false) {
        setMessages(prev => [...prev, { ...data.message, self: false }]);
      }
    });

    socket.on('ride-cancelled', (data) => {
      setActiveRide(null);
      setRideStatus(null);
      setTimer(null);
      setReadyToComplete(false);
      setActiveTab('map');
      setStatusMessage(data.cancelledBy === 'driver' ? "Driver cancelled the ride." : "Ride cancelled.");
      setTimeout(() => setStatusMessage(null), 5000);
      fetchTrips();
    });

    fetchTrips();

    return () => {
      socket.off('ride-accepted');
      socket.off('driver-arrived');
      socket.off('start-ride');
      socket.off('complete-ride');
      socket.off('ride-cancelled');
      socket.off('receive-message');
    };
  }, [profile, searchQuery]);

  useEffect(() => {
    let interval: any;
    if (timer !== null && timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => (prev !== null && prev > 0) ? prev - 1 : 0);
      }, 1000);
    } else if (timer === 0 && !readyToComplete && (rideStatus === 'confirmed' || rideStatus === 'ongoing')) {
      setReadyToComplete(true);
      setStatusMessage("Trip is ready to complete. Tap Complete Trip when you arrive.");
    }
    return () => clearInterval(interval);
  }, [timer, rideStatus, readyToComplete]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const userId = profile?.id || profile?.uid;
    if (!userId) return;

    const updateLocationAndFetchNearby = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(async (position) => {
          const { latitude, longitude } = position.coords;
          setLocation([latitude, longitude]);

          // Update location in MongoDB
          try {
            const token = localStorage.getItem('token');
            if (!token) return;

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
              console.warn("Location update failed:", updateRes.status, errorText);
            }

            // Fetch nearby drivers count
            const response = await fetch(`/api/ride/nearby-drivers?lat=${latitude}&lng=${longitude}&radius=5`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
              const data = await response.json();
              setNearbyDriversCount(data.count || 0);
            } else {
              const errorText = await response.text();
              console.warn("Nearby drivers fetch failed:", response.status, errorText);
            }
          } catch (error) {
            console.error("Location update error:", error);
          }
        });
      }
    };

    updateLocationAndFetchNearby();
    const intervalLoc = setInterval(updateLocationAndFetchNearby, 30000); // Every 30s
    return () => clearInterval(intervalLoc);
  }, [profile]);

  const handleRecenter = () => {
    console.log("Recenter requested");
    setStatusMessage("Getting your location...");
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log("Position found:", position.coords);
          const newCoords: [number, number] = [position.coords.latitude, position.coords.longitude];
          setLocation(newCoords);
          setStatusMessage("Location updated!");
          setTimeout(() => setStatusMessage(null), 2000);
        },
        (error) => {
          console.error("Geolocation error:", error);
          setStatusMessage("Location access denied. Using default.");
          // Fallback to a random offset from default to show "something happened"
          const fallback: [number, number] = [51.505 + (Math.random() - 0.5) * 0.01, -0.09 + (Math.random() - 0.5) * 0.01];
          setLocation(fallback);
          setTimeout(() => setStatusMessage(null), 3000);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      setStatusMessage("Geolocation not supported.");
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleFindRide = async () => {
    if (!searchQuery.trim()) {
      setStatusMessage("Please enter a destination");
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }
    
    setIsSearching(true);
    setStatusMessage(`Searching for drivers near ${searchQuery}...`);
    setRideOptions(null);
    setSelectedRide(null);
    
    try {
      // Fetch actual online drivers from MongoDB via our new API
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/ride/nearby-drivers?lat=${location[0]}&lng=${location[1]}&radius=5`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch drivers: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const onlineDrivers = data.drivers || [];

      // Simulate finding rides with actual drivers
      setTimeout(() => {
        setIsSearching(false);
        setStatusMessage(null);
        
        const randomPrice = (base: number) => `₹${Math.floor(base + Math.random() * 30)}`;
        const randomTime = () => `${Math.floor(Math.random() * 5 + 1)} min`;
        const randomDistance = () => `${(Math.random() * 5 + 1).toFixed(1)} km`;

        if (onlineDrivers.length > 0) {
          setSelectedRide(null);
          setRideOptions(onlineDrivers.map((driver: any) => ({
            id: driver._id,
            name: 'GORIDE Auto',
            price: '₹83',
            time: '5 min',
            distance: '5.0 km',
            icon: <Car className="w-6 h-6" />,
            desc: `Auto • ${driver.displayName} • 5.0 km`,
            driverData: {
              driverId: driver._id,
              ...driver
            }
          })));
        } else {
          setStatusMessage("No registered drivers are currently online near you.");
          setTimeout(() => setStatusMessage(null), 5000);
          setRideOptions([]);
        }
      }, 1500);
    } catch (error) {
      console.error("Error fetching drivers:", error);
      setIsSearching(false);
      setStatusMessage("Error finding drivers. Try again.");
    }
  };

  const handleCancelRide = async () => {
    if (!activeRide) return;
    if (!cancellationReason.trim()) {
      alert("Please provide a reason for cancellation");
      return;
    }
    const userId = profile?.id || profile?.uid;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/ride/cancel/${activeRide.rideId || activeRide._id}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          reason: cancellationReason,
          cancelledBy: 'user'
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.warn("Cancel ride failed:", response.status, errorText);
      }
      
      socket.emit('cancel-ride', { 
        rideId: activeRide.rideId || activeRide._id, 
        userId: userId,
        cancelledBy: 'user',
        reason: cancellationReason
      });
      
      setIsCancelModalOpen(false);
      setCancellationReason('');
      setActiveRide(null);
      setRideStatus(null);
      setTimer(null);
      setReadyToComplete(false);
      setStatusMessage("Ride cancelled.");
      setTimeout(() => setStatusMessage(null), 3000);
      setActiveTab('map');
      fetchTrips();
    } catch (error) {
      console.error("Error cancelling ride:", error);
    }
  };

  const handleCompleteRide = async () => {
    if (!activeRide) return;
    socket.emit('complete-ride', { 
      rideId: activeRide.rideId || activeRide._id, 
      userId: profile?.id || profile?.uid 
    });
    setTimer(null);
    setReadyToComplete(false);
  };

  const handleSubmitRating = async () => {
    const rideId = activeRide?.rideId || activeRide?._id;
    if (!rideId) {
      console.warn("Cannot submit rating: No ride ID found");
      setIsRatingOpen(false);
      setActiveRide(null);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/ride/rate/${rideId}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ rating, feedback })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn("Rating submission failed:", response.status, errorText);
      }

      setIsRatingOpen(false);
      setActiveRide(null);
      setRideStatus(null);
      setRating(0);
      setFeedback('');
      fetchTrips();
      setActiveTab('map');
      setStatusMessage("Thank you for your feedback!");
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (error) {
      console.error("Error submitting rating:", error);
    }
  };

  const handleAddMoney = async () => {
    const amount = parseFloat(addAmount);
    if (isNaN(amount) || amount <= 0) {
      setStatusMessage("Please enter a valid amount");
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }

    setIsProcessingPayment(true);
    const userId = profile?.id || profile?.uid;

    try {
      if (userId) {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/auth/add-funds', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ amount })
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to add funds');
        }

        setIsAddMoneyOpen(false);
        setAddAmount('');
        setStatusMessage(`Successfully added ₹${amount} to your balance!`);
        setTimeout(() => setStatusMessage(null), 3000);
        
        // Refresh profile to show new balance
        window.location.reload();
      }
    } catch (error: any) {
      console.error("Error adding money:", error);
      setStatusMessage(error.message || "Payment failed. Please try again.");
      setTimeout(() => setStatusMessage(null), 3000);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleBookRide = () => {
    if (!selectedRide) {
      setStatusMessage("Please select a driver");
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }
    const ride = rideOptions?.find(r => r.id === selectedRide);
    if (!ride) return;

    const fareAmount = parseFloat(ride.price.replace('₹', ''));
    
    // Simulate destination coords for demo
    const destLat = location[0] + (Math.random() - 0.5) * 0.05;
    const destLng = location[1] + (Math.random() - 0.5) * 0.05;

    const rideData = {
      userId: profile?.id || profile?.uid,
      userName: profile?.displayName,
      pickup: { address: 'Current Location', lat: location[0], lng: location[1] },
      dropoff: { address: searchQuery, lat: destLat, lng: destLng },
      rideType: ride.name,
      fare: ride.price,
      duration: 15,
      targetDriverId: ride.driverData?.driverId // Target specific driver if available
    };

    // Connect socket and emit ride request
    socket.connect();
    socket.emit('ride-request', rideData);

    // Set active ride immediately for confirmation page
    setActiveRide({
      ...rideData,
      status: 'searching',
      driverName: ride.driverData?.displayName || 'Searching...',
      vehicleInfo: { 
        model: ride.driverData?.vehicleInfo?.model || 'GORIDE Auto', 
        plateNumber: ride.driverData?.vehicleInfo?.plateNumber || 'Wait...' 
      },
      otp: 'WAIT'
    });
    setRideStatus('requesting');
    setTimer(null);
    setReadyToComplete(false);

    // Simulate riders at destination
    const destRiders: [number, number][] = Array.from({ length: 5 }).map(() => [
      location[0] + (Math.random() - 0.5) * 0.02,
      location[1] + (Math.random() - 0.5) * 0.02
    ]);
    setDestinationRiders(destRiders);
  };

  const sendMessage = () => {
    if (!chatMessage.trim()) return;
    const msg = { text: chatMessage, sender: 'user', timestamp: new Date().toISOString() };
    socket.emit('send-message', { userId: profile?.id || profile?.uid, message: msg, toDriver: true });
    setMessages(prev => [...prev, { ...msg, self: true }]);
    setChatMessage('');
  };

  const submitRating = () => {
    alert(`Thank you for your ${rating} star rating!`);
    setIsRatingOpen(false);
    setActiveRide(null);
    setRideStatus(null);
    setOtp(null);
    setMessages([]);
    setRating(0);
  };

  useEffect(() => {
    // Fix for Leaflet marker icons
    const markerIcon = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
    const markerShadow = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

    const DefaultIcon = L.icon({
      iconUrl: markerIcon,
      shadowUrl: markerShadow,
      iconSize: [25, 41],
      iconAnchor: [12, 41]
    });

    L.Marker.prototype.options.icon = DefaultIcon;

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        setLocation([position.coords.latitude, position.coords.longitude]);
      });
    }
  }, []);

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden">
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="absolute inset-0 bg-black/40 z-[2000]"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-0 left-0 bottom-0 w-[280px] bg-white z-[2001] shadow-2xl flex flex-col"
            >
              <div className="p-6 bg-slate-900 text-white">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center overflow-hidden border-2 border-white/20">
                    {profile?.photoURL ? (
                      <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-white" />
                    )}
                  </div>
                  <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <h3 className="text-lg font-bold">{profile?.displayName || 'User'}</h3>
                <p className="text-slate-400 text-sm">{profile?.email}</p>
              </div>

              <div className="flex-1 py-4 overflow-y-auto">
                <SidebarItem 
                  icon={<MapPin className="w-5 h-5" />} 
                  label="Map" 
                  active={activeTab === 'map'} 
                  onClick={() => { setActiveTab('map'); setIsSidebarOpen(false); }} 
                />
                <SidebarItem 
                  icon={<Clock className="w-5 h-5" />} 
                  label="Your Trips" 
                  active={activeTab === 'trips'} 
                  onClick={() => { setActiveTab('trips'); setIsSidebarOpen(false); }} 
                />
                <SidebarItem 
                  icon={<CreditCard className="w-5 h-5" />} 
                  label="Payment" 
                  active={activeTab === 'payment'} 
                  onClick={() => { setActiveTab('payment'); setIsSidebarOpen(false); }} 
                />
                <SidebarItem 
                  icon={<Shield className="w-5 h-5" />} 
                  label="Safety" 
                  active={activeTab === 'safety'} 
                  onClick={() => { setActiveTab('safety'); setIsSidebarOpen(false); }} 
                />
                <SidebarItem 
                  icon={<Settings className="w-5 h-5" />} 
                  label="Settings" 
                  active={activeTab === 'settings'} 
                  onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }} 
                />
                <SidebarItem 
                  icon={<HelpCircle className="w-5 h-5" />} 
                  label="Support" 
                  active={activeTab === 'support'} 
                  onClick={() => { setActiveTab('support'); setIsSidebarOpen(false); }} 
                />
              </div>

              <div className="p-4 border-t border-slate-100">
                <button 
                  onClick={logout}
                  className="w-full flex items-center gap-3 p-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium"
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
      <div className="absolute top-0 left-0 right-0 z-[1000] p-4 flex justify-between items-center pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-slate-700 hover:bg-slate-50 active:scale-95 transition-transform"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-black text-slate-900 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg">Texi-Booking-App</h1>
        </div>
        
        {statusMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white px-4 py-2 rounded-full text-xs font-medium shadow-xl pointer-events-none whitespace-nowrap"
          >
            {statusMessage}
          </motion.div>
        )}

        <div className="relative pointer-events-auto">
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-3 bg-white p-1 pr-4 rounded-full shadow-lg hover:bg-slate-50 active:scale-95 transition-transform"
          >
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-6 h-6 text-blue-600" />
              )}
            </div>
            <span className="text-sm font-semibold text-slate-800">{profile?.displayName?.split(' ')[0] || 'User'}</span>
          </button>

          <AnimatePresence>
            {isProfileOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-[1001]"
              >
                <div className="px-4 py-2 border-bottom border-slate-50 mb-1">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Account</p>
                </div>
                <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                  <User className="w-4 h-4" />
                  Profile
                </button>
                <button 
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative w-full max-w-screen-2xl mx-auto">
        {activeTab === 'map' ? (
          <>
            {/* Map */}
            <div className="absolute inset-0">
              <MapContainer center={location} zoom={13} zoomControl={false} className="h-full w-full">
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <Marker position={location}>
                  <Popup>You are here</Popup>
                </Marker>
                {activeRide && (
                  <Marker position={[location[0] + 0.005, location[1] + 0.005]} icon={L.icon({
                    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3001/3001764.png',
                    iconSize: [32, 32],
                    iconAnchor: [16, 32]
                  })}>
                    <Popup>Driver is here</Popup>
                  </Marker>
                )}
                {destinationRiders.map((pos, i) => (
                  <Marker key={i} position={pos} icon={L.icon({
                    iconUrl: 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png',
                    iconSize: [24, 24],
                    iconAnchor: [12, 24]
                  })}>
                    <Popup>Rider nearby</Popup>
                  </Marker>
                ))}
                <RecenterMap coords={location} />
              </MapContainer>
            </div>

            {/* Ride Confirmation Page */}
            <AnimatePresence>
              {activeRide && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="fixed inset-0 z-[9999] bg-white flex flex-col"
                >
                  <div className="flex-1 flex flex-col h-full overflow-hidden">
                    {/* Header */}
                    <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-white">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">RIDE CONFIRMATION</p>
                        <h2 className="text-3xl font-black text-slate-900">Driver & fare details</h2>
                      </div>
                    <div className="flex gap-3">
                      <Button 
                        variant="outline" 
                        className="h-12 px-6 rounded-2xl border-slate-100 text-slate-600 font-bold"
                        onClick={() => {
                          if (rideStatus === 'completed' || rideStatus === 'requesting') {
                            setActiveRide(null);
                            setRideStatus(null);
                          } else {
                            setActiveRide(null); // Just close the view, don't cancel yet
                          }
                        }}
                      >
                        Close
                      </Button>
                      {(rideStatus === 'requesting' || rideStatus === 'confirmed' || rideStatus === 'arriving') && (
                        <Button 
                          className="h-12 px-6 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold border-none shadow-lg shadow-red-500/20 disabled:opacity-50"
                          onClick={() => setIsCancelModalOpen(true)}
                          disabled={rideStatus === 'completed' || rideStatus === 'ongoing'}
                        >
                          Cancel Ride
                        </Button>
                      )}
                      {((rideStatus === 'ongoing' || rideStatus === 'confirmed') && timer !== null && timer > 0) && (
                        <div className="flex items-center rounded-2xl bg-orange-50 border border-orange-100 px-4 py-3 text-orange-700 text-sm font-semibold">
                          <span className="mr-2">Trip ready to complete in</span>
                          <span>{formatTimer(timer)}</span>
                        </div>
                      )}
                      {readyToComplete && (rideStatus === 'ongoing' || rideStatus === 'confirmed') && (
                        <Button 
                          className="h-12 px-6 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-bold border-none shadow-lg shadow-green-500/20 disabled:opacity-50"
                          onClick={handleCompleteRide}
                          disabled={!activeRide?.rideId && !activeRide?._id}
                        >
                          Complete Trip
                        </Button>
                      )}
                    </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
                      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Left Column */}
                        <div className="space-y-6">
                          {/* Driver Profile */}
                          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-8">
                            <div className="w-24 h-24 rounded-[2rem] bg-blue-600 flex items-center justify-center text-white text-4xl font-black shadow-lg shadow-blue-500/20 overflow-hidden">
                              {activeRide.driverPhoto ? (
                                <img src={activeRide.driverPhoto} alt="Driver" className="w-full h-full object-cover" />
                              ) : (
                                activeRide.driverName?.charAt(0).toUpperCase() || 'P'
                              )}
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">DRIVER</p>
                              <h3 className="text-4xl font-black text-slate-900 mb-1">{activeRide.driverName || 'Piya'}</h3>
                              <p className="text-base font-medium text-slate-500">{activeRide.vehicleInfo?.model || 'GORIDE Auto'} • {activeRide.vehicleInfo?.plateNumber || 'Unknown plate'}</p>
                            </div>
                          </div>

                          {/* Stats Grid */}
                          <div className="grid grid-cols-3 gap-6">
                            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">FARE</p>
                              <p className="text-4xl font-black text-slate-900">₹76</p>
                            </div>
                            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">STATUS</p>
                              <p className={`text-xl font-black capitalize ${rideStatus === 'completed' ? 'text-green-600' : 'text-slate-900'}`}>{rideStatus || 'Searching'}</p>
                            </div>
                            {timer !== null && (
                              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">FINISH IN</p>
                                <p className="text-xl font-black text-blue-600 font-mono">{formatTimer(timer)}</p>
                              </div>
                            )}
                            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">PAY CODE</p>
                              <p className="text-4xl font-black text-slate-900 tracking-widest">
                                {rideStatus === 'completed' ? '---' : (otp || 'WAIT')}
                              </p>
                            </div>
                          </div>

                          {/* Trip Status Message */}
                          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                            <h4 className="text-xl font-bold text-slate-900 mb-4">Trip status</h4>
                            <p className="text-slate-500 text-lg leading-relaxed">
                              {rideStatus === 'requesting' && "Your ride request is live. Once a driver accepts, your verification code will be ready and the map will update with driver location."}
                              {rideStatus === 'confirmed' && "Driver has accepted your ride! They are on their way to your location."}
                              {rideStatus === 'arriving' && "Your driver has arrived at the pickup location. Share the Pay Code to start the trip."}
                              {rideStatus === 'ongoing' && "Enjoy your trip! You can complete the ride once you reach your destination."}
                              {rideStatus === 'completed' && "Ride completed successfully. We hope you had a great experience!"}
                            </p>
                          </div>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-8">
                          {/* Route Card */}
                          <div className="bg-slate-900 p-10 rounded-[2.5rem] text-white shadow-2xl">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">RIDE ROUTE</p>
                            <p className="text-xl font-bold">Current Location → {searchQuery || 'vfcd'}</p>
                          </div>

                          {/* Map Card */}
                          <div className="h-[400px] rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-xl relative">
                            <MapContainer center={location} zoom={15} className="h-full w-full z-0" zoomControl={false}>
                              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                              <Marker position={location} />
                              <RecenterMap coords={location} />
                            </MapContainer>
                            <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-xl text-xs text-slate-500 z-[1000]">
                              Leaflet | © OpenStreetMap
                            </div>
                          </div>

                          {/* Driver Contact Card */}
                          <div className="bg-slate-50 p-10 rounded-[2.5rem] border border-slate-100">
                            <div className="flex items-center gap-6 mb-6">
                              <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600">
                                <Phone className="w-8 h-8" />
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">DRIVER CONTACT</p>
                                <h4 className="text-2xl font-bold text-slate-900">{activeRide.driverName || 'Piya'}</h4>
                              </div>
                            </div>
                            <p className="text-base text-slate-500 leading-relaxed">
                              Share the verification code with your driver when they arrive, then pay after the trip via the app.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Booking Panel */}
            {!activeRide && rideStatus !== 'requesting' && (
              <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] p-6 z-[1000] max-h-[80vh] overflow-y-auto w-full max-w-md mx-auto md:left-6 md:right-auto md:bottom-6 md:rounded-3xl md:max-h-[calc(100vh-100px)]">
                {!rideOptions ? (
                <>
                  <div className="mb-6">
                    <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-2xl border border-blue-100 mb-6">
                      <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                        <Car className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{nearbyDriversCount} Drivers Nearby</p>
                        <p className="text-xs text-slate-500">Ready to pick you up in minutes</p>
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-4">Where to?</h3>
                    <div className="space-y-4">
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-500" />
                        <button 
                          onClick={handleRecenter}
                          className="w-full h-12 pl-10 pr-4 bg-slate-50 border border-slate-100 rounded-xl text-sm text-left text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          Your current location
                        </button>
                      </div>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-teal-500" />
                        <input 
                          className="w-full h-12 pl-10 pr-4 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          placeholder="Enter destination"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button 
                      className="flex-1 bg-blue-600 hover:bg-blue-700 h-14 rounded-2xl shadow-lg shadow-blue-500/20"
                      onClick={handleFindRide}
                      disabled={isSearching}
                    >
                      {isSearching ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Searching...
                        </div>
                      ) : 'Find a Ride'}
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-14 h-14 rounded-2xl border-slate-200"
                      onClick={logout}
                    >
                      <LogOut className="w-5 h-5 text-slate-600" />
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-bold text-slate-900">Choose a ride</h3>
                    <button 
                      onClick={() => setRideOptions(null)}
                      className="text-sm text-blue-600 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                  
                  {rideOptions.length === 0 ? (
                    <div className="space-y-4 rounded-3xl border border-slate-100 bg-slate-50 p-6 text-center">
                      <p className="text-sm font-semibold text-slate-900">No drivers found</p>
                      <p className="text-sm text-slate-500">We couldn't find any drivers nearby right now. Please try again or change your destination.</p>
                      <Button 
                        className="w-full bg-blue-600 hover:bg-blue-700 h-14 rounded-2xl shadow-lg shadow-blue-500/20"
                        onClick={() => {
                          setRideOptions(null);
                          setSelectedRide(null);
                        }}
                      >
                        Search Again
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {rideOptions.map((ride) => (
                          <button
                            key={ride.id}
                            onClick={() => setSelectedRide(ride.id)}
                            className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                              selectedRide === ride.id 
                                ? 'border-blue-600 bg-blue-50' 
                                : 'border-slate-100 hover:border-slate-200'
                            }`}
                          >
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                              selectedRide === ride.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {ride.icon}
                            </div>
                            <div className="flex-1 text-left">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-900">{ride.name}</span>
                                <span className="font-bold text-slate-900">{ride.price}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-500">{ride.desc} • {ride.distance}</span>
                                <span className="text-xs text-blue-600 font-medium">{ride.time}</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>

                      <Button 
                        className="w-full bg-blue-600 hover:bg-blue-700 h-14 rounded-2xl shadow-lg shadow-blue-500/20 mt-4"
                        onClick={handleBookRide}
                        disabled={!selectedRide}
                      >
                        Confirm {rideOptions.find(r => r.id === selectedRide)?.name || 'Ride'}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
          <div className="flex-1 bg-slate-50 p-6 pt-24 overflow-y-auto pb-12">
            <div className="max-w-md mx-auto">
              <div className="flex items-center gap-4 mb-8">
                <button 
                  onClick={() => setActiveTab('map')}
                  className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
                <h2 className="text-2xl font-bold text-slate-900 capitalize">{activeTab.replace('-', ' ')}</h2>
              </div>

              {activeTab === 'trips' && (
                <div className="space-y-4">
                  {trips.length > 0 ? trips.map(trip => (
                    <div key={trip._id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-xs font-medium text-slate-400 uppercase">
                          {new Date(trip.createdAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-sm font-bold text-slate-900">₹{trip.fare}</span>
                      </div>
                      {trip.driverId && (
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden">
                            {trip.driverId.photoURL ? (
                              <img src={trip.driverId.photoURL} alt="Driver" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <p className="text-xs font-medium text-slate-600">{trip.driverId.displayName}</p>
                        </div>
                      )}
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="text-sm text-slate-700 truncate">{trip.pickup.address}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-teal-500" />
                          <span className="text-sm text-slate-700 truncate">{trip.dropoff.address}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-slate-50">
                        <div className="flex flex-col gap-1 w-full">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                              trip.status === 'completed' ? 'bg-green-50 text-green-600' :
                              trip.status === 'cancelled' ? 'bg-red-50 text-red-600' :
                              'bg-blue-50 text-blue-600'
                            }`}>
                              {trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}
                            </span>
                            {trip.rating > 0 && (
                              <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-md">
                                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                <span className="text-[10px] font-bold text-yellow-700">{trip.rating}</span>
                              </div>
                            )}
                          </div>
                          {trip.status === 'cancelled' && trip.cancellationReason && (
                            <p className="text-[10px] text-red-500 italic mt-1 font-medium bg-red-50/50 p-2 rounded-lg border border-red-100/50">
                              Reason: {trip.cancellationReason}
                              {trip.cancelledBy && <span className="ml-1 opacity-60">(by {trip.cancelledBy})</span>}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="py-20 text-center">
                      <Clock className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                      <p className="text-slate-500">No trips yet. Book your first ride!</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'payment' && (
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 rounded-3xl text-white shadow-lg">
                    <p className="text-blue-100 text-sm mb-1">GORIDE Balance</p>
                    <h3 className="text-3xl font-bold mb-6">₹{profile?.balance?.toFixed(2) || '0.00'}</h3>
                    <Button 
                      className="w-full bg-white/20 hover:bg-white/30 border-none text-white"
                      onClick={() => setIsAddMoneyOpen(true)}
                    >
                      Add Funds
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-slate-900 px-1">Payment Methods</h4>
                    <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-50">
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 font-bold">C</div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">Cash</p>
                            <p className="text-xs text-slate-500">Default</p>
                          </div>
                        </div>
                        <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-white" />
                        </div>
                      </div>
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 font-bold">V</div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">Visa •••• 4242</p>
                            <p className="text-xs text-slate-500">Expires 12/26</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button className="w-full py-3 text-blue-600 text-sm font-bold">+ Add Payment Method</button>
                  </div>
                </div>
              )}

              {activeTab === 'safety' && (
                <div className="space-y-6">
                  <div className="bg-red-50 p-6 rounded-3xl border border-red-100 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Shield className="w-8 h-8 text-red-600" />
                    </div>
                    <h3 className="text-xl font-bold text-red-900 mb-2">Safety Toolkit</h3>
                    <p className="text-sm text-red-700 leading-relaxed">Your safety is our priority. Access tools to stay safe during your journey.</p>
                  </div>

                  <div className="space-y-3">
                    <button className="w-full flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-600">
                          <Phone className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-slate-900">Emergency Assistance</p>
                          <p className="text-xs text-slate-500">Call local authorities</p>
                        </div>
                      </div>
                      <Zap className="w-4 h-4 text-slate-300" />
                    </button>
                    <button className="w-full flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                          <Users className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-slate-900">Share Trip Status</p>
                          <p className="text-xs text-slate-500">Let friends track your ride</p>
                        </div>
                      </div>
                      <Zap className="w-4 h-4 text-slate-300" />
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 p-4 bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
                      {profile?.photoURL ? (
                        <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-8 h-8 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{profile?.displayName}</h3>
                      <p className="text-sm text-slate-500">{profile?.email}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-slate-900 px-1">Account Settings</h4>
                    <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-50">
                      <button 
                        onClick={() => {
                          const url = prompt("Enter profile photo URL:", profile?.photoURL || "");
                          if (url !== null) {
                            const token = localStorage.getItem('token');
                            fetch('/api/auth/update-profile', {
                              method: 'POST',
                              headers: { 
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}` 
                              },
                              body: JSON.stringify({ photoURL: url })
                            }).then(() => window.location.reload());
                          }
                        }}
                        className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <User className="w-5 h-5 text-slate-400" />
                          <span className="text-sm font-medium text-slate-700">Update Profile Photo</span>
                        </div>
                        <Plus className="w-4 h-4 text-slate-300" />
                      </button>
                      <button className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <User className="w-5 h-5 text-slate-400" />
                          <span className="text-sm font-medium text-slate-700">Edit Profile</span>
                        </div>
                        <Clock className="w-4 h-4 text-slate-300" />
                      </button>
                      <button className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <MapPin className="w-5 h-5 text-slate-400" />
                          <span className="text-sm font-medium text-slate-700">Saved Places</span>
                        </div>
                        <Clock className="w-4 h-4 text-slate-300" />
                      </button>
                      <button className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Shield className="w-5 h-5 text-slate-400" />
                          <span className="text-sm font-medium text-slate-700">Privacy & Data</span>
                        </div>
                        <Clock className="w-4 h-4 text-slate-300" />
                      </button>
                    </div>
                  </div>

                  <Button 
                    variant="outline" 
                    className="w-full border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={logout}
                  >
                    Logout
                  </Button>
                </div>
              )}

              {activeTab === 'support' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <h3 className="text-xl font-bold text-slate-900 mb-6">Help Center</h3>
                    <div className="space-y-4">
                      {[
                        { q: 'I lost an item', a: 'Contact your driver or our support team to retrieve lost belongings.' },
                        { q: 'Payment issues', a: 'Check your transaction history or contact us for billing discrepancies.' },
                        { q: 'Report a safety issue', a: 'Your safety is paramount. Report any incidents immediately.' },
                        { q: 'Account help', a: 'Manage your profile, payment methods, and notification settings.' }
                      ].map((faq, i) => (
                        <div key={i} className="p-4 bg-slate-50 rounded-2xl">
                          <p className="font-bold text-sm text-slate-900 mb-1">{faq.q}</p>
                          <p className="text-xs text-slate-500 leading-relaxed">{faq.a}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button className="flex flex-col items-center gap-2 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:bg-slate-50 transition-colors">
                      <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                        <Phone className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold text-slate-900">Call Us</span>
                    </button>
                    <button className="flex flex-col items-center gap-2 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:bg-slate-50 transition-colors">
                      <div className="w-12 h-12 bg-teal-50 rounded-2xl flex items-center justify-center text-teal-600">
                        <HelpCircle className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold text-slate-900">Live Chat</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Add Money Modal */}
      <AnimatePresence>
        {isAddMoneyOpen && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddMoneyOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                  <Wallet className="w-6 h-6" />
                </div>
                <button onClick={() => setIsAddMoneyOpen(false)} className="p-2 hover:bg-slate-50 rounded-full">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <h3 className="text-2xl font-bold text-slate-900 mb-2">Add Funds</h3>
              <p className="text-slate-500 mb-8">Enter the amount you want to add to your GORIDE wallet.</p>

              <div className="space-y-6">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">₹</span>
                  <Input 
                    type="number"
                    placeholder="0.00"
                    className="pl-10 h-16 text-2xl font-bold rounded-2xl border-slate-100 focus:border-blue-500"
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {['100', '500', '1000'].map(amount => (
                    <button 
                      key={amount}
                      onClick={() => setAddAmount(amount)}
                      className="py-3 rounded-xl border border-slate-100 text-sm font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 transition-all"
                    >
                      +₹{amount}
                    </button>
                  ))}
                </div>

                <Button 
                  className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-lg font-bold shadow-lg shadow-blue-500/20"
                  onClick={handleAddMoney}
                  disabled={isProcessingPayment || !addAmount}
                >
                  {isProcessingPayment ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </div>
                  ) : 'Confirm Payment'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Chat Modal */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white z-[4000] flex flex-col"
          >
            <div className="p-4 flex items-center gap-4 border-b border-slate-100 bg-white">
              <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl">
                <X className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">{activeRide?.driverName}</h4>
                  <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest">Online</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.self ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${
                    msg.self ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none'
                  }`}>
                    {msg.text}
                    <p className={`text-[8px] mt-1 opacity-60 ${msg.self ? 'text-right' : 'text-left'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
                  <MessageSquare className="w-12 h-12 opacity-20" />
                  <p className="text-sm">No messages yet. Say hello!</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-white border-t border-slate-100 flex gap-3">
              <input 
                type="text" 
                placeholder="Type a message..." 
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                className="flex-1 h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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

      {/* Rating Modal */}
      <AnimatePresence>
        {isRatingOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10001] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-sm bg-white rounded-[2.5rem] p-8 text-center shadow-2xl"
            >
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Star className="w-10 h-10 text-blue-600 fill-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">How was your ride?</h3>
              <p className="text-sm text-slate-500 mb-8">Rate your experience with {activeRide?.driverName}</p>
              
              <div className="flex justify-center gap-2 mb-6">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button 
                    key={s} 
                    onClick={() => setRating(s)}
                    className="p-1 transition-transform active:scale-90"
                  >
                    <Star className={`w-10 h-10 ${rating >= s ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`} />
                  </button>
                ))}
              </div>

              <div className="mb-6">
                <textarea
                  className="w-full h-20 p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-900 focus:border-blue-500 outline-none resize-none transition-all"
                  placeholder="Share your feedback (optional)..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                />
              </div>

              <div className="space-y-3">
                <Button 
                  onClick={handleSubmitRating}
                  disabled={rating === 0}
                  className="w-full bg-blue-600 hover:bg-blue-700 h-14 rounded-2xl font-bold"
                >
                  Submit Rating
                </Button>
                <button 
                  onClick={() => {
                    setIsRatingOpen(false);
                    setActiveRide(null);
                    setRideStatus(null);
                    setOtp(null);
                    setMessages([]);
                    setRating(0);
                    setFeedback('');
                    setActiveTab('map');
                  }}
                  className="text-sm font-bold text-slate-400 hover:text-slate-600"
                >
                  Skip for now
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Cancellation Modal */}
      <AnimatePresence>
        {isCancelModalOpen && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-8 border border-slate-100 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-slate-900">Cancel Ride</h3>
                <button 
                  onClick={() => {
                    setIsCancelModalOpen(false);
                    setCancellationReason('');
                  }} 
                  className="p-2 hover:bg-slate-50 rounded-xl"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Reason for cancellation</label>
                  <select 
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm text-slate-900 focus:border-blue-500 outline-none transition-all"
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                  >
                    <option value="">Select a reason...</option>
                    <option value="Driver took too long">Driver took too long</option>
                    <option value="Changed my mind">Changed my mind</option>
                    <option value="Wrong pickup location">Wrong pickup location</option>
                    <option value="Emergency situation">Emergency situation</option>
                    <option value="Found alternative transport">Found alternative transport</option>
                    <option value="Driver behavior">Driver behavior</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="flex gap-4">
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setIsCancelModalOpen(false);
                      setCancellationReason('');
                    }}
                    className="flex-1 h-14 rounded-2xl font-bold border-slate-100 text-slate-600"
                  >
                    Keep Ride
                  </Button>
                  <Button 
                    onClick={handleCancelRide}
                    className="flex-1 h-14 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold border-none"
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
