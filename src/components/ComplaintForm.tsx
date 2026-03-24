import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Send, CheckCircle, AlertCircle, Search } from 'lucide-react';

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

const COMPLAINT_TYPES = [
  'Bullying/Perundungan',
  'Disiplin',
  'Akademik',
  'Sosial/Pergaulan',
  'Pelanggaran Tatatertib',
  'Masalah dengan Guru',
  'Lainnya'
];

interface Student {
  id: string;
  name: string;
  class: string;
}

export default function ComplaintForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);

  const [formData, setFormData] = useState({
    parentName: '',
    phone: '',
    relationship: 'Ayah',
    address: '',
    studentClass: '',
    studentName: '',
    complaintType: 'Bullying/Perundungan',
    complaintTypeOther: '',
    description: '',
    incidentDay: '',
    incidentDate: '',
    incidentTime: '',
    incidentLocation: '',
    evidence: '',
    expectation: '',
    declaration: false
  });

  useEffect(() => {
    const fetchStudents = async () => {
      const path = 'students';
      try {
        const snapshot = await getDocs(collection(db, path));
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
        setStudents(data);
        
        // Extract unique classes
        const uniqueClasses = Array.from(new Set(data.map(s => s.class))).sort();
        setClasses(uniqueClasses);
      } catch (err) {
        console.error("Error fetching students:", err);
        try {
          handleFirestoreError(err, OperationType.GET, path);
        } catch (e: any) {
          setError('Gagal mengambil data siswa. Pastikan Anda sudah login.');
        }
      }
    };
    fetchStudents();
  }, []);

  useEffect(() => {
    if (formData.studentClass) {
      const filtered = students.filter(s => s.class === formData.studentClass).sort((a, b) => a.name.localeCompare(b.name));
      setFilteredStudents(filtered);
      // Reset student name if class changes
      setFormData(prev => ({ ...prev, studentName: '' }));
    } else {
      setFilteredStudents([]);
    }
  }, [formData.studentClass, students]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!formData.declaration) {
      setError('Anda harus menyetujui pernyataan kebenaran informasi.');
      return;
    }

    if (formData.description.length > 500) {
      setError('Uraian permasalahan maksimal 500 karakter.');
      return;
    }

    setLoading(true);

    const path = 'complaints';
    try {
      await addDoc(collection(db, path), {
        userId: auth.currentUser?.uid,
        parentName: formData.parentName,
        phone: formData.phone,
        relationship: formData.relationship,
        address: formData.address,
        studentClass: formData.studentClass,
        studentName: formData.studentName,
        complaintType: formData.complaintType,
        complaintTypeOther: formData.complaintType === 'Lainnya' ? formData.complaintTypeOther : '',
        description: formData.description,
        incidentDate: `${formData.incidentDay}, ${formData.incidentDate}`,
        incidentTime: formData.incidentTime,
        incidentLocation: formData.incidentLocation,
        evidence: formData.evidence,
        expectation: formData.expectation,
        declaration: formData.declaration,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSuccess();
      }, 2000);
      
    } catch (err: any) {
      console.error(err);
      try {
        handleFirestoreError(err, OperationType.WRITE, path);
      } catch (e: any) {
        setError(err.message || 'Terjadi kesalahan saat mengirim pengaduan.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-white p-12 rounded-3xl shadow-lg border border-green-100 text-center animate-in zoom-in duration-300">
        <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-bold text-gray-800 mb-4">Pengaduan Berhasil Dikirim!</h2>
        <p className="text-gray-600">Terima kasih atas laporan Anda. Pihak sekolah akan segera menindaklanjuti.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in duration-500">
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-8 text-white">
        <h2 className="text-2xl font-bold mb-2">Formulir Pengaduan Walimurid</h2>
        <p className="text-indigo-100">Silakan isi formulir di bawah ini dengan data yang valid dan dapat dipertanggungjawabkan.</p>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-8">
        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-3 text-sm border border-red-100">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Section 1: Data Pelapor */}
        <div className="space-y-5">
          <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-100 pb-2 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm">1</span>
            Data Pelapor
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Orang Tua / Wali Murid *</label>
              <input type="text" required name="parentName" value={formData.parentName} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-gray-50 focus:bg-white" placeholder="Nama Lengkap" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nomor HP / WA *</label>
              <input type="tel" required name="phone" value={formData.phone} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-gray-50 focus:bg-white" placeholder="Contoh: 08123456789" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hubungan dengan Siswa *</label>
              <select required name="relationship" value={formData.relationship} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-gray-50 focus:bg-white">
                <option value="Ayah">Ayah</option>
                <option value="Ibu">Ibu</option>
                <option value="Wali">Wali</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Lengkap *</label>
              <textarea required name="address" value={formData.address} onChange={handleChange} rows={2} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-gray-50 focus:bg-white" placeholder="Alamat tempat tinggal saat ini"></textarea>
            </div>
          </div>
        </div>

        {/* Section 2: Data Siswa */}
        <div className="space-y-5">
          <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-100 pb-2 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm">2</span>
            Data Siswa
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Kelas *</label>
              <select 
                required 
                name="studentClass" 
                value={formData.studentClass} 
                onChange={handleChange} 
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-gray-50 focus:bg-white"
              >
                <option value="">Pilih Kelas</option>
                {classes.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Nama Siswa *</label>
              <select 
                required 
                name="studentName" 
                value={formData.studentName} 
                onChange={handleChange} 
                disabled={!formData.studentClass}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-gray-50 focus:bg-white disabled:opacity-50"
              >
                <option value="">Pilih Nama Siswa</option>
                {filteredStudents.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
              {!formData.studentClass && <p className="text-xs text-gray-400 mt-1 italic">Pilih kelas terlebih dahulu</p>}
            </div>
          </div>
        </div>

        {/* Section 3: Detail Pengaduan */}
        <div className="space-y-5">
          <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-100 pb-2 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center text-sm">3</span>
            Detail Pengaduan
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Pengaduan *</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {COMPLAINT_TYPES.map(type => (
                  <label key={type} className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${formData.complaintType === type ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input type="radio" name="complaintType" value={type} checked={formData.complaintType === type} onChange={handleChange} className="sr-only" />
                    <span className="text-sm font-medium">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {formData.complaintType === 'Lainnya' && (
              <div className="md:col-span-2 animate-in slide-in-from-top-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Sebutkan Jenis Pengaduan *</label>
                <input type="text" required name="complaintTypeOther" value={formData.complaintTypeOther} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-all bg-gray-50 focus:bg-white" placeholder="Ketik jenis pengaduan" />
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Uraian Permasalahan / Kronologi * 
                <span className={`float-right text-xs ${formData.description.length > 500 ? 'text-red-500' : 'text-gray-400'}`}>
                  {formData.description.length}/500
                </span>
              </label>
              <textarea required name="description" value={formData.description} onChange={handleChange} rows={4} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-all bg-gray-50 focus:bg-white" placeholder="Jelaskan secara singkat dan jelas kronologi kejadian..."></textarea>
            </div>

            <div className="grid grid-cols-2 gap-3 md:col-span-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hari Kejadian *</label>
                <select required name="incidentDay" value={formData.incidentDay} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-all bg-gray-50 focus:bg-white">
                  <option value="">Pilih Hari</option>
                  <option value="Senin">Senin</option>
                  <option value="Selasa">Selasa</option>
                  <option value="Rabu">Rabu</option>
                  <option value="Kamis">Kamis</option>
                  <option value="Jumat">Jumat</option>
                  <option value="Sabtu">Sabtu</option>
                  <option value="Minggu">Minggu</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Kejadian *</label>
                <input type="date" required name="incidentDate" value={formData.incidentDate} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-all bg-gray-50 focus:bg-white" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jam Kejadian *</label>
              <input type="time" required name="incidentTime" value={formData.incidentTime} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-all bg-gray-50 focus:bg-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tempat Kejadian *</label>
              <input type="text" required name="incidentLocation" value={formData.incidentLocation} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-all bg-gray-50 focus:bg-white" placeholder="Contoh: Kantin, Kelas, dll" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Bukti Pendukung (Opsional)</label>
              <input type="text" name="evidence" value={formData.evidence} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-all bg-gray-50 focus:bg-white" placeholder="Link Google Drive / Deskripsi bukti (video, chat, dll)" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Harapan Orang Tua *</label>
              <textarea required name="expectation" value={formData.expectation} onChange={handleChange} rows={3} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-all bg-gray-50 focus:bg-white" placeholder="Tindakan yang diharapkan dari pihak sekolah..."></textarea>
            </div>
          </div>
        </div>

        {/* Section 4: Pernyataan */}
        <div className="bg-orange-50 p-5 rounded-2xl border border-orange-100">
          <label className="flex items-start gap-3 cursor-pointer">
            <div className="pt-1">
              <input type="checkbox" required name="declaration" checked={formData.declaration} onChange={handleChange} className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
            </div>
            <span className="text-sm text-orange-800 font-medium leading-relaxed">
              Saya menyatakan bahwa informasi yang saya sampaikan adalah benar dan dapat dipertanggungjawabkan.
            </span>
          </label>
        </div>

        <div className="pt-4 border-t border-gray-100">
          <button
            type="submit"
            disabled={loading || !formData.declaration || formData.description.length > 500}
            className="w-full md:w-auto md:px-12 flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:ring-4 focus:ring-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Kirim Pengaduan
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
