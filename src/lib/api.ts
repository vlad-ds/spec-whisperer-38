import { supabase } from "@/integrations/supabase/client";

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

export const uploadContract = async (file: File): Promise<ContractRecord> => {
  const formData = new FormData();
  formData.append('file', file);

  const { data, error } = await supabase.functions.invoke('contract-api', {
    body: formData,
    headers: {
      'action': 'upload',
    },
  });

  if (error) {
    throw new Error(error.message || 'Upload failed');
  }

  // Check if the response contains an error (e.g., 501 Not Implemented)
  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
};

export const getContract = async (id: string): Promise<ContractRecord> => {
  const { data, error } = await supabase.functions.invoke('contract-api', {
    body: { action: 'get', id },
  });

  if (error) {
    throw new Error('Failed to fetch contract');
  }

  return data;
};

export const markAsReviewed = async (id: string): Promise<void> => {
  const { error } = await supabase.functions.invoke('contract-api', {
    body: { action: 'mark-reviewed', id },
  });

  if (error) {
    throw new Error('Failed to mark as reviewed');
  }
};

// Map frontend camelCase field names to Airtable snake_case field names
const fieldNameMap: Record<string, string> = {
  contractType: 'contract_type',
  agreementDate: 'agreement_date',
  effectiveDate: 'effective_date',
  expirationDate: 'expiration_date',
  expirationType: 'expiration_type',
  noticeDeadline: 'notice_deadline',
  firstRenewalDate: 'first_renewal_date',
  governingLaw: 'governing_law',
  noticePeriod: 'notice_period',
  renewalTerm: 'renewal_term',
  reviewedAt: 'reviewed_at',
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

  // Convert camelCase to snake_case for Airtable
  const airtableFieldName = fieldNameMap[fieldName] || fieldName;

  const { data, error } = await supabase.functions.invoke('contract-api', {
    body: {
      action: 'update-field',
      id: contractId,
      field_name: airtableFieldName,
      original_value: originalValue,
      new_value: newValue,
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to update field');
  }

  // Check for API error in response
  if (data?.error) {
    throw new Error(data.error);
  }
};

export const deleteContract = async (id: string): Promise<void> => {
  const { data, error } = await supabase.functions.invoke('contract-api', {
    body: { action: 'delete', id },
  });

  if (error) {
    throw new Error('Failed to delete contract');
  }

  if (data?.error) {
    throw new Error(data.error);
  }
};

export const getPdfUrl = async (id: string): Promise<{ pdfUrl: string | null; filename: string | null }> => {
  const { data, error } = await supabase.functions.invoke('contract-api', {
    body: { action: 'get-pdf-url', id },
  });

  if (error) {
    throw new Error('Failed to fetch PDF URL');
  }

  return data;
};
