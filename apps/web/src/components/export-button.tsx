'use client';
import { downloadUrl } from '@/lib/api';

// The server answers with Content-Disposition: attachment, so navigating to it just saves the file.
export function ExportButton({ label, path }: { label: string; path: string }) {
  return <button type="button" className="sec" onClick={() => { window.location.href = downloadUrl(path); }}>{label}</button>;
}
