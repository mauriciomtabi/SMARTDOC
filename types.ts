

export enum DocCategory {
  INVOICE = 'Nota Fiscal',
  PERSONAL = 'Documento Pessoal',
  CONTRACT = 'Contrato',
  RECEIPT = 'Recibo',
  MEDICAL = 'Médico',
  MEETING = 'Reunião',
  OTHER = 'Outro'
}

export interface SmartFolder {
  id: string;
  name: string;
  icon: string; // Emoji or icon name
  createdAt: number;
}

export interface SmartDocument {
  id: string;
  folderId: string; // Link to folder
  title: string;
  category: DocCategory;
  date: string; // ISO string from AI, formatted in UI
  summary: string;
  keyValues: Record<string, string | number>;
  imageUrl: string;
  icon?: string; // New field for custom document icon
  isFavorite?: boolean;
  createdAt: number;
}

// --- NOTES TYPES ---
export interface Note {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'audio' | 'image';
  isPinned: boolean;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

// --- FINANCE TYPES ---
export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'paid' | 'pending';

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  category: string;
  paymentMethod?: string; // New field: Pix, Credit Card, etc.
  installmentsInfo?: string; // New field: "1/10", "2/10", etc.
  date: string; // YYYY-MM-DD
  createdAt: number;
}

export interface ProcessingStatus {
  isProcessing: boolean;
  step: 'idle' | 'uploading' | 'analyzing' | 'saving' | 'error';
  message?: string;
}

// Navigation Views
export enum View {
  HOME = 'HOME',
  SCAN = 'SCAN',
  NOTES = 'NOTES',
  FINANCE = 'FINANCE',
  SEARCH = 'SEARCH',
  DETAILS = 'DETAILS'
}