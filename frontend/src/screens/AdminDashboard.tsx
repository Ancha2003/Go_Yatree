import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Car, MapPin, DollarSign, Settings, 
  ShieldCheck, AlertTriangle, Search, Filter,
  MoreVertical, CheckCircle, XCircle, Eye,
  TrendingUp, Activity, PieChart, LayoutDashboard,
  Clock, Navigation, CreditCard, Phone, Mail
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { Button } from '../components/Button';
import { socket } from '../lib/socket';

const AdminStat = ({ label, value, icon, trend, color }: any) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
    <div className="flex justify-between items-start mb-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      {trend && (
        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${trend > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <p className="text-slate-500 text-sm font-medium mb-1">{label}</p>
    <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
  </div>
);

export const AdminDashboard = () => {
  const { profile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'drivers' | 'rides' | 'settings'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [rides, setRides] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [stats, setStats] = useState<any>({
    totalUsers: 0,
    totalDrivers: 0,
    totalRevenue: 0,
    totalProfit: 0,
    activeRides: 0
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'user' | 'driver'>('user');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [selectedRide, setSelectedRide] = useState<any>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancellingRideId, setCancellingRideId] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterDriver, setFilterDriver] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [config, setConfig] = useState<any>({
    baseFare: 50,
    minimumFare: 60,
    perKmRate: 15,
    perMinuteRate: 2
  });
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    phoneNumber: '',
    role: 'user',
    vehicleInfo: { model: '', plateNumber: '', color: '', type: 'Auto' }
  });

  const filteredRides = rides.filter(r => {
    const matchesSearch = 
      r.userId?.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.driverId?.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r._id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    const matchesUser = filterUser === 'all' || r.userId?._id === filterUser;
    const matchesDriver = filterDriver === 'all' || r.driverId?._id === filterDriver;
    
    const rideDate = new Date(r.createdAt);
    const matchesStart = !dateRange.start || rideDate >= new Date(dateRange.start + 'T00:00:00');
    const matchesEnd = !dateRange.end || rideDate <= new Date(dateRange.end + 'T23:59:59');
    
    return matchesSearch && matchesStatus && matchesStart && matchesEnd && matchesUser && matchesDriver;
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const [ridesRes, usersRes, driversRes, configRes, statsRes] = await Promise.all([
        fetch('/api/admin/rides', { headers }),
        fetch('/api/admin/users', { headers }),
        fetch('/api/admin/drivers', { headers }),
        fetch('/api/admin/config', { headers }),
        fetch('/api/admin/stats', { headers })
      ]);

      if (ridesRes.ok) setRides(await ridesRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
      if (driversRes.ok) setDrivers(await driversRes.json());
      if (configRes.ok) setConfig(await configRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (error) {
      console.error("Error fetching admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Socket setup
    socket.connect();
    socket.emit('join-admin');

    socket.on('ride-updated', (updatedRide) => {
      setRides(prevRides => {
        const index = prevRides.findIndex(r => r._id === updatedRide._id);
        if (index !== -1) {
          // Update existing ride
          const newRides = [...prevRides];
          newRides[index] = updatedRide;
          return newRides;
        } else {
          // Add new ride if it doesn't exist yet
          return [updatedRide, ...prevRides];
        }
      });

      // Update selected ride if it's the one being updated
      setSelectedRide(prev => prev?._id === updatedRide._id ? updatedRide : prev);
    });

    const handleResize = () => {
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      socket.off('ride-updated');
      socket.disconnect();
    };
  }, []);

  const handleToggleActive = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/toggle-active/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) fetchData();
    } catch (error) {
      console.error("Error toggling status:", error);
    }
  };

  const handleVerifyDriver = async (id: string, isVerified: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/verify-driver/${id}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ isVerified })
      });
      if (response.ok) fetchData();
    } catch (error) {
      console.error("Error verifying driver:", error);
    }
  };

  const handleUpdateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(config)
      });
      if (response.ok) {
        alert("Configuration updated successfully!");
        fetchData();
      }
    } catch (error) {
      console.error("Error updating config:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) fetchData();
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const url = editingItem ? `/api/admin/users/${editingItem._id}` : '/api/admin/users';
      const method = editingItem ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ ...formData, role: modalType })
      });

      if (response.ok) {
        setIsModalOpen(false);
        setEditingItem(null);
        fetchData();
      }
    } catch (error) {
      console.error("Error saving user:", error);
    }
  };

  const handleCancelRide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingRideId) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/ride/cancel/${cancellingRideId}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ reason: cancellationReason, cancelledBy: 'admin' })
      });

      if (response.ok) {
        setIsCancelModalOpen(false);
        setCancellingRideId(null);
        setCancellationReason('');
        fetchData();
      }
    } catch (error) {
      console.error("Error cancelling ride:", error);
    }
  };

  const openCancelModal = (rideId: string) => {
    setCancellingRideId(rideId);
    setCancellationReason('');
    setIsCancelModalOpen(true);
  };

  const openModal = (type: 'user' | 'driver', item: any = null) => {
    setModalType(type);
    setEditingItem(item);
    if (item) {
      setFormData({
        displayName: item.displayName,
        email: item.email,
        password: '',
        phoneNumber: item.phoneNumber,
        role: item.role,
        vehicleInfo: item.vehicleInfo || { model: '', plateNumber: '', color: '', type: 'Auto' }
      });
    } else {
      setFormData({
        displayName: '',
        email: '',
        password: '',
        phoneNumber: '',
        role: type,
        vehicleInfo: { model: '', plateNumber: '', color: '', type: 'Auto' }
      });
    }
    setIsModalOpen(true);
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'users', label: 'Users', icon: <Users className="w-5 h-5" /> },
    { id: 'drivers', label: 'Drivers', icon: <Car className="w-5 h-5" /> },
    { id: 'rides', label: 'Rides', icon: <MapPin className="w-5 h-5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden w-full relative">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && window.innerWidth < 768 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.div 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? 280 : (window.innerWidth < 768 ? 0 : 72),
          x: (window.innerWidth < 768 && !isSidebarOpen) ? -280 : 0
        }}
        className={`bg-white border-r border-slate-100 flex flex-col shrink-0 overflow-hidden z-40 h-full ${window.innerWidth < 768 ? 'fixed' : 'relative'}`}
      >
        <div className="p-6 flex-1">
          <div className="flex items-center gap-3 mb-8 overflow-hidden">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20 shrink-0">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            {isSidebarOpen && (
              <motion.h1 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xl font-bold text-slate-900 tracking-tight whitespace-nowrap"
              >
                 Go Yatree Admin
              </motion.h1>
            )}
          </div>

          <nav className="space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  activeTab === tab.id 
                    ? 'bg-blue-50 text-blue-600 font-bold' 
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
                title={tab.label}
              >
                <div className="shrink-0">{tab.icon}</div>
                {isSidebarOpen && (
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="whitespace-nowrap"
                  >
                    {tab.label}
                  </motion.span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-slate-50">
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-bold"
            title="Logout"
          >
            <div className="shrink-0"><XCircle className="w-5 h-5" /></div>
            {isSidebarOpen && (
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="whitespace-nowrap"
              >
                Logout
              </motion.span>
            )}
          </button>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Top Header */}
        <header className="h-20 bg-white border-b border-slate-100 px-4 md:px-8 flex items-center justify-between shrink-0 w-full">
          <div className="flex items-center gap-4 flex-1">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-50 rounded-lg text-slate-500"
            >
              <MoreVertical className="w-5 h-5 rotate-90" />
            </button>
            <div className="relative flex-1 max-w-2xl hidden sm:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder="Search by name, email, phone, or ride ID..."
                className="w-full h-11 pl-11 pr-4 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-4 ml-4">
            <div className="text-right hidden xs:block">
              <p className="text-sm font-bold text-slate-900">{profile?.displayName || 'Admin'}</p>
              <p className="text-xs text-slate-500">System Administrator</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 shrink-0" />
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 w-full">
          {activeTab === 'overview' && (
            <div className="space-y-8 w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <AdminStat label="Total Revenue" value={`₹${stats.totalRevenue.toLocaleString()}`} trend={12} icon={<DollarSign className="w-6 h-6" />} color="bg-green-50 text-green-600" />
                <AdminStat label="Company Profit (20%)" value={`₹${stats.totalProfit.toLocaleString()}`} trend={15} icon={<PieChart className="w-6 h-6" />} color="bg-teal-50 text-teal-600" />
                <AdminStat label="Active Rides" value={stats.activeRides} trend={5} icon={<Activity className="w-6 h-6" />} color="bg-blue-50 text-blue-600" />
                <AdminStat label="Total Users" value={stats.totalUsers + stats.totalDrivers} trend={8} icon={<Users className="w-6 h-6" />} color="bg-purple-50 text-purple-600" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-lg font-bold text-slate-900">Recent Rides</h3>
                    <button onClick={() => setActiveTab('rides')} className="text-sm text-blue-600 font-bold">View All</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50">
                          <th className="pb-4">User</th>
                          <th className="pb-4">Driver</th>
                          <th className="pb-4">Route</th>
                          <th className="pb-4">Fare</th>
                          <th className="pb-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {rides.slice(0, 5).map(ride => (
                          <tr key={ride._id} className="text-sm">
                            <td className="py-4 font-medium text-slate-900">{ride.userId?.displayName || 'Unknown'}</td>
                            <td className="py-4 text-slate-600">{ride.driverId?.displayName || 'Searching...'}</td>
                            <td className="py-4 text-slate-500 truncate max-w-[200px]">{ride.pickup.address} → {ride.dropoff.address}</td>
                            <td className="py-4 font-bold text-slate-900">₹{ride.fare}</td>
                            <td className="py-4">
                              <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                                ride.status === 'completed' ? 'bg-green-50 text-green-600' :
                                ride.status === 'cancelled' ? 'bg-red-50 text-red-600' :
                                'bg-blue-50 text-blue-600'
                              }`}>
                                {ride.status.charAt(0).toUpperCase() + ride.status.slice(1)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-900 mb-8">Driver Verification</h3>
                  <div className="space-y-6">
                    {drivers.filter(d => !d.isVerified).slice(0, 5).map(driver => (
                      <div key={driver._id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden">
                            {driver.photoURL && <img src={driver.photoURL} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{driver.displayName}</p>
                            <p className="text-xs text-slate-500">Pending verification</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleVerifyDriver(driver._id, true)}
                          className="p-2 hover:bg-green-50 rounded-lg transition-colors text-green-600"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {drivers.filter(d => !d.isVerified).length === 0 && (
                      <p className="text-sm text-slate-400 text-center py-4">No pending verifications</p>
                    )}
                  </div>
                  <Button onClick={() => setActiveTab('drivers')} className="w-full mt-8 bg-slate-900 hover:bg-slate-800 h-12 rounded-2xl">Review All</Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-900">All Users</h3>
                <Button onClick={() => openModal('user')} className="bg-blue-600 text-white h-10 rounded-xl text-xs">Add New User</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 bg-slate-50/50">
                      <th className="px-8 py-4">Name</th>
                      <th className="px-8 py-4">Email</th>
                      <th className="px-8 py-4">Phone</th>
                      <th className="px-8 py-4">Status</th>
                      <th className="px-8 py-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {users.filter(u => u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase())).map(user => (
                      <tr key={user._id} className="text-sm hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-4 font-medium text-slate-900">{user.displayName}</td>
                        <td className="px-8 py-4 text-slate-600">{user.email}</td>
                        <td className="px-8 py-4 text-slate-500">{user.phoneNumber}</td>
                        <td className="px-8 py-4">
                          <span className={`px-2 py-1 rounded-md text-xs font-bold ${user.isActive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                            {user.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </td>
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => openModal('user', user)} 
                              className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-xs font-bold"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Edit
                            </button>
                            <button 
                              onClick={() => handleToggleActive(user._id)} 
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors text-xs font-bold ${
                                user.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
                              }`}
                            >
                              {user.isActive ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                              {user.isActive ? 'Disable' : 'Enable'}
                            </button>
                            <button 
                              onClick={() => handleDelete(user._id)} 
                              className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Delete User"
                            >
                              <AlertTriangle className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'drivers' && (
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-900">All Drivers</h3>
                <Button onClick={() => openModal('driver')} className="bg-blue-600 text-white h-10 rounded-xl text-xs">Add New Driver</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 bg-slate-50/50">
                      <th className="px-8 py-4">Name</th>
                      <th className="px-8 py-4">Vehicle</th>
                      <th className="px-8 py-4">Rating</th>
                      <th className="px-8 py-4">Verified</th>
                      <th className="px-8 py-4">Status</th>
                      <th className="px-8 py-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {drivers.filter(d => d.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || d.email.toLowerCase().includes(searchQuery.toLowerCase())).map(driver => (
                      <tr key={driver._id} className="text-sm hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-4 font-medium text-slate-900">{driver.displayName}</td>
                        <td className="px-8 py-4 text-slate-600">{driver.vehicleInfo?.model} ({driver.vehicleInfo?.plateNumber})</td>
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-slate-900">{driver.stats?.rating?.toFixed(1) || '5.0'}</span>
                            <span className="text-xs text-slate-400">({driver.stats?.ratingCount || 0})</span>
                          </div>
                        </td>
                        <td className="px-8 py-4">
                          <span className={`px-2 py-1 rounded-md text-xs font-bold ${driver.isVerified ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                            {driver.isVerified ? 'VERIFIED' : 'PENDING'}
                          </span>
                        </td>
                        <td className="px-8 py-4">
                          <span className={`px-2 py-1 rounded-md text-xs font-bold ${driver.isActive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                            {driver.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </td>
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => openModal('driver', driver)} 
                              className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-xs font-bold"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Edit
                            </button>
                            <button 
                              onClick={() => handleVerifyDriver(driver._id, !driver.isVerified)} 
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors text-xs font-bold ${
                                driver.isVerified ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
                              }`}
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              {driver.isVerified ? 'Unverify' : 'Verify'}
                            </button>
                            <button 
                              onClick={() => handleToggleActive(driver._id)} 
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors text-xs font-bold ${
                                driver.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
                              }`}
                            >
                              {driver.isActive ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                              {driver.isActive ? 'Disable' : 'Enable'}
                            </button>
                            <button 
                              onClick={() => handleDelete(driver._id)} 
                              className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Delete Driver"
                            >
                              <AlertTriangle className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'rides' && (
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex flex-col gap-6">
                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <h3 className="text-lg font-bold text-slate-900">All Rides</h3>
                    <p className="text-xs text-slate-500">
                      Found {filteredRides.length} rides — Total Revenue: ₹{filteredRides.reduce((acc, curr) => acc + (curr.fare || 0), 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => {
                        setFilterStatus('all');
                        setFilterUser('all');
                        setFilterDriver('all');
                        setDateRange({ start: '', end: '' });
                        setSearchQuery('');
                      }}
                      className="bg-slate-100 text-slate-600 hover:bg-slate-200 border-none h-10 rounded-xl text-xs"
                    >
                      Reset Filters
                    </Button>
                    <Button 
                      onClick={() => {
                        const headers = ["Ride ID", "User", "Driver", "Fare", "Status", "Date"];
                        const data = filteredRides.map(r => [
                          r._id,
                          r.userId?.displayName || 'Unknown',
                          r.driverId?.displayName || 'None',
                          r.fare,
                          r.status,
                          new Date(r.createdAt).toLocaleDateString()
                        ]);
                        const csvContent = [headers, ...data].map(row => row.join(',')).join('\n');
                        const blob = new Blob([csvContent], { type: 'text/csv' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `rides_export_${new Date().toISOString().split('T')[0]}.csv`;
                        a.click();
                      }}
                      className="bg-slate-50 text-slate-600 hover:bg-slate-100 border-none h-10 rounded-xl text-xs"
                    >
                      Export CSV
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
                    <select 
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-100 rounded-xl text-sm"
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      <option value="all">All Statuses</option>
                      <option value="searching">Searching</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="ongoing">Ongoing</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">User</label>
                    <select 
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-100 rounded-xl text-sm"
                      value={filterUser}
                      onChange={(e) => setFilterUser(e.target.value)}
                    >
                      <option value="all">All Users</option>
                      {users.map(u => (
                        <option key={u._id} value={u._id}>{u.displayName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Driver</label>
                    <select 
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-100 rounded-xl text-sm"
                      value={filterDriver}
                      onChange={(e) => setFilterDriver(e.target.value)}
                    >
                      <option value="all">All Drivers</option>
                      {drivers.map(d => (
                        <option key={d._id} value={d._id}>{d.displayName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Start Date</label>
                    <input 
                      type="date" 
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-100 rounded-xl text-sm"
                      value={dateRange.start}
                      onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">End Date</label>
                    <input 
                      type="date" 
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-100 rounded-xl text-sm"
                      value={dateRange.end}
                      onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 bg-slate-50/50">
                      <th className="px-8 py-4">ID</th>
                      <th className="px-8 py-4">User</th>
                      <th className="px-8 py-4">Driver</th>
                      <th className="px-8 py-4">Pickup</th>
                      <th className="px-8 py-4">Dropoff</th>
                      <th className="px-8 py-4">Fare</th>
                      <th className="px-8 py-4">Status</th>
                      <th className="px-8 py-4">Date</th>
                      <th className="px-8 py-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredRides.map(ride => (
                      <tr key={ride._id} className="text-sm hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-4 font-mono text-xs text-slate-400">#{ride._id.slice(-6)}</td>
                        <td className="px-8 py-4 font-medium text-slate-900">{ride.userId?.displayName || 'Unknown'}</td>
                        <td className="px-8 py-4 text-slate-600">{ride.driverId?.displayName || 'Searching...'}</td>
                        <td className="px-8 py-4 text-slate-500 truncate max-w-[150px]">{ride.pickup.address}</td>
                        <td className="px-8 py-4 text-slate-500 truncate max-w-[150px]">{ride.dropoff.address}</td>
                        <td className="px-8 py-4 font-bold text-slate-900">₹{ride.fare}</td>
                        <td className="px-8 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={`px-2 py-1 rounded-md text-xs font-bold inline-block w-fit ${
                              ride.status === 'completed' ? 'bg-green-50 text-green-600' :
                              ride.status === 'cancelled' ? 'bg-red-50 text-red-600' :
                              'bg-blue-50 text-blue-600'
                            }`}>
                              {ride.status.toUpperCase()}
                            </span>
                            {ride.status === 'cancelled' && ride.cancellationReason && (
                              <span className="text-[10px] text-slate-400 italic truncate max-w-[100px]" title={ride.cancellationReason}>
                                {ride.cancellationReason}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-4 text-slate-400 text-xs">
                          {new Date(ride.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => setSelectedRide(ride)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-xs font-bold"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Details
                            </button>
                            {['searching', 'confirmed', 'arriving', 'ongoing'].includes(ride.status) && (
                              <button 
                                onClick={() => openCancelModal(ride._id)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-xs font-bold"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="w-full space-y-8">
              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-6">Pricing Configuration</h3>
                <form onSubmit={handleUpdateConfig} className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Base Fare (₹)</label>
                      <input 
                        type="number" 
                        className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm" 
                        value={config.baseFare} 
                        onChange={(e) => setConfig({ ...config, baseFare: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Minimum Fare (₹)</label>
                      <input 
                        type="number" 
                        className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm" 
                        value={config.minimumFare} 
                        onChange={(e) => setConfig({ ...config, minimumFare: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Per KM Rate (₹)</label>
                      <input 
                        type="number" 
                        className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm" 
                        value={config.perKmRate} 
                        onChange={(e) => setConfig({ ...config, perKmRate: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Per Minute Rate (₹)</label>
                      <input 
                        type="number" 
                        className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm" 
                        value={config.perMinuteRate} 
                        onChange={(e) => setConfig({ ...config, perMinuteRate: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-12 rounded-2xl shadow-lg shadow-blue-500/20">Save Changes</Button>
                </form>
              </div>

              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-6">System Status</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-sm font-medium text-slate-700">API Server</span>
                    </div>
                    <span className="text-xs font-bold text-green-600">Operational</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-sm font-medium text-slate-700">Database</span>
                    </div>
                    <span className="text-xs font-bold text-green-600">Connected</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-sm font-medium text-slate-700">Socket Server</span>
                    </div>
                    <span className="text-xs font-bold text-green-600">Operational</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* CRUD Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingItem ? `Edit ${modalType}` : `Add New ${modalType}`}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <XCircle className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Full Name</label>
                  <input 
                    type="text" 
                    required
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                  <input 
                    type="email" 
                    required
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                {!editingItem && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                    <input 
                      type="password" 
                      required
                      className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phone Number</label>
                  <input 
                    type="text" 
                    required
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  />
                </div>

                {modalType === 'driver' && (
                  <div className="pt-4 border-t border-slate-100 space-y-4">
                    <p className="text-xs font-bold text-slate-900">Vehicle Information</p>
                    <div className="grid grid-cols-2 gap-4">
                      <input 
                        placeholder="Model"
                        className="h-12 px-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm"
                        value={formData.vehicleInfo.model}
                        onChange={(e) => setFormData({ ...formData, vehicleInfo: { ...formData.vehicleInfo, model: e.target.value } })}
                      />
                      <input 
                        placeholder="Plate Number"
                        className="h-12 px-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm"
                        value={formData.vehicleInfo.plateNumber}
                        onChange={(e) => setFormData({ ...formData, vehicleInfo: { ...formData.vehicleInfo, plateNumber: e.target.value } })}
                      />
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-600/20 mt-4">
                  {editingItem ? 'Update' : 'Create'} {modalType}
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Ride Details Modal */}
      <AnimatePresence>
        {selectedRide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Ride Details</h3>
                  <p className="text-xs font-mono text-slate-400 mt-1">ID: {selectedRide._id}</p>
                </div>
                <button onClick={() => setSelectedRide(null)} className="p-2 hover:bg-white rounded-full transition-colors shadow-sm">
                  <XCircle className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* Status & Fare Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                    <p className="text-xs font-bold text-blue-600 uppercase mb-1">Current Status</p>
                    <p className="text-lg font-bold text-blue-900 capitalize">{selectedRide.status}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
                    <p className="text-xs font-bold text-green-600 uppercase mb-1">Total Fare</p>
                    <p className="text-lg font-bold text-green-900">₹{selectedRide.fare}</p>
                  </div>
                </div>

                {/* Route Information */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-blue-600" />
                    Route Information
                  </h4>
                  <div className="relative pl-8 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                    <div className="relative">
                      <div className="absolute -left-8 top-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-blue-50" />
                      <p className="text-xs font-bold text-slate-400 uppercase">Pickup</p>
                      <p className="text-sm text-slate-700 font-medium">{selectedRide.pickup.address}</p>
                    </div>
                    <div className="relative">
                      <div className="absolute -left-8 top-1 w-2.5 h-2.5 rounded-full bg-red-600 ring-4 ring-red-50" />
                      <p className="text-xs font-bold text-slate-400 uppercase">Dropoff</p>
                      <p className="text-sm text-slate-700 font-medium">{selectedRide.dropoff.address}</p>
                    </div>
                  </div>
                </div>

                {/* Cancellation Info */}
                {selectedRide.status === 'cancelled' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      Cancellation Details
                    </h4>
                    <div className="bg-red-50 p-6 rounded-3xl border border-red-100 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-red-400 uppercase">Cancelled By</span>
                        <span className="text-sm font-bold text-red-700 capitalize">{selectedRide.cancelledBy || 'Unknown'}</span>
                      </div>
                      <div className="pt-2 border-t border-red-100">
                        <span className="text-xs font-bold text-red-400 uppercase block mb-1">Reason</span>
                        <p className="text-sm text-red-800 font-medium italic">"{selectedRide.cancellationReason || 'No reason provided'}"</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* User & Driver Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      Passenger Details
                    </h4>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                          {selectedRide.userId?.displayName?.[0] || 'U'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{selectedRide.userId?.displayName || 'Unknown User'}</p>
                          <p className="text-xs text-slate-500">Passenger</p>
                        </div>
                      </div>
                      <div className="pt-2 space-y-2">
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <Mail className="w-3.5 h-3.5" />
                          {selectedRide.userId?.email || 'N/A'}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <Phone className="w-3.5 h-3.5" />
                          {selectedRide.userId?.phoneNumber || 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Car className="w-4 h-4 text-blue-600" />
                      Driver Details
                    </h4>
                    {selectedRide.driverId ? (
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold">
                            {selectedRide.driverId?.displayName?.[0] || 'D'}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{selectedRide.driverId?.displayName}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-slate-500">{selectedRide.driverId?.vehicleInfo?.model} • {selectedRide.driverId?.vehicleInfo?.plateNumber}</p>
                              {selectedRide.driverId?.stats?.rating && (
                                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-yellow-50 text-yellow-700 rounded-md text-[10px] font-bold border border-yellow-100">
                                  ★ {selectedRide.driverId.stats.rating.toFixed(1)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="pt-2 space-y-2">
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <Mail className="w-3.5 h-3.5" />
                            {selectedRide.driverId?.email}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <Phone className="w-3.5 h-3.5" />
                            {selectedRide.driverId?.phoneNumber}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 border-dashed flex flex-col items-center justify-center text-center">
                        <Search className="w-8 h-8 text-slate-300 mb-2" />
                        <p className="text-sm font-medium text-slate-500">Searching for driver...</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Fare Breakdown */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    Fare Breakdown
                  </h4>
                  <div className="bg-slate-900 text-white p-6 rounded-3xl space-y-4">
                    <div className="flex justify-between text-sm text-slate-400">
                      <span>Base Fare</span>
                      <span>₹{config.baseFare}</span>
                    </div>
                    <div className="flex justify-between text-sm text-slate-400">
                      <span>Distance/Time Charges</span>
                      <span>₹{selectedRide.fare - config.baseFare}</span>
                    </div>
                    <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                      <span className="font-bold">Total Paid</span>
                      <span className="text-2xl font-bold text-blue-400">₹{selectedRide.fare}</span>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="space-y-4 pb-4">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    Ride Timeline
                  </h4>
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 relative space-y-6 before:absolute before:left-9 before:top-8 before:bottom-8 before:w-0.5 before:bg-slate-200">
                    {selectedRide.statusHistory && selectedRide.statusHistory.length > 0 ? (
                      selectedRide.statusHistory.map((history: any, index: number) => (
                        <div key={index} className="flex gap-4 relative">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 ${
                            index === selectedRide.statusHistory.length - 1 ? 'bg-blue-600 ring-4 ring-blue-50' : 'bg-slate-200'
                          }`}>
                            <div className="w-2 h-2 rounded-full bg-white" />
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm font-bold capitalize ${
                              index === selectedRide.statusHistory.length - 1 ? 'text-slate-900' : 'text-slate-500'
                            }`}>
                              {history.status}
                            </p>
                            <p className="text-xs text-slate-400">{new Date(history.timestamp).toLocaleString()}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center gap-4">
                        <div className="w-6 h-6 rounded-full bg-blue-600 ring-4 ring-blue-50 flex items-center justify-center shrink-0">
                          <div className="w-2 h-2 rounded-full bg-white" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-900">Ride Created</p>
                          <p className="text-xs text-slate-500">{new Date(selectedRide.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-slate-50 bg-slate-50/30">
                <Button onClick={() => setSelectedRide(null)} className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold">
                  Close Details
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Cancel Ride Modal */}
      <AnimatePresence>
        {isCancelModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Cancel Ride</h3>
                  <p className="text-xs text-slate-500 mt-1">Please provide a reason for cancellation</p>
                </div>
                <button onClick={() => setIsCancelModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <XCircle className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleCancelRide} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cancellation Reason</label>
                  <textarea 
                    required
                    rows={4}
                    placeholder="e.g., Driver not responding, System error, User request..."
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button 
                    type="button" 
                    onClick={() => setIsCancelModalOpen(false)}
                    className="flex-1 h-12 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold"
                  >
                    Back
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-[2] h-12 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-600/20"
                  >
                    Confirm Cancellation
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
