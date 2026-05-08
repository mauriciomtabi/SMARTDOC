import React, { useState, useRef } from 'react';
import { Camera, X, Image as ImageIcon, Sparkles, Scan, Zap, FileText, Layers, FilePlus, ArrowRight, Check } from 'lucide-react';
import { analyzeDocument, fileToGenerativePart } from '../services/geminiService';
import { ProcessingStatus, SmartDocument, SmartFolder } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface ScannerProps {
  currentFolderId: string | null;
  folders: SmartFolder[];
  onScanComplete: (doc: SmartDocument, originalFile: File) => void;
  onCancel: () => void;
}

type ScanMode = 'single' | 'multi' | null;

export const Scanner: React.FC<ScannerProps> = ({ currentFolderId, folders, onScanComplete, onCancel }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, step: 'idle' });
  const [scanMode, setScanMode] = useState<ScanMode>(null); // 'single' or 'multi'
  const [showModeSelection, setShowModeSelection] = useState(false);
  const [multiPages, setMultiPages] = useState<string[]>([]); // Array of objectURLs
  const [finalPreview, setFinalPreview] = useState<string | null>(null);

  // --- HELPER: Merge Images into One (Vertical Stitching) ---
  const mergeImages = async (imageUrls: string[]): Promise<{ blob: Blob, url: string }> => {
    return new Promise((resolve, reject) => {
      const images: HTMLImageElement[] = [];
      let loadedCount = 0;

      imageUrls.forEach(url => {
        const img = new Image();
        img.onload = () => {
          loadedCount++;
          if (loadedCount === imageUrls.length) {
            processMerge();
          }
        };
        img.onerror = reject;
        img.src = url;
        images.push(img);
      });

      const processMerge = () => {
        try {
            // 1. Calculate dimensions (limit width to 1200px to prevent huge files)
            const maxWidth = 1200;
            const totalHeight = images.reduce((acc, img) => {
                const scale = maxWidth / img.width;
                return acc + (img.height * scale);
            }, 0);

            // 2. Create Canvas
            const canvas = document.createElement('canvas');
            canvas.width = maxWidth;
            canvas.height = totalHeight;
            const ctx = canvas.getContext('2d');

            if (!ctx) throw new Error("Could not get canvas context");

            // 3. Draw White Background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 4. Draw Images Vertically
            let currentY = 0;
            images.forEach(img => {
                const scale = maxWidth / img.width;
                const drawHeight = img.height * scale;
                ctx.drawImage(img, 0, currentY, maxWidth, drawHeight);
                currentY += drawHeight;
            });

            // 5. Export
            canvas.toBlob((blob) => {
                if (blob) {
                    const newUrl = URL.createObjectURL(blob);
                    resolve({ blob, url: newUrl });
                } else {
                    reject(new Error("Canvas to Blob failed"));
                }
            }, 'image/jpeg', 0.85);

        } catch (e) {
            reject(e);
        }
      };
    });
  };

  // --- HANDLERS ---

  const handleStartCameraClick = () => {
      setShowModeSelection(true);
  };

  const selectMode = (mode: ScanMode) => {
      setScanMode(mode);
      setShowModeSelection(false);
      // Trigger camera immediately after selection
      setTimeout(() => triggerCameraInput(), 100);
  };

  const triggerCameraInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.removeAttribute('capture');
      fileInputRef.current.setAttribute('capture', 'environment');
      fileInputRef.current.accept = "image/*";
      fileInputRef.current.value = ''; // Reset so onChange triggers even if same file
      fileInputRef.current.click();
    }
  };

  const triggerUpload = () => {
     // Upload flow is typically single file (PDF or Image)
     setScanMode('single'); 
     if (fileInputRef.current) {
      fileInputRef.current.removeAttribute('capture');
      fileInputRef.current.accept = "image/*,application/pdf";
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);

    if (scanMode === 'multi') {
        // Add to pages list and keep user in "capture loop" UI
        setMultiPages(prev => [...prev, objectUrl]);
    } else {
        // Single mode: Process immediately
        if (file.type.includes('image')) setFinalPreview(objectUrl);
        await processDocument(file, objectUrl);
    }
  };

  const handleFinishMultiPage = async () => {
      if (multiPages.length === 0) return;

      setStatus({ isProcessing: true, step: 'analyzing', message: 'Unificando páginas...' });
      
      try {
          // Merge images into one single vertical file
          const { blob, url } = await mergeImages(multiPages);
          setFinalPreview(url);
          
          // Create a File object from the blob to pass to existing logic
          const mergedFile = new File([blob], `scanned_doc_${Date.now()}.jpg`, { type: 'image/jpeg' });
          
          await processDocument(mergedFile, url);

      } catch (e) {
          console.error("Merge failed", e);
          setStatus({ isProcessing: false, step: 'error', message: 'Erro ao unificar páginas.' });
      }
  };

  const processDocument = async (file: File, objectUrl: string) => {
    setStatus({ isProcessing: true, step: 'analyzing', message: 'Mapeando dados...' });

    try {
      const base64Data = await fileToGenerativePart(file);
      // Only send folder names if we don't have a current folder, to help AI suggest one
      const folderNames = !currentFolderId ? folders.map(f => f.name) : [];
      
      const minTime = new Promise(resolve => setTimeout(resolve, 2000));
      
      const [analysisResult] = await Promise.all([
        analyzeDocument(base64Data, file.type, folderNames),
        minTime
      ]);
      
      setStatus({ isProcessing: true, step: 'saving', message: 'Sincronizando Neural...' });

      let finalFolderId = currentFolderId;
      
      // LOGIC CHANGE: Only use AI suggestion if user is NOT in a specific folder
      if (!finalFolderId && analysisResult.suggestedFolderName) {
        const matchedFolder = folders.find(f => f.name.toLowerCase() === analysisResult.suggestedFolderName.toLowerCase());
        if (matchedFolder) finalFolderId = matchedFolder.id;
      }

      // Fallback if still no folder (create default or use first)
      if (!finalFolderId) {
        finalFolderId = folders.length > 0 ? folders[0].id : 'CREATE_DEFAULT_FOLDER';
      }

      await new Promise(r => setTimeout(r, 800));

      const newDoc: SmartDocument = {
        id: uuidv4(),
        folderId: finalFolderId,
        title: analysisResult.title,
        category: analysisResult.category,
        date: analysisResult.date,
        summary: analysisResult.summary,
        keyValues: analysisResult.keyValues,
        imageUrl: objectUrl || '',
        createdAt: Date.now()
      };

      onScanComplete(newDoc, file);

    } catch (error) {
      console.error(error);
      setStatus({ isProcessing: false, step: 'error', message: 'Falha na leitura neural.' });
    }
  };

  // --- RENDERING ---

  // 1. Loading / Processing State
  if (status.isProcessing) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col items-center justify-center overflow-hidden">
        <style>{`
          @keyframes scan {
            0%, 100% { top: 0%; opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { top: 100%; opacity: 0; }
          }
          .scan-line { animation: scan 2s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
        `}</style>
        <div className="absolute inset-0 bg-gray-950">
           <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-gray-900"></div>
        </div>
        <div className="relative z-10 w-full max-w-md px-6 flex flex-col items-center">
            <div className="relative w-full aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10 group bg-gray-900/50 flex items-center justify-center">
                {finalPreview ? (
                  <img 
                    src={finalPreview} 
                    className="absolute inset-0 w-full h-full object-cover opacity-40 blur-sm scale-105" 
                  />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center opacity-20"><FileText size={120} className="text-white" /></div>
                )}
                <div className="absolute left-0 right-0 h-1 bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.8)] scan-line z-20"></div>
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-full border border-brand-500/30 animate-[spin_4s_linear_infinite]"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Zap className="text-white animate-pulse" size={32} />
                        </div>
                    </div>
                </div>
            </div>
            <div className="mt-8 text-center space-y-2">
                <h3 className="text-2xl font-bold text-white">{status.step === 'analyzing' ? 'Processando IA' : 'Finalizando'}</h3>
                <p className="text-brand-200/80 text-sm font-medium animate-pulse">{status.message}</p>
            </div>
        </div>
      </div>
    );
  }

  // 2. Multi-Page Staging Area
  if (scanMode === 'multi' && multiPages.length > 0) {
      return (
        <div className="flex flex-col h-screen bg-gray-900 text-white pb-safe">
            <div className="p-4 flex justify-between items-center bg-gray-800/50 backdrop-blur border-b border-gray-700">
                <h2 className="font-bold flex items-center gap-2">
                    <Layers className="text-brand-400" />
                    {multiPages.length} Página(s)
                </h2>
                <button onClick={() => { setMultiPages([]); setScanMode(null); }} className="text-gray-400 hover:text-white">
                    <X size={24} />
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-4">
                {multiPages.map((src, idx) => (
                    <div key={idx} className="relative aspect-[3/4] rounded-xl overflow-hidden border border-gray-600 bg-gray-800">
                        <img src={src} className="w-full h-full object-cover" />
                        <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-0.5 rounded text-xs font-mono">
                            #{idx + 1}
                        </div>
                    </div>
                ))}
                <button 
                    onClick={triggerCameraInput}
                    className="aspect-[3/4] rounded-xl border-2 border-dashed border-gray-600 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-800 hover:text-white hover:border-brand-500 transition-colors gap-2"
                >
                    <Camera size={32} />
                    <span className="text-xs font-bold uppercase">Adicionar</span>
                </button>
            </div>

            <div className="p-6 bg-gray-900 border-t border-gray-800 safe-area-pb">
                <button 
                    onClick={handleFinishMultiPage}
                    className="w-full bg-brand-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-brand-500/30 flex items-center justify-center gap-2 hover:bg-brand-500 active:scale-[0.98] transition-all"
                >
                    Finalizar e Salvar
                    <ArrowRight size={20} />
                </button>
            </div>
             {/* Hidden Input reused */}
             <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
        </div>
      );
  }

  // 3. Error State
  if (status.step === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[80vh] p-8 text-center animate-in zoom-in-95">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6 ring-4 ring-red-100">
           <X className="text-red-500" size={32} />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Ops, falha na leitura</h3>
        <p className="text-gray-500 mb-8 max-w-xs mx-auto">{status.message}</p>
        <button onClick={() => setStatus({ isProcessing: false, step: 'idle' })} className="bg-brand-600 text-white px-6 py-3 rounded-xl font-medium">Tentar Novamente</button>
      </div>
    );
  }

  // 4. Initial Idle State (With Mode Selection Modal)
  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-100px)] p-6 animate-in slide-in-from-bottom-8 duration-500 relative">
      
      {/* Mode Selection Overlay */}
      {showModeSelection && (
          <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-xl flex flex-col justify-end pb-8 animate-in fade-in duration-200 rounded-3xl">
              <div className="p-6 space-y-4">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold text-gray-900">Como deseja digitalizar?</h3>
                      <button onClick={() => setShowModeSelection(false)} className="p-2 bg-gray-100 rounded-full text-gray-500"><X size={20}/></button>
                  </div>
                  
                  <button onClick={() => selectMode('single')} className="w-full flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-2xl shadow-sm hover:border-brand-500 hover:bg-brand-50 transition-all text-left group">
                      <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-blue-200">
                          <FileText size={24} />
                      </div>
                      <div>
                          <h4 className="font-bold text-gray-800">Página Única</h4>
                          <p className="text-sm text-gray-500">Para recibos ou notas simples</p>
                      </div>
                  </button>

                  <button onClick={() => selectMode('multi')} className="w-full flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-2xl shadow-sm hover:border-brand-500 hover:bg-brand-50 transition-all text-left group">
                      <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center group-hover:bg-purple-200">
                          <Layers size={24} />
                      </div>
                      <div>
                          <h4 className="font-bold text-gray-800">Múltiplas Páginas</h4>
                          <p className="text-sm text-gray-500">Para contratos ou documentos longos</p>
                      </div>
                  </button>
              </div>
          </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Novo Documento</h2>
        <button onClick={onCancel} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors">
            <X size={20} />
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-6">
        <div className="bg-gradient-to-br from-brand-500 to-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-brand-500/20 relative overflow-hidden group cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99]" onClick={handleStartCameraClick}>
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity"><Camera size={120} /></div>
            <div className="relative z-10">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 border border-white/30"><Scan size={28} /></div>
                <h3 className="text-2xl font-bold mb-1">Tirar Foto</h3>
                <p className="text-brand-100 text-sm">Use a câmera para digitalizar agora</p>
            </div>
        </div>

        <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-8 text-gray-600 relative overflow-hidden group cursor-pointer hover:border-brand-300 hover:bg-gray-50 transition-all active:scale-[0.99]" onClick={triggerUpload}>
            <div className="relative z-10 flex flex-col items-center text-center">
                 <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-white group-hover:shadow-md transition-all">
                    <ImageIcon size={28} className="text-gray-400 group-hover:text-brand-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-1">Galeria & PDF</h3>
                <p className="text-gray-400 text-sm">Fotos ou arquivos PDF</p>
            </div>
        </div>

        <div className="text-center mt-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-50 text-brand-700 rounded-full text-xs font-semibold">
                <Sparkles size={12} />
                IA processando localmente + Nuvem
            </div>
        </div>

        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*,application/pdf"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
};