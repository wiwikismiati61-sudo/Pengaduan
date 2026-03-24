import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Trash2, Plus, Users as UsersIcon, Search } from 'lucide-react';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface Student {
  id: string;
  name: string;
  class: string;
}

export default function AdminStudentUpload() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Manual Form State
  const [manualName, setManualName] = useState('');
  const [manualClass, setManualClass] = useState('');

  const fetchStudents = async () => {
    const path = 'students';
    try {
      const q = query(collection(db, path), orderBy('class'), orderBy('name'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setStudents(data);
    } catch (err) {
      console.error("Error fetching students:", err);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setSuccess('');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          setError('File Excel kosong atau format tidak sesuai.');
          setLoading(false);
          return;
        }

        // Upload to Firestore
        let count = 0;
        const path = 'students';
        for (const row of data as Record<string, any>[]) {
          const name = row['Nama'] || row['nama'] || row['Name'] || row['name'];
          const studentClass = row['Kelas'] || row['kelas'] || row['Class'] || row['class'];

          if (name && studentClass) {
            try {
              await addDoc(collection(db, path), {
                name: String(name).trim(),
                class: String(studentClass).trim()
              });
              count++;
            } catch (err) {
              handleFirestoreError(err, OperationType.WRITE, path);
            }
          }
        }

        setSuccess(`Berhasil mengunggah ${count} data siswa.`);
        fetchStudents();
      } catch (err: any) {
        console.error(err);
        setError('Gagal memproses data. Pastikan Anda memiliki izin Admin.');
      } finally {
        setLoading(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName || !manualClass) {
      setError('Nama dan Kelas harus diisi.');
      return;
    }

    setLoading(true);
    setError('');
    const path = 'students';
    try {
      await addDoc(collection(db, path), {
        name: manualName.trim(),
        class: manualClass.trim()
      });
      setSuccess('Data siswa berhasil ditambahkan.');
      setManualName('');
      setManualClass('');
      fetchStudents();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    } finally {
      setLoading(false);
    }
  };

  const deleteStudent = async (id: string) => {
    if (!window.confirm('Hapus data siswa ini?')) return;
    const path = 'students';
    try {
      await deleteDoc(doc(db, path, id));
      setSuccess('Data siswa berhasil dihapus.');
      fetchStudents();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const clearStudents = async () => {
    if (!window.confirm('Hapus SEMUA data siswa? Tindakan ini tidak dapat dibatalkan.')) return;
    setLoading(true);
    const path = 'students';
    try {
      const snapshot = await getDocs(collection(db, path));
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      setSuccess('Semua data siswa berhasil dihapus.');
      setStudents([]);
    } catch (err: any) {
      console.error(err);
      try {
        handleFirestoreError(err, OperationType.DELETE, path);
      } catch (e) {
        setError('Gagal menghapus data siswa. Pastikan Anda memiliki izin Admin.');
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.class.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-10">
      {/* Upload Section */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Master Data Siswa</h2>
            <p className="text-gray-500 text-sm">Kelola data siswa melalui upload Excel atau input manual.</p>
          </div>
          <button
            onClick={clearStudents}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Hapus Semua
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-3 text-sm border border-red-100">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-50 text-green-600 rounded-xl flex items-center gap-3 text-sm border border-green-100">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Excel Upload */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Upload Excel</h3>
            <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-200 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer group h-48">
              <Upload className="w-8 h-8 text-gray-400 group-hover:text-indigo-500 mb-3" />
              <span className="text-sm font-medium text-gray-600 group-hover:text-indigo-600 text-center">
                Klik untuk pilih file Excel<br/>
                <span className="text-xs font-normal text-gray-400">(Kolom: Nama, Kelas)</span>
              </span>
              <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" disabled={loading} />
            </label>
          </div>

          {/* Manual Input */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Input Manual</h3>
            <form onSubmit={handleManualSubmit} className="space-y-3 p-6 bg-gray-50 rounded-2xl border border-gray-100 h-48 flex flex-col justify-center">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Nama Siswa"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                />
                <input
                  type="text"
                  placeholder="Kelas (contoh: 7A)"
                  value={manualClass}
                  onChange={(e) => setManualClass(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Tambah Siswa
              </button>
            </form>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-3 text-indigo-600 font-medium py-2">
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            Memproses data...
          </div>
        )}
      </div>

      {/* Student List Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <UsersIcon className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Daftar Siswa</h3>
              <p className="text-xs text-gray-500">{students.length} total siswa terdaftar</p>
            </div>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama atau kelas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm w-full md:w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-semibold">
                <th className="px-6 py-4">No</th>
                <th className="px-6 py-4">Nama Siswa</th>
                <th className="px-6 py-4">Kelas</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student, index) => (
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4 text-sm text-gray-500">{index + 1}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">{student.name}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold">
                        {student.class}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => deleteStudent(student.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-gray-400 text-sm italic">
                    {searchTerm ? 'Tidak ada siswa yang cocok dengan pencarian.' : 'Belum ada data siswa. Silakan unggah atau input manual.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
