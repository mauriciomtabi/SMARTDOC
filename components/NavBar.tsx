

import React from 'react';
import { Files, LogOut, DollarSign, Wallet, HelpCircle, NotebookPen } from 'lucide-react';
import { View } from '../types';

interface NavBarProps {
  currentView: View;
  onChangeView: (view: View) => void;
  onSignOut: () => void;
  onStartTour: () => void;
}

export const NavBar: React.FC<NavBarProps> = ({ currentView, onChangeView, onSignOut, onStartTour }) => {
  return (
    <>
      {/* Mobile Fixed Bottom Tab Bar - Dark Theme */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-gray-900 border-t border-gray-800 pb-safe shadow-soft">
        <div className="flex items-center justify-around h-16 px-2">
          
          <button
            id="nav-home-mobile"
            onClick={() => onChangeView(View.HOME)}
            className={`flex flex-col items-center justify-center w-full h-full transition-all ${
              currentView === View.HOME ? 'text-brand-400' : 'text-gray-400'
            }`}
          >
            <div className={`p-1 rounded-xl transition-all ${currentView === View.HOME ? 'bg-gray-800' : 'bg-transparent'}`}>
                <Files size={22} strokeWidth={currentView === View.HOME ? 2.5 : 2} />
            </div>
            <span className={`text-[9px] font-bold mt-0.5 uppercase ${currentView === View.HOME ? 'text-brand-400' : 'text-gray-400'}`}>Docs</span>
          </button>

          <button
            id="nav-notes-mobile"
            onClick={() => onChangeView(View.NOTES)}
            className={`flex flex-col items-center justify-center w-full h-full transition-all ${
              currentView === View.NOTES ? 'text-brand-400' : 'text-gray-400'
            }`}
          >
            <div className={`p-1 rounded-xl transition-all ${currentView === View.NOTES ? 'bg-gray-800' : 'bg-transparent'}`}>
                <NotebookPen size={22} strokeWidth={currentView === View.NOTES ? 2.5 : 2} />
            </div>
            <span className={`text-[9px] font-bold mt-0.5 uppercase ${currentView === View.NOTES ? 'text-brand-400' : 'text-gray-400'}`}>Notas</span>
          </button>

          <button
            id="nav-finance-mobile"
            onClick={() => onChangeView(View.FINANCE)}
            className={`flex flex-col items-center justify-center w-full h-full transition-all ${
              currentView === View.FINANCE ? 'text-brand-400' : 'text-gray-400'
            }`}
          >
            <div className={`p-1 rounded-xl transition-all ${currentView === View.FINANCE ? 'bg-gray-800' : 'bg-transparent'}`}>
                <Wallet size={22} strokeWidth={currentView === View.FINANCE ? 2.5 : 2} />
            </div>
            <span className={`text-[9px] font-bold mt-0.5 uppercase ${currentView === View.FINANCE ? 'text-brand-400' : 'text-gray-400'}`}>Finanças</span>
          </button>

          <button
            onClick={onStartTour}
            className="flex flex-col items-center justify-center w-full h-full text-gray-400 hover:text-brand-400 transition-colors"
          >
             <div className="p-1">
                <HelpCircle size={22} strokeWidth={2} />
             </div>
            <span className="text-[9px] font-bold mt-0.5 uppercase">Ajuda</span>
          </button>

          <button
            onClick={onSignOut}
            className="flex flex-col items-center justify-center w-full h-full text-gray-400 hover:text-red-400 transition-colors"
          >
             <div className="p-1">
                <LogOut size={22} strokeWidth={2} />
             </div>
            <span className="text-[9px] font-bold mt-0.5 uppercase">Sair</span>
          </button>
        </div>
      </div>

      {/* Desktop Top Bar - Dark Theme */}
      <div className="hidden md:flex fixed top-0 left-0 right-0 bg-gray-900/90 backdrop-blur-md border-b border-gray-800 px-8 py-4 justify-between items-center z-50 shadow-sm">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => onChangeView(View.HOME)}>
          <img src="https://i.postimg.cc/ZKPfX7xK/Chat-GPT-Image-16-de-fev-de-2026-13-26-05-removebg-preview.png" alt="Logo" className="w-12 h-12 object-contain rounded-xl" />
          <h1 className="text-xl font-bold text-white">
            SmartDoc
          </h1>
        </div>
        
        <div className="flex gap-4 items-center">
          <button
            id="nav-home-desktop"
            onClick={() => onChangeView(View.HOME)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full transition-all text-sm font-bold ${
              currentView === View.HOME 
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20' 
                : 'text-gray-400 hover:bg-gray-800 hover:text-brand-400'
            }`}
          >
            <Files size={18} />
            <span>Documentos</span>
          </button>

          <button
            id="nav-notes-desktop"
            onClick={() => onChangeView(View.NOTES)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full transition-all text-sm font-bold ${
              currentView === View.NOTES 
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20' 
                : 'text-gray-400 hover:bg-gray-800 hover:text-brand-400'
            }`}
          >
            <NotebookPen size={18} />
            <span>Anotações</span>
          </button>

           <button
            id="nav-finance-desktop"
            onClick={() => onChangeView(View.FINANCE)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full transition-all text-sm font-bold ${
              currentView === View.FINANCE 
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20' 
                : 'text-gray-400 hover:bg-gray-800 hover:text-brand-400'
            }`}
          >
            <DollarSign size={18} />
            <span>Finanças</span>
          </button>
          
          <div className="w-px h-8 bg-gray-700 mx-2"></div>

          <button
            onClick={onStartTour}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-gray-400 hover:bg-gray-800 hover:text-brand-400 transition-all text-sm font-bold"
            title="Iniciar Tutorial"
          >
            <HelpCircle size={18} />
            <span>Ajuda</span>
          </button>

          <button
            onClick={onSignOut}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-all text-sm font-bold"
          >
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        </div>
      </div>
    </>
  );
};