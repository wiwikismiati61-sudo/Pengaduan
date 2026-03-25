import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  updateDoc,
  orderBy
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { 
  Download, 
  Printer, 
  Edit2, 
  Trash2, 
  Search, 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { handleFirestoreError, OperationType } from '../firebase';

interface Complaint {
  id: string;
  userId: string;
  parentName: string;
  phone: string;
  relationship: string;
  address: string;
  studentClass: string;
  studentName: string;
  complaintType: string;
  complaintTypeOther?: string;
  description: string;
  incidentDate: string;
  incidentTime: string;
  incidentLocation: string;
  evidence?: string;
  expectation: string;
  declaration: boolean;
  createdAt: any;
  status: 'pending' | 'processed' | 'resolved';
}

interface ReportsProps {
  isAdmin: boolean;
  userRole?: string;
}

const Reports: React.FC<ReportsProps> = ({ isAdmin, userRole }) => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingComplaint, setEditingComplaint] = useState<Complaint | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [viewingComplaint, setViewingComplaint] = useState<Complaint | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    const path = 'complaints';
    let q;
    
    // Admin or Guru (userRole === 'user') sees all
    if (isAdmin || userRole === 'user') {
      q = query(collection(db, path), orderBy('createdAt', 'desc'));
    } else {
      // This case shouldn't be reached if login is required, but just in case
      q = query(
        collection(db, path), 
        where('userId', '==', auth.currentUser?.uid || ''),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Complaint[];
      setComplaints(data);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAdmin]);

  const filteredComplaints = complaints.filter(c => {
    const matchesSearch = 
      c.parentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleDelete = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus pengaduan ini?')) return;
    
    setIsDeleting(id);
    const path = `complaints/${id}`;
    try {
      await deleteDoc(doc(db, 'complaints', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: 'pending' | 'processed' | 'resolved') => {
    const path = `complaints/${id}`;
    try {
      await updateDoc(doc(db, 'complaints', id), { status: newStatus });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingComplaint) return;

    const path = `complaints/${editingComplaint.id}`;
    try {
      const { id, ...updateData } = editingComplaint;
      await updateDoc(doc(db, 'complaints', id), updateData);
      setIsEditModalOpen(false);
      setEditingComplaint(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const exportToExcel = () => {
    const dataToExport = filteredComplaints.map(c => ({
      'Tanggal': c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString('id-ID') : '-',
      'Nama Orang Tua': c.parentName,
      'Telepon': c.phone,
      'Hubungan': c.relationship,
      'Nama Siswa': c.studentName,
      'Kelas': c.studentClass,
      'Jenis Pengaduan': c.complaintType,
      'Uraian': c.description,
      'Tanggal Kejadian': c.incidentDate,
      'Lokasi': c.incidentLocation,
      'Harapan': c.expectation,
      'Status': c.status === 'pending' ? 'Menunggu' : c.status === 'processed' ? 'Diproses' : 'Selesai'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Pengaduan');
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    saveAs(data, `Laporan_Pengaduan_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 flex items-center gap-1"><Clock size={12} /> Menunggu</span>;
      case 'processed':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 flex items-center gap-1"><AlertCircle size={12} /> Diproses</span>;
      case 'resolved':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 flex items-center gap-1"><CheckCircle size={12} /> Selesai</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Laporan Pengaduan</h2>
          <p className="text-gray-600">Kelola dan pantau semua data pengaduan yang masuk.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download size={18} /> Excel
          </button>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
          >
            <Printer size={18} /> Cetak
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 print:hidden">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder="Cari nama orang tua, siswa, atau uraian..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Semua Status</option>
          <option value="pending">Menunggu</option>
          <option value="processed">Diproses</option>
          <option value="resolved">Selesai</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-bottom border-gray-100">
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Tanggal</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Pengadu</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Siswa</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Jenis</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600 print:hidden">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredComplaints.length > 0 ? (
                filteredComplaints.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString('id-ID') : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-800">{c.parentName}</div>
                      <div className="text-xs text-gray-500">{c.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-800">{c.studentName}</div>
                      <div className="text-xs text-gray-500">Kelas {c.studentClass}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">{c.complaintType}</div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(c.status)}
                    </td>
                    <td className="px-6 py-4 print:hidden">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setViewingComplaint(c);
                            setIsDetailModalOpen(true);
                          }}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Detail"
                        >
                          <FileText size={18} />
                        </button>
                        {isAdmin && (
                          <>
                            <button 
                              onClick={() => {
                                setEditingComplaint(c);
                                setIsEditModalOpen(true);
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button 
                              onClick={() => handleDelete(c.id)}
                              disabled={isDeleting === c.id}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Hapus"
                            >
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <FileText size={48} className="text-gray-200" />
                      <p>Tidak ada data pengaduan ditemukan.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {isDetailModalOpen && viewingComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold text-gray-800">Detail Pengaduan</h3>
              <button 
                onClick={() => {
                  setIsDetailModalOpen(false);
                  setViewingComplaint(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-8 space-y-8">
              {/* Section 1: Data Pelapor */}
              <div className="space-y-4">
                <h4 className="text-md font-bold text-indigo-600 border-b border-indigo-50 pb-2">1. Data Pelapor</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Nama Orang Tua / Wali</p>
                    <p className="text-sm font-semibold text-gray-800">{viewingComplaint.parentName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Nomor HP / WA</p>
                    <p className="text-sm font-semibold text-gray-800">{viewingComplaint.phone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Hubungan dengan Siswa</p>
                    <p className="text-sm font-semibold text-gray-800">{viewingComplaint.relationship}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Alamat Lengkap</p>
                    <p className="text-sm font-semibold text-gray-800">{viewingComplaint.address}</p>
                  </div>
                </div>
              </div>

              {/* Section 2: Data Siswa */}
              <div className="space-y-4">
                <h4 className="text-md font-bold text-purple-600 border-b border-purple-50 pb-2">2. Data Siswa</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Nama Siswa</p>
                    <p className="text-sm font-semibold text-gray-800">{viewingComplaint.studentName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Kelas</p>
                    <p className="text-sm font-semibold text-gray-800">{viewingComplaint.studentClass}</p>
                  </div>
                </div>
              </div>

              {/* Section 3: Detail Pengaduan */}
              <div className="space-y-4">
                <h4 className="text-md font-bold text-pink-600 border-b border-pink-50 pb-2">3. Detail Pengaduan</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Jenis Pengaduan</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {viewingComplaint.complaintType}
                      {viewingComplaint.complaintType === 'Lainnya' && viewingComplaint.complaintTypeOther && ` (${viewingComplaint.complaintTypeOther})`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Waktu Kejadian</p>
                    <p className="text-sm font-semibold text-gray-800">{viewingComplaint.incidentDate} pukul {viewingComplaint.incidentTime}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Tempat Kejadian</p>
                    <p className="text-sm font-semibold text-gray-800">{viewingComplaint.incidentLocation}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Uraian Permasalahan / Kronologi</p>
                    <p className="text-sm font-semibold text-gray-800 leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100">{viewingComplaint.description}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Bukti Pendukung</p>
                    <p className="text-sm font-semibold text-gray-800">{viewingComplaint.evidence || '-'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Harapan Orang Tua</p>
                    <p className="text-sm font-semibold text-gray-800 leading-relaxed bg-indigo-50 p-4 rounded-xl border border-indigo-100">{viewingComplaint.expectation}</p>
                  </div>
                </div>
              </div>

              {/* Section 4: Status */}
              <div className="space-y-4">
                <h4 className="text-md font-bold text-gray-600 border-b border-gray-50 pb-2">4. Status Pengaduan</h4>
                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl">
                  <div className="flex items-center gap-3">
                    {getStatusBadge(viewingComplaint.status)}
                    <span className="text-xs text-gray-400 font-medium">Dibuat pada: {viewingComplaint.createdAt?.toDate ? viewingComplaint.createdAt.toDate().toLocaleString('id-ID') : '-'}</span>
                  </div>
                  {(isAdmin || userRole === 'user') && (
                    <div className="flex gap-2">
                      <button onClick={() => handleUpdateStatus(viewingComplaint.id, 'pending')} className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${viewingComplaint.status === 'pending' ? 'bg-yellow-500 text-white' : 'bg-white text-yellow-600 border border-yellow-200 hover:bg-yellow-50'}`}>Menunggu</button>
                      <button onClick={() => handleUpdateStatus(viewingComplaint.id, 'processed')} className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${viewingComplaint.status === 'processed' ? 'bg-blue-500 text-white' : 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-50'}`}>Diproses</button>
                      <button onClick={() => handleUpdateStatus(viewingComplaint.id, 'resolved')} className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${viewingComplaint.status === 'resolved' ? 'bg-green-500 text-white' : 'bg-white text-green-600 border border-green-200 hover:bg-green-50'}`}>Selesai</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end sticky bottom-0 bg-white">
              <button 
                onClick={() => {
                  setIsDetailModalOpen(false);
                  setViewingComplaint(null);
                }}
                className="px-8 py-2.5 bg-gray-800 text-white rounded-xl hover:bg-gray-900 transition-colors font-bold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold text-gray-800">Edit Pengaduan</h3>
              <button 
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingComplaint(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Orang Tua</label>
                  <input 
                    type="text"
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={editingComplaint.parentName}
                    onChange={(e) => setEditingComplaint({...editingComplaint, parentName: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telepon</label>
                  <input 
                    type="text"
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={editingComplaint.phone}
                    onChange={(e) => setEditingComplaint({...editingComplaint, phone: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select 
                    disabled={!isAdmin}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                    value={editingComplaint.status}
                    onChange={(e) => setEditingComplaint({...editingComplaint, status: e.target.value as any})}
                  >
                    <option value="pending">Menunggu</option>
                    <option value="processed">Diproses</option>
                    <option value="resolved">Selesai</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Pengaduan</label>
                  <select 
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={editingComplaint.complaintType}
                    onChange={(e) => setEditingComplaint({...editingComplaint, complaintType: e.target.value})}
                  >
                    <option value="Bullying/Perundungan">Bullying/Perundungan</option>
                    <option value="Disiplin">Disiplin</option>
                    <option value="Akademik">Akademik</option>
                    <option value="Sosial/Pergaulan">Sosial/Pergaulan</option>
                    <option value="Pelanggaran Tatatertib">Pelanggaran Tatatertib</option>
                    <option value="Masalah dengan Guru">Masalah dengan Guru</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Uraian Permasalahan</label>
                <textarea 
                  required
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={editingComplaint.description}
                  onChange={(e) => setEditingComplaint({...editingComplaint, description: e.target.value})}
                ></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Harapan</label>
                <textarea 
                  required
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={editingComplaint.expectation}
                  onChange={(e) => setEditingComplaint({...editingComplaint, expectation: e.target.value})}
                ></textarea>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                {(isAdmin || (!isAdmin && auth.currentUser && editingComplaint.userId === auth.currentUser.uid && editingComplaint.status === 'pending')) && (
                  <button 
                    type="button"
                    onClick={() => {
                      handleDelete(editingComplaint.id);
                      setIsEditModalOpen(false);
                      setEditingComplaint(null);
                    }}
                    className="mr-auto px-6 py-2 bg-red-50 text-red-600 border border-red-100 rounded-lg hover:bg-red-100 transition-colors font-bold flex items-center gap-2"
                  >
                    <Trash2 size={18} />
                    Hapus
                  </button>
                )}
                <button 
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingComplaint(null);
                  }}
                  className="px-6 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .bg-white, .bg-white * {
            visibility: visible;
          }
          .bg-white {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            box-shadow: none !important;
            border: none !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          table {
            border: 1px solid #e5e7eb !important;
          }
          th, td {
            border: 1px solid #e5e7eb !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Reports;
