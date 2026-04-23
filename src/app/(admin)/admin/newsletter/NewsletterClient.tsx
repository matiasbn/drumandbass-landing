'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/src/components/admin/AdminAuthContext';
import * as XLSX from 'xlsx';

interface ParsedRow {
  name: string;
  last_name: string;
  email: string;
  instagram: string;
}

interface RowResult {
  email: string;
  status: 'pending' | 'inserted' | 'updated' | 'error';
  error?: string;
}

interface Subscriber {
  id: string;
  name: string | null;
  last_name: string | null;
  email: string;
  instagram: string | null;
  created_at: string;
}

export default function NewsletterClient() {
  const { loading, isAdmin } = useAdminAuth();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(true);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [skippedRows, setSkippedRows] = useState<ParsedRow[]>([]);
  const [importResults, setImportResults] = useState<RowResult[]>([]);
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sortKey, setSortKey] = useState<keyof Subscriber>('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; last_name: string; email: string; instagram: string }>({ name: '', last_name: '', email: '', instagram: '' });
  const [saving, setSaving] = useState(false);

  const fetchSubscribers = useCallback(async () => {
    setLoadingSubscribers(true);
    try {
      const res = await fetch('/api/admin/newsletter');
      const data = await res.json();
      if (data.subscribers) setSubscribers(data.subscribers);
    } catch {
      // ignore
    } finally {
      setLoadingSubscribers(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchSubscribers();
  }, [isAdmin, fetchSubscribers]);

  if (loading) {
    return (
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-black border-r-transparent" />
        <p className="mt-4 mono text-sm uppercase">Cargando...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="brutalist-border bg-white p-8 brutalist-shadow text-center max-w-md">
        <p className="mono text-sm uppercase">No autorizado</p>
      </div>
    );
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParseError(null);
    setParsedRows([]);
    setSkippedRows([]);
    setImportResults([]);

    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

        const rows: ParsedRow[] = json.map((row) => ({
          name: (row['NAME'] || row['name'] || row['Name'] || '').toString().trim(),
          last_name: (row['LAST_NAME'] || row['last_name'] || row['Last_Name'] || row['Last Name'] || '').toString().trim(),
          email: (row['EMAIL'] || row['email'] || row['Email'] || '').toString().trim().toLowerCase(),
          instagram: (row['INSTAGRAM'] || row['instagram'] || row['Instagram'] || '').toString().trim(),
        }));

        const validRows = rows.filter((r) => r.email);
        if (validRows.length === 0) {
          setParseError('No se encontraron filas con email valido');
          return;
        }

        // Filter out emails that already exist
        const existingEmails = new Set(subscribers.map((s) => s.email.toLowerCase()));
        const newRows = validRows.filter((r) => !existingEmails.has(r.email));
        const duplicates = validRows.filter((r) => existingEmails.has(r.email));

        setSkippedRows(duplicates);

        if (newRows.length === 0) {
          setParseError(`Todos los ${validRows.length} emails ya existen en la base de datos`);
          return;
        }

        setParsedRows(newRows);
      } catch {
        setParseError('Error al leer el archivo Excel');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (parsedRows.length === 0) return;
    setImporting(true);

    // Initialize all as pending
    setImportResults(parsedRows.map((r) => ({ email: r.email, status: 'pending' })));

    try {
      const res = await fetch('/api/admin/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsedRows }),
      });
      const data = await res.json();

      if (data.results) {
        setImportResults(data.results);
      }

      // Refresh subscribers list
      await fetchSubscribers();
    } catch {
      setImportResults(parsedRows.map((r) => ({ email: r.email, status: 'error', error: 'Error de red' })));
    } finally {
      setImporting(false);
    }
  };

  const startEdit = (sub: Subscriber) => {
    setEditingId(sub.id);
    setEditForm({
      name: sub.name || '',
      last_name: sub.last_name || '',
      email: sub.email,
      instagram: sub.instagram || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/newsletter', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...editForm }),
      });
      const data = await res.json();
      if (data.subscriber) {
        setSubscribers((prev) => prev.map((s) => s.id === editingId ? data.subscriber : s));
        setEditingId(null);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Eliminar suscriptor ${email}?`)) return;
    try {
      const res = await fetch(`/api/admin/newsletter?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSubscribers((prev) => prev.filter((s) => s.id !== id));
      }
    } catch {
      // ignore
    }
  };

  const toggleSort = (key: keyof Subscriber) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const sortedSubscribers = [...subscribers].sort((a, b) => {
    const valA = (a[sortKey] ?? '') as string;
    const valB = (b[sortKey] ?? '') as string;
    const cmp = valA.localeCompare(valB, 'es', { sensitivity: 'base' });
    return sortAsc ? cmp : -cmp;
  });

  const sortArrow = (key: keyof Subscriber) =>
    sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : '';

  const statusBadge = (status: string) => {
    switch (status) {
      case 'inserted':
        return <span className="bg-green-200 text-green-800 px-2 py-0.5 text-xs font-bold uppercase">Insertado</span>;
      case 'updated':
        return <span className="bg-blue-200 text-blue-800 px-2 py-0.5 text-xs font-bold uppercase">Actualizado</span>;
      case 'error':
        return <span className="bg-red-200 text-red-800 px-2 py-0.5 text-xs font-bold uppercase">Error</span>;
      case 'pending':
        return <span className="bg-gray-200 text-gray-600 px-2 py-0.5 text-xs font-bold uppercase">Pendiente</span>;
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/admin" className="mono text-sm text-gray-600 hover:text-black uppercase">
            &larr; Volver al Admin
          </Link>
          <h1 className="text-3xl font-black uppercase mt-2">Newsletter</h1>
        </div>
      </div>

      {/* Upload Section */}
      <div className="brutalist-border bg-white p-6 brutalist-shadow mb-8">
        <h2 className="text-xl font-black uppercase mb-4">Importar Suscriptores</h2>
        <p className="mono text-sm text-gray-600 mb-4">
          Sube un archivo Excel (.xlsx) con columnas: NAME, LAST_NAME, EMAIL, INSTAGRAM
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileUpload}
          className="hidden"
        />
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="brutalist-border bg-white px-6 py-2 font-bold uppercase text-sm hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Seleccionar archivo
          </button>
          <span className="mono text-sm text-gray-600">
            {fileName || 'Ningun archivo seleccionado'}
          </span>
        </div>
        {parseError && (
          <p className="text-red-600 mono text-sm mb-4">{parseError}</p>
        )}
        {skippedRows.length > 0 && !parseError && (
          <p className="text-gray-600 mono text-sm mb-4">
            {skippedRows.length} email{skippedRows.length > 1 ? 's' : ''} ya existente{skippedRows.length > 1 ? 's' : ''} filtrado{skippedRows.length > 1 ? 's' : ''} automaticamente
          </p>
        )}
      </div>

      {/* Preview */}
      {parsedRows.length > 0 && (
        <div className="brutalist-border bg-white p-6 brutalist-shadow mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black uppercase">
              Preview ({parsedRows.length} filas)
            </h2>
            <button
              onClick={handleImport}
              disabled={importing}
              className="brutalist-border bg-black text-white px-6 py-2 font-bold uppercase hover:bg-gray-900 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {importing ? 'Importando...' : 'Importar'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full mono text-sm">
              <thead>
                <tr className="border-b-4 border-black">
                  <th className="text-left py-2 pr-4">#</th>
                  <th className="text-left py-2 pr-4">Nombre</th>
                  <th className="text-left py-2 pr-4">Apellido</th>
                  <th className="text-left py-2 pr-4">Email</th>
                  <th className="text-left py-2 pr-4">Instagram</th>
                  {importResults.length > 0 && <th className="text-left py-2">Estado</th>}
                </tr>
              </thead>
              <tbody>
                {parsedRows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-300">
                    <td className="py-2 pr-4 text-gray-500">{i + 1}</td>
                    <td className="py-2 pr-4">{row.name || '-'}</td>
                    <td className="py-2 pr-4">{row.last_name || '-'}</td>
                    <td className="py-2 pr-4">{row.email}</td>
                    <td className="py-2 pr-4">{row.instagram || '-'}</td>
                    {importResults.length > 0 && (
                      <td className="py-2">
                        {statusBadge(importResults[i]?.status)}
                        {importResults[i]?.error && (
                          <span className="ml-2 text-red-600 text-xs">{importResults[i].error}</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Existing Subscribers */}
      <div className="brutalist-border bg-white p-6 brutalist-shadow">
        <h2 className="text-xl font-black uppercase mb-4">
          Suscriptores ({loadingSubscribers ? '...' : subscribers.length})
        </h2>

        {loadingSubscribers ? (
          <div className="text-center py-8">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-black border-r-transparent" />
          </div>
        ) : subscribers.length === 0 ? (
          <p className="mono text-sm text-gray-600">No hay suscriptores aun.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full mono text-sm">
              <thead>
                <tr className="border-b-4 border-black">
                  <th className="text-left py-2 pr-4 cursor-pointer select-none hover:text-gray-600" onClick={() => toggleSort('name')}>Nombre{sortArrow('name')}</th>
                  <th className="text-left py-2 pr-4 cursor-pointer select-none hover:text-gray-600" onClick={() => toggleSort('last_name')}>Apellido{sortArrow('last_name')}</th>
                  <th className="text-left py-2 pr-4 cursor-pointer select-none hover:text-gray-600" onClick={() => toggleSort('email')}>Email{sortArrow('email')}</th>
                  <th className="text-left py-2 pr-4 cursor-pointer select-none hover:text-gray-600" onClick={() => toggleSort('instagram')}>Instagram{sortArrow('instagram')}</th>
                  <th className="text-left py-2 pr-4 cursor-pointer select-none hover:text-gray-600" onClick={() => toggleSort('created_at')}>Fecha{sortArrow('created_at')}</th>
                  <th className="text-left py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sortedSubscribers.map((sub) => (
                  <tr key={sub.id} className="border-b border-gray-300">
                    {editingId === sub.id ? (
                      <>
                        <td className="py-2 pr-2">
                          <input
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="w-full border-2 border-black px-2 py-1 text-sm"
                            placeholder="Nombre"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            value={editForm.last_name}
                            onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                            className="w-full border-2 border-black px-2 py-1 text-sm"
                            placeholder="Apellido"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            value={editForm.email}
                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                            className="w-full border-2 border-black px-2 py-1 text-sm"
                            placeholder="Email"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            value={editForm.instagram}
                            onChange={(e) => setEditForm({ ...editForm, instagram: e.target.value })}
                            className="w-full border-2 border-black px-2 py-1 text-sm"
                            placeholder="Instagram"
                          />
                        </td>
                        <td className="py-2 pr-4 text-gray-500">{new Date(sub.created_at).toLocaleDateString('es-CL')}</td>
                        <td className="py-2">
                          <div className="flex gap-2">
                            <button
                              onClick={saveEdit}
                              disabled={saving}
                              className="bg-black text-white px-3 py-1 text-xs font-bold uppercase hover:bg-gray-900 cursor-pointer disabled:opacity-50"
                            >
                              {saving ? '...' : 'Guardar'}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="border-2 border-black px-3 py-1 text-xs font-bold uppercase hover:bg-gray-100 cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 pr-4">{sub.name || '-'}</td>
                        <td className="py-2 pr-4">{sub.last_name || '-'}</td>
                        <td className="py-2 pr-4">{sub.email}</td>
                        <td className="py-2 pr-4">{sub.instagram || '-'}</td>
                        <td className="py-2 pr-4">{new Date(sub.created_at).toLocaleDateString('es-CL')}</td>
                        <td className="py-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEdit(sub)}
                              className="border-2 border-black px-3 py-1 text-xs font-bold uppercase hover:bg-gray-100 cursor-pointer"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDelete(sub.id, sub.email)}
                              className="border-2 border-red-600 text-red-600 px-3 py-1 text-xs font-bold uppercase hover:bg-red-50 cursor-pointer"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
