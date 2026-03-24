import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ComplaintForm from './components/ComplaintForm';
import { LayoutDashboard, FileEdit, LogOut, Menu, X } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'form'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
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

  if (!user) {
    return <Login onLogin={() => {}} />;
  }

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
        </div>

        <div className="p-4 border-t border-gray-100">
          <div className="px-4 py-3 mb-2">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Login sebagai</p>
            <p className="text-sm font-medium text-gray-800 truncate">{user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium"
          >
            <LogOut className="w-5 h-5" />
            Keluar
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 lg:p-10 overflow-x-hidden">
        <div className="max-w-6xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              {activeTab === 'dashboard' ? 'Dashboard Laporan' : 'Formulir Pengaduan'}
            </h1>
            <p className="text-gray-500 mt-2">
              {activeTab === 'dashboard' 
                ? 'Pantau status dan statistik pengaduan Anda di sini.' 
                : 'Sampaikan keluhan atau masukan Anda kepada pihak sekolah.'}
            </p>
          </header>

          {activeTab === 'dashboard' ? (
            <Dashboard />
          ) : (
            <ComplaintForm onSuccess={() => setActiveTab('dashboard')} />
          )}
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
