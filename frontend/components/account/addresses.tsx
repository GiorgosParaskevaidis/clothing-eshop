'use client';
import { useLanguage } from '@/lib/language';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AccountArea } from './account-area';
import type { CustomerAddress } from '@/lib/types';
function AddressBook() {
  const { t } = useLanguage();
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [editing, setEditing] = useState<CustomerAddress | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  async function refresh() {
    setAddresses(await api<CustomerAddress[]>('/account/addresses'));
  }
  useEffect(() => {
    refresh().catch((error) => setMessage(error.message));
  }, []);
  return (
    <>
      <h2>{t('Saved addresses')}</h2>
      {addresses.length === 0 && <p>{t('No saved addresses yet.')}</p>}
      {addresses.map((address) => (
        <article
          className="stack"
          key={address.id}
        >
          <h3>
            {address.label}
            {address.isDefault ? t(' · Default') : ''}
          </h3>
          <p>
            {address.name}
            <br />
            {address.address}
            <br />
            {address.postalCode} {address.city}, {address.country}
            <br />
            {address.phone}
          </p>
          <div className="account-links">
            <button
              className="small-btn"
              disabled={busy}
              onClick={() => {
                setEditing(address);
                setFormVersion((value) => value + 1);
              }}
            >
              {t('Edit ')}
              {address.label}
            </button>
            <button
              className="small-btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api('/account/addresses/' + address.id + '?version=' + address.version, {
                    method: 'DELETE',
                  });
                  await refresh();
                  setMessage('Address removed.');
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : 'Please retry.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t('Remove ')}
              {address.label}
            </button>
          </div>
        </article>
      ))}
      <h2>{editing ? t('Edit address') : t('Add an address')}</h2>
      <form
        key={formVersion}
        className="stack"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          const data = new FormData(event.currentTarget);
          const value = {
            label: data.get('label'),
            name: data.get('name'),
            address: data.get('address'),
            city: data.get('city'),
            postalCode: data.get('postalCode'),
            country: 'GR',
            phone: data.get('phone') ?? '',
            isDefault: data.get('isDefault') === 'on',
            version: editing?.version ?? 0,
          };
          try {
            await api('/account/addresses' + (editing ? '/' + editing.id : ''), {
              method: editing ? 'PUT' : 'POST',
              body: JSON.stringify(value),
            });
            setEditing(null);
            setFormVersion((value) => value + 1);
            await refresh();
            setMessage('Address saved.');
          } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Please retry.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          {t('Address label')}
          <input
            name="label"
            required
            maxLength={60}
            defaultValue={editing?.label ?? ''}
            placeholder={t('Home, work…')}
          />
        </label>
        <label>
          {t('Full name')}
          <input
            name="name"
            required
            maxLength={120}
            autoComplete="name"
            defaultValue={editing?.name ?? ''}
          />
        </label>
        <label>
          {t('Street address')}
          <input
            name="address"
            required
            maxLength={250}
            autoComplete="street-address"
            defaultValue={editing?.address ?? ''}
          />
        </label>
        <label>
          {t('City')}
          <input
            name="city"
            required
            maxLength={120}
            autoComplete="address-level2"
            defaultValue={editing?.city ?? ''}
          />
        </label>
        <label>
          {t('Postal code')}
          <input
            name="postalCode"
            required
            maxLength={24}
            autoComplete="postal-code"
            defaultValue={editing?.postalCode ?? ''}
          />
        </label>
        <label>
          {t('Telephone')}
          <input
            name="phone"
            type="tel"
            maxLength={32}
            autoComplete="tel"
            defaultValue={editing?.phone ?? ''}
          />
        </label>
        <p>{t('Country: Greece')}</p>
        <label className="check">
          <input
            type="checkbox"
            name="isDefault"
            defaultChecked={editing?.isDefault ?? addresses.length === 0}
          />
          {t('Use as default shipping address')}
        </label>
        <button
          className="btn red"
          disabled={busy}
        >
          {t('Save address')}
        </button>
        {editing && (
          <button
            type="button"
            className="small-btn"
            onClick={() => {
              setEditing(null);
              setFormVersion((value) => value + 1);
            }}
          >
            {t('Cancel editing')}
          </button>
        )}
      </form>
      <p role="status">{t(message)}</p>
    </>
  );
}
export function CustomerAddressesPage() {
  const { t } = useLanguage();
  return (
    <AccountArea title={t('Your addresses')}>
      <AddressBook />
    </AccountArea>
  );
}
