import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ComplaintForm from './components/ComplaintForm';
import AdminStudentUpload from './components/AdminStudentUpload';
import Reports from './components/Reports';
import { LayoutDashboard, FileEdit, LogOut, Menu, X, Users, FileText } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('user');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'form' | 'reports' | 'admin'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      const isMasterLogin = localStorage.getItem('master_login') === 'true';
      
      if (isMasterLogin && currentUser) {
        setUser(currentUser);
        setUserRole('admin');
        setLoading(false);
        return;
      }

      if (currentUser) {
        setUser(currentUser);
        
        // Force admin role for the specific admin email
        if (currentUser.email === 'wiwikismiati61@guru.smp.belajar.id') {
          setUserRole('admin');
          setLoading(false);
          return;
        }

        // Fetch user role for others
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role || 'user');
          }
        } catch (err) {
          console.error("Error fetching user role:", err);
        }
      } else {
        setUser(null);
        setUserRole('user');
        // If user is not logged in and on a restricted tab, move to dashboard
        if (activeTab === 'reports' || activeTab === 'admin') {
          setActiveTab('dashboard');
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [activeTab]);

  const handleLogout = async () => {
    try {
      localStorage.removeItem('master_login');
      await signOut(auth);
      setActiveTab('dashboard');
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'form':
        return <ComplaintForm onSuccess={() => setActiveTab('dashboard')} />;
      case 'reports':
        return user ? <Reports isAdmin={userRole === 'admin'} /> : <Login onLogin={() => setActiveTab('reports')} />;
      case 'admin':
        return user && userRole === 'admin' ? <AdminStudentUpload /> : <Login onLogin={() => setActiveTab('admin')} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col md:flex-row">
      
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-gray-200 p-4 flex justify-between items-center sticky top-0 z-50">
        <img src="https://iili.io/KDFk4fI.png" alt="Logo" className="h-10" />
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0 fixed md:sticky top-0 left-0 z-40 w-64 h-screen bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out flex flex-col
      `}>
        <div className="p-6 hidden md:block border-b border-gray-100">
          <img src="https://iili.io/KDFk4fI.png" alt="Logo" className="h-14 mb-2" />
          <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
            Pengaduan Walimurid
          </h1>
        </div>
        
        <div className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <button
            onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === 'dashboard' 
                ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-sm border border-indigo-100' 
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <LayoutDashboard className={`w-5 h-5 ${activeTab === 'dashboard' ? 'text-indigo-600' : 'text-gray-400'}`} />
            Dashboard
          </button>
          
          <button
            onClick={() => { setActiveTab('form'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === 'form' 
                ? 'bg-purple-50 text-purple-700 font-semibold shadow-sm border border-purple-100' 
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <FileEdit className={`w-5 h-5 ${activeTab === 'form' ? 'text-purple-600' : 'text-gray-400'}`} />
            Buat Pengaduan
          </button>

          <button
            onClick={() => { setActiveTab('reports'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === 'reports' 
                ? 'bg-blue-50 text-blue-700 font-semibold shadow-sm border border-blue-100' 
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <FileText className={`w-5 h-5 ${activeTab === 'reports' ? 'text-blue-600' : 'text-gray-400'}`} />
            Laporan Pengaduan
          </button>

          {userRole === 'admin' && (
            <button
              onClick={() => { setActiveTab('admin'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'admin' 
                  ? 'bg-orange-50 text-orange-700 font-semibold shadow-sm border border-orange-100' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Users className={`w-5 h-5 ${activeTab === 'admin' ? 'text-orange-600' : 'text-gray-400'}`} />
              Data Siswa (Admin)
            </button>
          )}
        </div>

        <div className="p-4 border-t border-gray-100">
          {user ? (
            <>
              <div className="px-4 py-3 mb-2">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Login sebagai</p>
                <p className="text-sm font-medium text-gray-800 truncate">{user.email || 'Admin Bypass'}</p>
                <p className="text-[10px] font-bold text-indigo-500 uppercase">{userRole}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium"
              >
                <LogOut className="w-5 h-5" />
                Keluar
              </button>
            </>
          ) : (
            <button
              onClick={() => setActiveTab('reports')}
              className="w-full flex items-center gap-3 px-4 py-3 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors font-medium"
            >
              <Users className="w-5 h-5" />
              Login Admin
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 lg:p-10 overflow-x-hidden">
        <div className="max-w-6xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              {activeTab === 'dashboard' ? 'Dashboard Laporan' : 
               activeTab === 'form' ? 'Formulir Pengaduan' : 
               activeTab === 'reports' ? 'Laporan Pengaduan' :
               'Manajemen Data Siswa'}
            </h1>
            <p className="text-gray-500 mt-2">
              {activeTab === 'dashboard' 
                ? 'Pantau status dan statistik pengaduan di sini.' 
                : activeTab === 'form'
                ? 'Sampaikan keluhan atau masukan Anda kepada pihak sekolah.'
                : activeTab === 'reports'
                ? 'Lihat, edit, dan unduh data pengaduan secara lengkap.'
                : 'Unggah data siswa dari file Excel untuk memudahkan pengisian formulir.'}
            </p>
          </header>

          {renderContent()}
        </div>
      </main>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/50 z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
