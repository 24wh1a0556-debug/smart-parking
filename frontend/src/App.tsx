import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

// Auth pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// User pages
import UserLayout from './layouts/UserLayout';
import UserDashboard from './pages/user/Dashboard';
import ParkingSlots from './pages/user/ParkingSlots';
import FindSlot from './pages/user/FindSlot';
import ParkingMapPage from './pages/user/ParkingMapPage';
import MyReservations from './pages/user/MyReservations';
import MyVehicles from './pages/user/MyVehicles';
import ParkingHistory from './pages/user/ParkingHistory';
import UserNotifications from './pages/user/Notifications';
import UserProfile from './pages/user/Profile';

// Admin pages
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/Dashboard';
import AdminParkingSlots from './pages/admin/ParkingSlots';
import AdminReservations from './pages/admin/Reservations';
import EntryExit from './pages/admin/EntryExit';
import AdminUsers from './pages/admin/Users';
import AdminAnalytics from './pages/admin/Analytics';
import AdminRevenue from './pages/admin/Revenue';
import SystemHealth from './pages/admin/SystemHealth';
import AdminNotifications from './pages/admin/Notifications';

// Protected route components
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading, isAuthenticated } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>;
  if (isAuthenticated) {
    return <Navigate to={user?.role === 'ADMIN' ? '/admin' : '/dashboard'} replace />;
  }
  return <>{children}</>;
};

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* User routes */}
      <Route
        path="/"
        element={<ProtectedRoute><UserLayout /></ProtectedRoute>}
      >
        <Route path="dashboard" element={<UserDashboard />} />
        <Route path="parking-slots" element={<ParkingSlots />} />
        <Route path="find-slot" element={<FindSlot />} />
        <Route path="map" element={<ParkingMapPage />} />
        <Route path="reservations" element={<MyReservations />} />
        <Route path="vehicles" element={<MyVehicles />} />
        <Route path="history" element={<ParkingHistory />} />
        <Route path="notifications" element={<UserNotifications />} />
        <Route path="profile" element={<UserProfile />} />
      </Route>

      {/* Admin routes */}
      <Route
        path="/admin"
        element={<AdminRoute><AdminLayout /></AdminRoute>}
      >
        <Route index element={<AdminDashboard />} />
        <Route path="parking-slots" element={<AdminParkingSlots />} />
        <Route path="reservations" element={<AdminReservations />} />
        <Route path="entry-exit" element={<EntryExit />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="revenue" element={<AdminRevenue />} />
        <Route path="notifications" element={<AdminNotifications />} />
        <Route path="system-health" element={<SystemHealth />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
