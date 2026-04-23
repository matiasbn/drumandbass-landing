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
        {skippedRows.length > 0 && (
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
                  <th className="text-left py-2 pr-4">Nombre</th>
                  <th className="text-left py-2 pr-4">Apellido</th>
                  <th className="text-left py-2 pr-4">Email</th>
                  <th className="text-left py-2 pr-4">Instagram</th>
                  <th className="text-left py-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((sub) => (
                  <tr key={sub.id} className="border-b border-gray-300">
                    <td className="py-2 pr-4">{sub.name || '-'}</td>
                    <td className="py-2 pr-4">{sub.last_name || '-'}</td>
                    <td className="py-2 pr-4">{sub.email}</td>
                    <td className="py-2 pr-4">{sub.instagram || '-'}</td>
                    <td className="py-2">{new Date(sub.created_at).toLocaleDateString('es-CL')}</td>
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
