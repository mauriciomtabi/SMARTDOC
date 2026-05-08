

import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Save, RotateCcw, X, AlertTriangle, CheckCircle, Loader2, Play } from 'lucide-react';
import { saveChunk, clearStoredAudio, getStoredAudio } from '../services/indexedDb';
import { processFinanceAudio, processNoteAudio } from '../services/geminiService';
import { ProcessingStatus } from '../types';

interface AudioRecorderProps {
  mode: 'finance' | 'note'; // Supported modes
  onScanComplete: (result: any, originalFile: File) => void;
  onCancel: () => void;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ mode, onScanComplete, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, step: 'idle' });
  const [supportedMimeType, setSupportedMimeType] = useState<string>('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    // Detect supported mime type for best mobile compatibility
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/ogg'
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        setSupportedMimeType(type);
        break;
      }
    }
  }, []);

  // --- RECORDING LOGIC ---
  const startRecording = async () => {
    if (!supportedMimeType) {
      alert("Seu navegador não suporta gravação de áudio.");
      return;
    }

    // Clear any previous session
    await clearStoredAudio();
    setAudioBlob(null);
    setDuration(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: supportedMimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          // Critical: Save chunk to IndexedDB immediately
          await saveChunk(event.data);
        }
      };

      mediaRecorder.start(1000); // Save chunks every 1 second
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error(err);
      alert("Erro ao acessar microfone. Verifique as permissões.");
    }
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      clearInterval(timerRef.current!);
      setIsRecording(false);
      
      // Wait a bit for the last chunk to be written to DB
      setStatus({ isProcessing: true, step: 'analyzing', message: 'Finalizando arquivo...' });
      setTimeout(async () => {
        const fullBlob = await getStoredAudio();
        // Ensure the blob has the correct type
        const typedBlob = fullBlob ? new Blob([fullBlob], { type: supportedMimeType }) : null;
        setAudioBlob(typedBlob);
        setStatus({ isProcessing: false, step: 'idle' });
      }, 1000);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- PROCESSING LOGIC ---
  const handleProcessAudio = async (blobToProcess: Blob) => {
    setStatus({ isProcessing: true, step: 'uploading', message: 'Processando áudio...' });
    
    // Create a File object
    const ext = supportedMimeType.includes('mp4') || supportedMimeType.includes('aac') ? 'm4a' : 'webm';
    const audioFile = new File([blobToProcess], `recording_${Date.now()}.${ext}`, { type: supportedMimeType });

    try {
         if (mode === 'finance') {
             setStatus({ isProcessing: true, step: 'analyzing', message: 'Entendendo gastos...' });
             const financeData = await processFinanceAudio(blobToProcess, supportedMimeType);
             await clearStoredAudio();
             onScanComplete(financeData, audioFile);
         } else if (mode === 'note') {
             setStatus({ isProcessing: true, step: 'analyzing', message: 'Transcrevendo anotação...' });
             const noteData = await processNoteAudio(blobToProcess, supportedMimeType);
             await clearStoredAudio();
             onScanComplete(noteData, audioFile);
         }
         return;

    } catch (error: any) {
        console.error("Audio Processing Error:", error);
        setStatus({ 
            isProcessing: false, 
            step: 'error', 
            message: error.message || 'Não foi possível entender o áudio. Tente falar mais perto do microfone.' 
        });
    }
  };

  // --- RENDER ---
  if (status.isProcessing) {
     return (
        <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col items-center justify-center p-6 text-center">
            <Loader2 className="animate-spin text-brand-500 mb-4" size={48} />
            <h3 className="text-xl font-bold text-white mb-2">
                Processando Inteligente...
            </h3>
            <p className="text-gray-400 max-w-sm">{status.message}</p>
        </div>
     );
  }

  // Error State Display
  if (status.step === 'error') {
      return (
        <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95">
             <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                <AlertTriangle className="text-red-500" size={40} />
             </div>
             <h3 className="text-xl font-bold text-white mb-2">Ops, algo deu errado</h3>
             <p className="text-gray-400 max-w-sm mb-8">{status.message}</p>
             <div className="flex gap-3 w-full max-w-xs">
                 <button 
                   onClick={onCancel}
                   className="flex-1 bg-gray-800 text-gray-300 px-4 py-3 rounded-xl font-bold hover:bg-gray-700 transition-colors"
                 >
                   Cancelar
                 </button>
                 <button 
                   onClick={() => setStatus({ isProcessing: false, step: 'idle' })}
                   className="flex-1 bg-brand-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-brand-500 transition-colors"
                 >
                   Tentar Novamente
                 </button>
             </div>
        </div>
      );
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col h-full bg-gray-50 animate-in slide-in-from-bottom-10">
        {/* Header */}
        <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-gray-100 shadow-sm safe-area-pt">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 text-green-600">
                    <Mic size={24} />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-gray-900">
                        {mode === 'finance' ? 'Registrar por Voz' : 'Nova Anotação de Voz'}
                    </h2>
                    <p className="text-xs text-gray-500">
                        {mode === 'finance' ? 'Ex: "Gastei 50 reais em almoço"' : 'Ex: "Reunião de projeto às 14h"'}
                    </p>
                </div>
            </div>
            <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                <X size={24} />
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
            
            {/* Timer */}
            <div className="text-center space-y-2">
                <div className={`text-6xl font-mono font-bold tracking-tighter ${isRecording ? 'text-red-500' : 'text-gray-300'}`}>
                    {formatTime(duration)}
                </div>
                {isRecording && (
                    <div className="flex items-center justify-center gap-2 text-red-500 text-sm font-medium animate-pulse">
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                        GRAVANDO
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="relative w-48 h-48 flex items-center justify-center">
                {isRecording && (
                     <>
                        <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping"></div>
                        <div className="absolute inset-4 bg-red-500/20 rounded-full animate-pulse delay-75"></div>
                     </>
                )}
                
                {!isRecording && !audioBlob && (
                    <button 
                        onClick={startRecording}
                        className="relative z-10 w-24 h-24 rounded-full flex items-center justify-center text-white shadow-xl hover:scale-110 transition-transform bg-green-600 shadow-green-500/40"
                    >
                        <Mic size={40} />
                    </button>
                )}

                {isRecording && (
                    <button 
                        onClick={stopRecording}
                        className="relative z-10 w-24 h-24 bg-white border-4 border-red-500 rounded-full flex items-center justify-center text-red-500 shadow-xl hover:scale-105 transition-transform"
                    >
                        <Square size={32} fill="currentColor" />
                    </button>
                )}

                {!isRecording && audioBlob && (
                    <div className="flex gap-4">
                        <button 
                            onClick={() => startRecording()} 
                            className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-300"
                        >
                            <RotateCcw size={24} />
                        </button>
                         <button 
                            onClick={() => handleProcessAudio(audioBlob)}
                            className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-green-500/30 hover:scale-105 hover:bg-green-600 transition-all"
                        >
                            <CheckCircle size={32} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};