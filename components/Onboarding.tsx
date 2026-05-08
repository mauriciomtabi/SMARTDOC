import React, { useState, useEffect } from 'react';
import { X, ChevronRight, Check, ChevronLeft, Sparkles, Scan, FileText, PieChart, FolderOpen } from 'lucide-react';

export interface TourStep {
  title: string;
  description: string;
  image?: string; // URL for image/gif/video placeholder
  icon?: React.ReactNode; // Fallback icon if no image
  view?: string; 
}

interface OnboardingProps {
  steps: TourStep[];
  currentStepIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ steps = [], currentStepIndex = 0, onNext, onPrev, onSkip }) => {
  const step = (steps && steps.length > 0) ? steps[currentStepIndex] : null;
  const isLastStep = steps ? currentStepIndex === steps.length - 1 : false;

  if (!step) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
      <div className="bg-white rounded-[2rem] max-w-lg w-full shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header / Media Area */}
        <div className="relative h-48 sm:h-64 bg-gray-50 flex items-center justify-center shrink-0">
            {/* Close Button */}
            <button 
                onClick={onSkip} 
                className="absolute top-4 right-4 z-10 w-8 h-8 bg-white/50 hover:bg-white backdrop-blur-md rounded-full flex items-center justify-center text-gray-600 transition-colors"
            >
                <X size={18} />
            </button>

            {step.image ? (
                <img 
                    src={step.image} 
                    alt={step.title} 
                    className="w-full h-full object-cover animate-in fade-in zoom-in-95 duration-500"
                    referrerPolicy="no-referrer"
                />
            ) : (
                <div className="w-24 h-24 rounded-3xl bg-brand-100 text-brand-600 flex items-center justify-center animate-in zoom-in-95 duration-500 shadow-inner">
                    {step.icon || <Sparkles size={48} strokeWidth={1.5} />}
                </div>
            )}

            {/* Gradient Overlay for smooth transition to content */}
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent"></div>
        </div>

        {/* Content Area */}
        <div className="p-6 sm:p-8 flex-1 overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold tracking-wider text-brand-600 uppercase bg-brand-50 px-2 py-1 rounded-md">
                    Dica {currentStepIndex + 1} de {steps.length}
                </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 leading-tight">
                {step.title}
            </h2>
            <p 
                className="text-gray-500 text-base sm:text-lg leading-relaxed"
                dangerouslySetInnerHTML={{ __html: step.description.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
            />
        </div>

        {/* Footer / Controls */}
        <div className="p-6 sm:p-8 pt-0 shrink-0">
            {/* Pagination Dots */}
            <div className="flex justify-center gap-2 mb-8">
                {steps.map((_, idx) => (
                    <div 
                        key={idx} 
                        className={`h-2 rounded-full transition-all duration-300 ${idx === currentStepIndex ? 'w-8 bg-brand-600' : 'w-2 bg-gray-200'}`}
                    />
                ))}
            </div>

            <div className="flex gap-3">
                {currentStepIndex > 0 && (
                    <button 
                        onClick={onPrev}
                        className="px-5 py-4 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors flex items-center justify-center"
                        aria-label="Voltar"
                    >
                        <ChevronLeft size={20} />
                    </button>
                )}
                <button 
                    onClick={onNext}
                    className="flex-1 bg-brand-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-brand-500/30 hover:bg-brand-700 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                    {isLastStep ? 'Começar a usar' : 'Próximo'} 
                    {isLastStep ? <Check size={20} /> : <ChevronRight size={20} />}
                </button>
            </div>
        </div>

      </div>
    </div>
  );
};