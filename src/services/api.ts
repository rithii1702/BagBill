import { Invoice, Party, Product, BusinessSettings } from '../types';

const API_BASE = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || `Request failed with status ${response.status}`);
    }

    return result.data !== undefined ? result.data : result;
  } catch (err: any) {
    // If proxied fetch failed (e.g. during offline or local transition), try direct localhost:5000 fallback
    if (url.startsWith('/api') && (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError'))) {
      const fallbackUrl = `http://localhost:5000${url}`;
      const fbRes = await fetch(fallbackUrl, { ...options, headers });
      const fbResult = await fbRes.json();
      if (!fbRes.ok) {
        throw new Error(fbResult.message || `Request failed with status ${fbRes.status}`);
      }
      return fbResult.data !== undefined ? fbResult.data : fbResult;
    }
    throw err;
  }
}

export const api = {
  bills: {
    getAll: async (params?: Record<string, string>): Promise<Invoice[]> => {
      const query = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<Invoice[]>(`/bills${query}`);
    },
    getById: async (id: string): Promise<Invoice> => {
      return request<Invoice>(`/bills/${id}`);
    },
    getNextNumber: async (): Promise<{ invoiceNumber: string; nextSequence: number }> => {
      return request<{ invoiceNumber: string; nextSequence: number }>('/bills/next-number');
    },
    create: async (bill: Partial<Invoice>): Promise<Invoice> => {
      return request<Invoice>('/bills', {
        method: 'POST',
        body: JSON.stringify(bill),
      });
    },
    update: async (id: string, bill: Partial<Invoice>): Promise<Invoice> => {
      return request<Invoice>(`/bills/${id}`, {
        method: 'PUT',
        body: JSON.stringify(bill),
      });
    },
    delete: async (id: string): Promise<{ success: boolean; message: string }> => {
      return request<{ success: boolean; message: string }>(`/bills/${id}`, {
        method: 'DELETE',
      });
    },
    recordPayment: async (id: string, payment: {
      amount: number;
      date?: string;
      method?: string;
      reference?: string;
      notes?: string;
    }): Promise<Invoice> => {
      return request<Invoice>(`/bills/${id}/payments`, {
        method: 'POST',
        body: JSON.stringify(payment),
      });
    },
  },

  parties: {
    getAll: async (params?: Record<string, string>): Promise<Party[]> => {
      const query = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<Party[]>(`/parties${query}`);
    },
    getById: async (id: string): Promise<Party & { bills?: Invoice[] }> => {
      return request<Party & { bills?: Invoice[] }>(`/parties/${id}`);
    },
    create: async (party: Partial<Party>): Promise<Party> => {
      return request<Party>('/parties', {
        method: 'POST',
        body: JSON.stringify(party),
      });
    },
    update: async (id: string, party: Partial<Party>): Promise<Party> => {
      return request<Party>(`/parties/${id}`, {
        method: 'PUT',
        body: JSON.stringify(party),
      });
    },
    delete: async (id: string, permanent: boolean = false): Promise<any> => {
      return request<any>(`/parties/${id}${permanent ? '?permanent=true' : ''}`, {
        method: 'DELETE',
      });
    },
  },

  products: {
    getAll: async (params?: Record<string, string>): Promise<Product[]> => {
      const query = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<Product[]>(`/products${query}`);
    },
    getById: async (id: string): Promise<Product> => {
      return request<Product>(`/products/${id}`);
    },
    create: async (product: Partial<Product>): Promise<Product> => {
      return request<Product>('/products', {
        method: 'POST',
        body: JSON.stringify(product),
      });
    },
    update: async (id: string, product: Partial<Product>): Promise<Product> => {
      return request<Product>(`/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(product),
      });
    },
    delete: async (id: string, permanent: boolean = false): Promise<any> => {
      return request<any>(`/products/${id}${permanent ? '?permanent=true' : ''}`, {
        method: 'DELETE',
      });
    },
  },

  settings: {
    get: async (): Promise<BusinessSettings> => {
      return request<BusinessSettings>('/settings');
    },
    update: async (settings: Partial<BusinessSettings>): Promise<BusinessSettings> => {
      return request<BusinessSettings>('/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
    },
  },

  dashboard: {
    getSummary: async (params?: Record<string, string>): Promise<any> => {
      const query = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any>(`/dashboard/summary${query}`);
    },
  },
};

export default api;
