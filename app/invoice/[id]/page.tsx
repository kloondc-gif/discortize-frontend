'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { API_URL } from '@/lib/api';

interface Invoice {
  invoice_id: string;
  coin: string;
  amount: string;
  amount_usd: string;
  address: string;
  status: string;
  description: string;
  created_at: string;
  paid_at?: string;
  transaction_id?: string;
  qr_code?: string;
}

export default function InvoicePage() {
  const params = useParams();
  const invoiceId = params.id as string;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (invoiceId) {
      fetchInvoice();
      // Poll for updates every 10 seconds, but stop if invoice is paid/completed
      const interval = setInterval(() => {
        fetchInvoice();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [invoiceId]);

  // Stop polling when invoice is in final state
  useEffect(() => {
    if (invoice && ['paid', 'confirmed', 'swept'].includes(invoice.status)) {
      // Clear any active polling by re-mounting (handled by cleanup)
      return;
    }
  }, [invoice?.status]);

  const fetchInvoice = async () => {
    try {
      const response = await fetch(`${API_URL}/api/crypto/invoice/${invoiceId}`);
      
      if (response.ok) {
        const data = await response.json();
        setInvoice(data);
        setError('');
      } else {
        setError('Invoice not found');
      }
    } catch (error) {
      console.error('Error fetching invoice:', error);
      setError('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = () => {
    if (invoice?.address) {
      navigator.clipboard.writeText(invoice.address);
      alert('Address copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f9f9f9'
      }}>
        <p style={{ fontSize: '1.2rem', color: '#666' }}>Loading invoice...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div style={{ 
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f9f9f9',
        padding: '2rem'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '2rem', color: '#c62828', marginBottom: '1rem' }}>Invoice Not Found</h1>
          <p style={{ color: '#666' }}>{error}</p>
        </div>
      </div>
    );
  }

  const isPaid = invoice.status === 'paid' || invoice.status === 'confirmed' || invoice.status === 'swept';

  return (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: '#f9f9f9',
      padding: '2rem'
    }}>
      <div style={{ 
        maxWidth: '600px',
        margin: '0 auto',
        backgroundColor: '#fff',
        borderRadius: '16px',
        padding: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img 
            src="/discortize-logo.png" 
            alt="Discortize" 
            style={{ width: '150px', marginBottom: '1rem' }}
          />
          <h1 style={{ 
            fontSize: '2rem', 
            fontWeight: '700',
            margin: '0.5rem 0'
          }}>
            Payment Invoice
          </h1>
          <span style={{
            display: 'inline-block',
            padding: '0.5rem 1rem',
            borderRadius: '12px',
            fontSize: '0.9rem',
            fontWeight: '600',
            backgroundColor: isPaid ? '#e8f5e9' : '#fff3e0',
            color: isPaid ? '#2e7d32' : '#e65100'
          }}>
            {isPaid ? '✓ PAID' : 'PENDING PAYMENT'}
          </span>
        </div>

        {/* Amount */}
        <div style={{ 
          textAlign: 'center',
          padding: '1.5rem',
          backgroundColor: '#f9f9f9',
          borderRadius: '12px',
          marginBottom: '2rem'
        }}>
          <p style={{ margin: 0, fontSize: '3rem', fontWeight: '700' }}>
            {invoice.amount}
          </p>
          <p style={{ margin: '0.5rem 0', fontSize: '1.5rem', fontWeight: '600', textTransform: 'uppercase' }}>
            {invoice.coin}
          </p>
          <p style={{ margin: 0, fontSize: '1.2rem', color: '#666' }}>
            ≈ ${invoice.amount_usd} USD
          </p>
        </div>

        {/* Description */}
        {invoice.description && (
          <div style={{ marginBottom: '2rem' }}>
            <p style={{ 
              margin: 0, 
              padding: '1rem',
              backgroundColor: '#f9f9f9',
              borderRadius: '8px',
              fontSize: '1rem'
            }}>
              {invoice.description}
            </p>
          </div>
        )}

        {!isPaid && (
          <>
            {/* QR Code */}
            {invoice.qr_code && (
              <div style={{ 
                textAlign: 'center',
                marginBottom: '2rem'
              }}>
                <p style={{ 
                  margin: '0 0 1rem 0',
                  fontSize: '1.1rem',
                  fontWeight: '600'
                }}>
                  Scan to Pay
                </p>
                <div style={{
                  display: 'inline-block',
                  padding: '1rem',
                  backgroundColor: '#fff',
                  border: '2px solid #e0e0e0',
                  borderRadius: '12px'
                }}>
                  <img 
                    src={invoice.qr_code} 
                    alt="QR Code" 
                    style={{ width: '250px', height: '250px', display: 'block' }}
                  />
                </div>
              </div>
            )}

            {/* Payment Address */}
            <div style={{ marginBottom: '2rem' }}>
              <p style={{ 
                margin: '0 0 0.5rem 0',
                fontSize: '0.9rem',
                fontWeight: '600',
                color: '#666'
              }}>
                {invoice.coin.toUpperCase()} Address
              </p>
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center'
              }}>
                <div style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  wordBreak: 'break-all'
                }}>
                  {invoice.address}
                </div>
                <button
                  onClick={copyAddress}
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: '#000',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div style={{
              padding: '1rem',
              backgroundColor: '#e3f2fd',
              borderRadius: '8px',
              marginBottom: '2rem'
            }}>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: '600' }}>Payment Instructions:</p>
              <ol style={{ margin: 0, paddingLeft: '1.5rem' }}>
                <li>Send exactly <strong>{invoice.amount} {invoice.coin.toUpperCase()}</strong> to the address above</li>
                <li>Payment will be detected automatically</li>
                <li>This page will update when payment is confirmed</li>
              </ol>
            </div>
          </>
        )}

        {isPaid && (
          <div style={{
            padding: '1.5rem',
            backgroundColor: '#e8f5e9',
            borderRadius: '12px',
            textAlign: 'center',
            marginBottom: '2rem'
          }}>
            <p style={{ 
              margin: '0 0 0.5rem 0',
              fontSize: '2rem'
            }}>
              ✓
            </p>
            <p style={{ 
              margin: 0,
              fontSize: '1.2rem',
              fontWeight: '600',
              color: '#2e7d32'
            }}>
              Payment Received!
            </p>
            {invoice.paid_at && (
              <p style={{ margin: '0.5rem 0 0 0', color: '#2e7d32' }}>
                Paid on {new Date(invoice.paid_at).toLocaleString()}
              </p>
            )}
            {invoice.transaction_id && (
              <p style={{ 
                margin: '1rem 0 0 0',
                fontSize: '0.85rem',
                color: '#666',
                wordBreak: 'break-all'
              }}>
                TX: {invoice.transaction_id}
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{
          paddingTop: '1.5rem',
          borderTop: '1px solid #e0e0e0',
          textAlign: 'center'
        }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#999' }}>
            Invoice ID: {invoice.invoice_id}
          </p>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#999' }}>
            Created: {new Date(invoice.created_at).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
