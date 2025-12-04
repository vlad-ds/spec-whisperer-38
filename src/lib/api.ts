const API_URL = import.meta.env.VITE_API_URL || 'https://complyflow-production.up.railway.app';
const API_KEY = import.meta.env.VITE_API_KEY || '';

export interface ContractRecord {
  id: string;
  fields: {
    filename: string;
    parties: string;
    contract_type: string;
    agreement_date: string | null;
    effective_date: string | null;
    expiration_date: string | null;
    expiration_type: string;
    notice_deadline: string | null;
    first_renewal_date: string | null;
    governing_law: string | null;
    notice_period: string | null;
    renewal_term: string | null;
    status: 'under_review' | 'reviewed';
    reviewed_at: string | null;
  };
  created_time: string;
}

export interface ParsedContract {
  id: string;
  filename: string;
  parties: string[];
  contractType: string;
  agreementDate: Date | null;
  effectiveDate: Date | null;
  expirationDate: Date | null;
  expirationType: string;
  noticeDeadline: Date | null;
  firstRenewalDate: Date | null;
  governingLaw: string;
  noticePeriod: string;
  renewalTerm: string;
  status: 'under_review' | 'reviewed';
  reviewedAt: Date | null;
  createdAt: Date;
}

export const CONTRACT_TYPES = [
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
] as const;

export const parseContract = (record: ContractRecord): ParsedContract => ({
  id: record.id,
  filename: record.fields.filename,
  parties: JSON.parse(record.fields.parties || '[]'),
  contractType: record.fields.contract_type,
  agreementDate: record.fields.agreement_date ? new Date(record.fields.agreement_date) : null,
  effectiveDate: record.fields.effective_date ? new Date(record.fields.effective_date) : null,
  expirationDate: record.fields.expiration_date ? new Date(record.fields.expiration_date) : null,
  expirationType: record.fields.expiration_type || '',
  noticeDeadline: record.fields.notice_deadline ? new Date(record.fields.notice_deadline) : null,
  firstRenewalDate: record.fields.first_renewal_date ? new Date(record.fields.first_renewal_date) : null,
  governingLaw: record.fields.governing_law || '',
  noticePeriod: record.fields.notice_period || '',
  renewalTerm: record.fields.renewal_term || '',
  status: record.fields.status,
  reviewedAt: record.fields.reviewed_at ? new Date(record.fields.reviewed_at) : null,
  createdAt: new Date(record.created_time),
});

const getHeaders = () => ({
  'X-API-Key': API_KEY,
});

export const uploadContract = async (file: File): Promise<ContractRecord> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/contracts/upload`, {
    method: 'POST',
    headers: getHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(error.detail || getErrorMessage(response.status));
  }

  return response.json();
};

export const getContract = async (id: string): Promise<ContractRecord> => {
  const response = await fetch(`${API_URL}/contracts/${id}`, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch contract');
  }

  return response.json();
};

export const markAsReviewed = async (id: string): Promise<void> => {
  const response = await fetch(`${API_URL}/contracts/${id}/review`, {
    method: 'PATCH',
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to mark as reviewed');
  }
};

export const updateField = async (
  contractId: string,
  fieldName: string,
  originalValue: unknown,
  newValue: unknown
): Promise<void> => {
  if (JSON.stringify(originalValue) === JSON.stringify(newValue)) {
    return;
  }

  const response = await fetch(`${API_URL}/contracts/${contractId}/fields`, {
    method: 'PATCH',
    headers: {
      ...getHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      field_name: fieldName,
      original_value: originalValue,
      new_value: newValue,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to update field');
  }
};

const getErrorMessage = (status: number): string => {
  switch (status) {
    case 400:
      return 'Invalid file. Please upload a PDF.';
    case 401:
      return 'Unauthorized. Check API key.';
    case 413:
      return 'File too large. Maximum size is 10MB.';
    case 502:
      return 'AI extraction failed. Please try again.';
    case 504:
      return 'Request timed out. Please try again.';
    default:
      return 'An unexpected error occurred.';
  }
};
