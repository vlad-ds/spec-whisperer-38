import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const CACHE_KEY = 'airtable_schema';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface CachedSchema {
  selectFields: Record<string, string[]>;
  cachedAt: number;
}

interface SchemaResponse {
  selectFields: Record<string, string[]>;
}

const getFromLocalStorage = (): SchemaResponse | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const parsed: CachedSchema = JSON.parse(cached);
    const isExpired = Date.now() - parsed.cachedAt > CACHE_TTL;
    
    if (isExpired) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    
    return { selectFields: parsed.selectFields };
  } catch {
    return null;
  }
};

const saveToLocalStorage = (data: SchemaResponse) => {
  try {
    const cached: CachedSchema = {
      selectFields: data.selectFields,
      cachedAt: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Ignore storage errors
  }
};

const fetchSchema = async (): Promise<SchemaResponse> => {
  // Check localStorage first
  const cached = getFromLocalStorage();
  if (cached) {
    return cached;
  }

  const { data, error } = await supabase.functions.invoke('contract-api', {
    body: { action: 'get-schema' },
  });

  if (error || data?.error) {
    throw new Error(data?.error || error?.message || 'Failed to fetch schema');
  }

  // Save to localStorage
  saveToLocalStorage(data);
  
  return data;
};

export const useAirtableSchema = () => {
  return useQuery({
    queryKey: ['airtable-schema'],
    queryFn: fetchSchema,
    staleTime: CACHE_TTL,
    gcTime: CACHE_TTL,
    retry: 1,
  });
};

// Default contract types as fallback
export const DEFAULT_CONTRACT_TYPES = [
  "affiliate-license-licensor",
  "affiliate-license-licensee",
  "co-branding",
  "collaboration",
  "development",
  "distributor",
  "endorsement",
  "franchise",
  "hosting",
  "ip-license-licensor",
  "ip-license-licensee",
  "joint-venture",
  "license",
  "maintenance",
  "manufacturing",
  "marketing",
  "non-compete",
  "outsourcing",
  "promotion",
  "reseller",
  "services",
  "sponsorship",
  "supply",
  "strategic-alliance",
  "transportation",
  "other"
];
