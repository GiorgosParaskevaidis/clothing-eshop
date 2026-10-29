'use client';
import { useEffect, useState } from 'react';
import { AdminArea } from '@/components/admin/admin-area';
import { api } from '@/lib/api';
import type { ShippingSettings } from '@/lib/types';
function Shipping() {
  const [settings, setSettings] = useState<ShippingSettings | null>(null),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [freeEnabled, setFreeEnabled] = useState(true);
  async function load() {
    const value = await api<ShippingSettings>('/admin/shipping');
    setSettings(value);
    setFreeEnabled(value.freeFromCents !== null);
  }
  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, []);
  return (
    <>
      {settings && (
        <form
          key={settings.version}
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            const data = new FormData(event.currentTarget);
            try {
              await api('/admin/shipping', {
                method: 'PUT',
                body: JSON.stringify({
                  ...settings,
                  methodName: data.get('methodName'),
                  costCents: Math.round(Number(data.get('cost')) * 100),
                  freeFromCents:
                    data.get('freeEnabled') === 'on'
                      ? Math.round(Number(data.get('freeFrom')) * 100)
                      : null,
                  enabled: data.get('enabled') === 'on',
                }),
              });
              await load();
              setMessage('Shipping saved. Existing orders keep their original amounts.');
            } catch (error) {
              setMessage(error instanceof Error ? error.message : 'Please retry.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>Greece · EUR</p>
          <label>
            Shipping method
            <input
              name="methodName"
              required
              maxLength={120}
              defaultValue={settings.methodName}
            />
          </label>
          <label>
            Shipping cost (€)
            <input
              name="cost"
              type="number"
              required
              min={0}
              max={1000}
              step="0.01"
              defaultValue={settings.costCents / 100}
            />
          </label>
          <label className="consent">
            <input
              name="freeEnabled"
              type="checkbox"
              checked={freeEnabled}
              onChange={(event) => setFreeEnabled(event.target.checked)}
            />
            Enable a free shipping threshold
          </label>
          <label>
            Free shipping from (€)
            <input
              name="freeFrom"
              type="number"
              disabled={!freeEnabled}
              required={freeEnabled}
              min={0}
              max={100000}
              step="0.01"
              defaultValue={(settings.freeFromCents ?? 8000) / 100}
            />
          </label>
          <label className="consent">
            <input
              name="enabled"
              type="checkbox"
              defaultChecked={settings.enabled}
            />
            Enable shipping
          </label>
          <button
            className="btn red"
            disabled={busy}
          >
            Save shipping
          </button>
        </form>
      )}
      <p role="status">{message}</p>
    </>
  );
}
export default function ShippingPage() {
  return (
    <AdminArea title="Shipping">
      <Shipping />
    </AdminArea>
  );
}
