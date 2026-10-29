'use client';
import { useEffect, useState } from 'react';
import { AdminArea } from '@/components/admin/admin-area';
import { api } from '@/lib/api';
type Data = {
  items: {
    id: string;
    kind: string;
    state: string;
    attempts: number;
    lastCode: string | null;
    createdUtc: string;
    providerReference: string | null;
  }[];
  page: number;
  pageSize: number;
  total: number;
  incidents: { id: number; orderId: string; reason: string; amountCents: number }[];
};
function Jobs() {
  const [page, setPage] = useState(1),
    [data, setData] = useState<Data | null>(null),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  async function load() {
    setData(await api<Data>('/admin/operations/jobs?page=' + page));
  }
  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="stack">
      <p>
        Jobs survive restarts. A dead-letter job needs review before retry. SMTP delivery can be
        duplicated after an uncertain network outcome; a stable Message-ID helps identify retries.
      </p>
      <button
        className="small-btn"
        onClick={() => void load().catch((error) => setMessage(error.message))}
      >
        Refresh jobs
      </button>
      {data?.incidents.map((incident) => (
        <article
          className="notice"
          key={incident.id}
        >
          <strong>Payment review required</strong>
          <p>
            {incident.reason} · order {incident.orderId} · {incident.amountCents} cents
          </p>
        </article>
      ))}
      {data?.items.map((job) => (
        <article
          key={job.id}
          className="stack"
        >
          <h2>
            {job.kind} · {job.state}
          </h2>
          <p>
            Attempts: {job.attempts} · {job.lastCode ?? 'No error'}
          </p>
          {job.providerReference && (
            <p className="break-word">Provider event: {job.providerReference}</p>
          )}
          {job.state === 'dead' && (
            <button
              className="small-btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api('/admin/operations/jobs/' + job.id + '/replay', { method: 'POST' });
                  await load();
                  setMessage('Job queued for replay.');
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : 'Please retry.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Replay job {job.id}
            </button>
          )}
        </article>
      ))}
      {data && (
        <nav
          aria-label="Job pages"
          className="account-links"
        >
          <button
            className="small-btn"
            disabled={page === 1}
            onClick={() => setPage((v) => v - 1)}
          >
            Previous
          </button>
          <span>Page {page}</span>
          <button
            className="small-btn"
            disabled={page * data.pageSize >= data.total}
            onClick={() => setPage((v) => v + 1)}
          >
            Next
          </button>
        </nav>
      )}
      <p role="status">{message}</p>
    </div>
  );
}
export default function Page() {
  return (
    <AdminArea title="Background jobs">
      <Jobs />
    </AdminArea>
  );
}
