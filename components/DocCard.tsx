import React from 'react';
import { SmartDocument, DocCategory } from '../types';
import { FileText, Receipt, UserSquare, ScrollText, Stethoscope, HelpCircle, Calendar, Star } from 'lucide-react';

interface DocCardProps {
  doc: SmartDocument;
  onClick: (doc: SmartDocument) => void;
  onToggleFavorite: (doc: SmartDocument) => void;
}

const getCategoryStyles = (category: DocCategory) => {
  switch (category) {
    case DocCategory.INVOICE: return { icon: Receipt, bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-500/20' };
    case DocCategory.PERSONAL: return { icon: UserSquare, bg: 'bg-blue-50', text: 'text-blue-600', ring: 'ring-blue-500/20' };
    case DocCategory.CONTRACT: return { icon: ScrollText, bg: 'bg-violet-50', text: 'text-violet-600', ring: 'ring-violet-500/20' };
    case DocCategory.MEDICAL: return { icon: Stethoscope, bg: 'bg-rose-50', text: 'text-rose-600', ring: 'ring-rose-500/20' };
    case DocCategory.RECEIPT: return { icon: FileText, bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-500/20' };
    default: return { icon: HelpCircle, bg: 'bg-gray-50', text: 'text-gray-600', ring: 'ring-gray-500/20' };
  }
};

const formatDateBR = (dateString: string) => {
  if (!dateString) return 'Data desconhecida';
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}`; // Shortened for cleaner card
  }
  return dateString;
};

// Helper for Currency
const formatCurrency = (value: number | string) => {
  const num = Number(value);
  if (isNaN(num)) return value;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const DocCard: React.FC<DocCardProps> = ({ doc, onClick, onToggleFavorite }) => {
  const { icon: Icon, bg, text, ring } = getCategoryStyles(doc.category);

  // Helper to safely find a total value regardless of key casing or language
  const totalValue = React.useMemo(() => {
    if (!doc.keyValues) return null;
    const entry = Object.entries(doc.keyValues).find(([key, val]) => 
      (key.toLowerCase().includes('total') || key.toLowerCase().includes('valor')) && 
      typeof val === 'number'
    );
    return entry ? entry[1] : null;
  }, [doc.keyValues]);

  return (
    <div 
      onClick={() => onClick(doc)}
      className="group bg-white rounded-2xl p-4 cursor-pointer border border-transparent hover:border-brand-100 shadow-soft hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
    >
      <div className="flex items-start gap-4">
        {/* Icon Container - Checks for custom icon OR category default */}
        {doc.icon ? (
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-gray-50 text-2xl shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                {doc.icon}
            </div>
        ) : (
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${bg} ${text} ${ring} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                <Icon size={22} strokeWidth={2.5} />
            </div>
        )}
        
        {/* Content */}
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex justify-between items-start mb-1">
            <h3 className="font-semibold text-gray-900 truncate pr-8 text-base group-hover:text-brand-600 transition-colors">
              {doc.title}
            </h3>
            
            {/* Favorite Button */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(doc);
                }}
                className={`absolute top-4 right-4 p-1.5 rounded-full transition-all z-10 ${doc.isFavorite ? 'text-yellow-400 opacity-100 hover:scale-110' : 'text-gray-300 opacity-0 group-hover:opacity-100 hover:text-yellow-400'}`}
            >
                <Star size={18} fill={doc.isFavorite ? "currentColor" : "none"} />
            </button>
          </div>
          
          <p className="text-xs text-gray-500 line-clamp-1 mb-3 font-medium">
            {doc.summary}
          </p>
          
          <div className="flex items-center justify-between border-t border-gray-50 pt-3 mt-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
              <Calendar size={12} />
              <span>{formatDateBR(doc.date)}</span>
            </div>
            
            {totalValue !== null && (
              <span className="text-xs font-bold text-gray-700 bg-gray-50 px-2.5 py-1 rounded-lg">
                {formatCurrency(totalValue)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};