import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Note, ProcessingStatus } from '../types';
import { 
    Plus, Mic, Image as ImageIcon, Search, Pin, Trash2, 
    X, Save, Loader2, StickyNote, PenTool, Camera, CheckCircle, AlertTriangle, 
    Bold, Italic, Underline, Strikethrough, List, ListOrdered, CheckSquare, 
    AlignLeft, AlignCenter, AlignRight, Type, Highlighter, Palette, 
    Sparkles, Scan, Ban
} from 'lucide-react';
import { AudioRecorder } from './AudioRecorder';
import { processNoteImage, fileToGenerativePart } from '../services/geminiService';

interface NotesDashboardProps {
    session: any;
}

// Helper to strip HTML for preview
const stripHtml = (html: string) => {
   const tmp = document.createElement("DIV");
   tmp.innerHTML = html;
   return tmp.textContent || tmp.innerText || "";
};

const PRESET_COLORS = [
    { label: 'Amarelo', value: '#eab308' },  // Yellow-500
    { label: 'Verde', value: '#22c55e' },    // Green-500
    { label: 'Azul', value: '#3b82f6' },     // Blue-500
    { label: 'Vermelho', value: '#ef4444' }, // Red-500
    { label: 'Roxo', value: '#a855f7' },     // Purple-500
];

export const NotesDashboard: React.FC<NotesDashboardProps> = ({ session }) => {
    const [notes, setNotes] = useState<Note[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    // UI States
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [showImageSourceModal, setShowImageSourceModal] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    
    const [activeRecorder, setActiveRecorder] = useState(false);
    const [recorderContext, setRecorderContext] = useState<'new' | 'append'>('new');

    const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, step: 'idle' });
    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, title: string } | null>(null);

    // Form Data
    const [currentNote, setCurrentNote] = useState<Partial<Note>>({
        title: '',
        content: '',
        type: 'text',
        isPinned: false,
        tags: []
    });

    // Refs
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const editorRef = useRef<HTMLDivElement>(null);
    
    // Selection Management
    const savedSelection = useRef<Range | null>(null);

    // --- RICH TEXT EDITOR LOGIC ---
    
    const saveSelection = () => {
        const sel = window.getSelection();
        // Only save if the selection is inside our editor
        if (sel && sel.rangeCount > 0 && editorRef.current && editorRef.current.contains(sel.anchorNode)) {
            savedSelection.current = sel.getRangeAt(0);
        }
    };

    const restoreSelection = () => {
        const sel = window.getSelection();
        if (savedSelection.current && sel) {
            sel.removeAllRanges();
            sel.addRange(savedSelection.current);
        }
    };

    const execCmd = (command: string, value: string | undefined = undefined) => {
        // Ensure editor has focus or restore selection before command
        if (editorRef.current) editorRef.current.focus();
        restoreSelection(); 
        
        document.execCommand(command, false, value);
        
        // Save the new selection state after command
        saveSelection();
    };

    const handleColorChange = (command: string, value: string) => {
        // Specifically for color inputs which steal focus when clicked
        restoreSelection();
        document.execCommand(command, false, value);
        saveSelection();
    };

    const insertChecklist = () => {
        restoreSelection();
        const checkboxHtml = `<div style="display: flex; align-items: center; margin-bottom: 4px;"><input type="checkbox" style="margin-right: 8px; transform: scale(1.2); cursor: pointer;" />&nbsp;<span>Item da lista</span></div>`;
        document.execCommand('insertHTML', false, checkboxHtml);
        saveSelection();
    };

    // Update content state when typing
    const handleEditorInput = () => {
        // Save selection on every input to keep track of cursor
        saveSelection();
        if (editorRef.current) {
            setCurrentNote(prev => ({ ...prev, content: editorRef.current?.innerHTML || '' }));
        }
    };

    const handleEditorClick = () => {
        saveSelection();
    };

    // Sync state to editor when opening modal
    useEffect(() => {
        if (showModal && editorRef.current) {
            // If content is empty/new, simple string. If existing, it might be HTML.
            let contentToSet = currentNote.content || '';
            
            // Simple check: if it doesn't look like HTML, wrap lines in divs or replace \n with <br>
            if (!/<[a-z][\s\S]*>/i.test(contentToSet) && contentToSet.includes('\n')) {
                contentToSet = contentToSet.replace(/\n/g, '<br>');
            }
            
            editorRef.current.innerHTML = contentToSet;
        }
    }, [showModal, currentNote.id]);

    // --- DATA FETCHING ---
    useEffect(() => {
        fetchNotes();
    }, []);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3500);
    };

    const fetchNotes = async () => {
        try {
            const { data, error } = await supabase
                .from('notes')
                .select('*')
                .order('is_pinned', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                const mappedNotes: Note[] = data.map((n: any) => ({
                    id: n.id,
                    title: n.title,
                    content: n.content,
                    type: n.type,
                    isPinned: n.is_pinned,
                    tags: n.tags || [],
                    createdAt: n.created_at,
                    updatedAt: n.updated_at
                }));
                setNotes(mappedNotes);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    // --- ACTIONS ---

    const handleSaveNote = async () => {
        const finalContent = editorRef.current ? editorRef.current.innerHTML : currentNote.content;
        
        if (!currentNote.title && (!finalContent || finalContent === '<br>')) return;

        setStatus({ isProcessing: true, step: 'saving', message: 'Salvando anotação...' });

        try {
            const noteData = {
                user_id: session.user.id,
                title: currentNote.title || 'Sem título',
                content: finalContent,
                type: currentNote.type || 'text',
                is_pinned: currentNote.isPinned || false,
                tags: currentNote.tags || [],
                updated_at: Date.now()
            };

            if (modalMode === 'create') {
                const newNote = { ...noteData, created_at: Date.now() };
                const { data, error } = await supabase.from('notes').insert(newNote).select().single();
                if (error) throw error;
                if (data) {
                    setNotes(prev => [{ 
                        ...data, 
                        isPinned: data.is_pinned, 
                        createdAt: data.created_at,
                        updatedAt: data.updated_at 
                    } as Note, ...prev]);
                }
            } else if (currentNote.id) {
                const { error } = await supabase.from('notes').update(noteData).eq('id', currentNote.id);
                if (error) throw error;
                setNotes(prev => prev.map(n => n.id === currentNote.id ? { ...n, ...currentNote, content: finalContent } as Note : n));
            }

            setShowModal(false);
            resetForm();
            showToast("Anotação salva com sucesso!");

        } catch (e) {
            console.error(e);
            showToast("Erro ao salvar anotação.", "error");
        } finally {
            setStatus({ isProcessing: false, step: 'idle' });
        }
    };

    const requestDelete = (note: Note, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeleteConfirm({ id: note.id, title: note.title || 'Sem título' });
    };

    const confirmDelete = async () => {
        if (!deleteConfirm) return;
        const { id } = deleteConfirm;
        
        // Optimistic update
        setNotes(prev => prev.filter(n => n.id !== id));
        setDeleteConfirm(null);
        showToast("Anotação excluída.");
        
        try {
            const { error } = await supabase.from('notes').delete().eq('id', id);
            if (error) throw error;
        } catch (e) {
            console.error(e);
            showToast("Erro ao excluir anotação.", "error");
            fetchNotes(); // Revert
        }
    };

    const handlePinNote = async (note: Note, e: React.MouseEvent) => {
        e.stopPropagation();
        const newPinnedState = !note.isPinned;
        
        // Optimistic Update
        setNotes(prev => prev.map(n => n.id === note.id ? { ...n, isPinned: newPinnedState } : n)
                           .sort((a, b) => (Number(b.isPinned) - Number(a.isPinned)) || (b.createdAt - a.createdAt)));
        
        showToast(newPinnedState ? "Anotação fixada." : "Anotação desafixada.");

        await supabase.from('notes').update({ is_pinned: newPinnedState }).eq('id', note.id);
    };

    const openEditModal = (note: Note) => {
        setCurrentNote(note);
        setModalMode('edit');
        setShowModal(true);
    };

    const resetForm = () => {
        setCurrentNote({
            title: '',
            content: '',
            type: 'text',
            isPinned: false,
            tags: []
        });
        setIsMenuOpen(false);
    };

    // --- AI HANDLERS ---

    const handleAudioComplete = (result: any) => {
        setActiveRecorder(false);
        const aiContent = (result.content || '').replace(/\n/g, '<br>'); 

        if (recorderContext === 'new') {
            setCurrentNote({
                title: result.title,
                content: aiContent,
                tags: result.tags || [],
                type: 'audio',
                isPinned: false
            });
            setModalMode('create');
            setShowModal(true);
        } else {
            // Append Mode
            const separator = currentNote.content ? '<br><br><hr><br>' : '';
            const newContent = (editorRef.current?.innerHTML || '') + separator + aiContent;
            
            if(editorRef.current) {
                editorRef.current.innerHTML = newContent;
            }
            
            setCurrentNote(prev => ({
                ...prev,
                content: newContent,
                tags: [...(prev.tags || []), ...(result.tags || [])]
            }));
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setShowImageSourceModal(false);
        setStatus({ isProcessing: true, step: 'analyzing', message: 'Lendo imagem...' });

        try {
            const base64 = await fileToGenerativePart(file);
            const result = await processNoteImage(base64, file.type);
            const aiContent = (result.content || '').replace(/\n/g, '<br>');

            setCurrentNote({
                title: result.title,
                content: aiContent,
                tags: result.tags || [],
                type: 'image',
                isPinned: false
            });
            setModalMode('create');
            setShowModal(true);
        } catch (err) {
            console.error(err);
            showToast("Erro ao processar imagem.", "error");
        } finally {
            setStatus({ isProcessing: false, step: 'idle' });
            if (galleryInputRef.current) galleryInputRef.current.value = '';
            if (cameraInputRef.current) cameraInputRef.current.value = '';
        }
    };

    // --- FILTERING ---
    const filteredNotes = notes.filter(n => {
        const textContent = stripHtml(n.content).toLowerCase();
        const search = searchQuery.toLowerCase();
        return n.title.toLowerCase().includes(search) || textContent.includes(search);
    });

    const pinnedNotes = filteredNotes.filter(n => n.isPinned);
    const otherNotes = filteredNotes.filter(n => !n.isPinned);

    return (
        <div className="min-h-screen bg-gray-50 pb-32 pt-8 md:pt-28 px-4 safe-area-pt relative">
            
            {/* --- NOTIFICATION TOAST --- */}
            {notification && (
                <div className="fixed top-20 md:top-24 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 fade-in duration-300">
                    <div className={`px-6 py-3 rounded-full shadow-xl flex items-center gap-3 border ${notification.type === 'success' ? 'bg-white border-emerald-100 text-emerald-700' : 'bg-white border-red-100 text-red-600'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${notification.type === 'success' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                            {notification.type === 'success' ? <CheckCircle size={14} strokeWidth={3} /> : <AlertTriangle size={14} strokeWidth={3} />}
                        </div>
                        <span className="text-sm font-bold">{notification.message}</span>
                    </div>
                </div>
            )}

            {/* Loading Overlay */}
            {status.isProcessing && (
                <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center flex-col text-white">
                    <Loader2 size={48} className="animate-spin mb-4 text-brand-400" />
                    <h3 className="text-xl font-bold">{status.message}</h3>
                </div>
            )}

            {/* Audio Recorder Overlay */}
            {activeRecorder && (
                <AudioRecorder 
                    mode="note" 
                    onScanComplete={handleAudioComplete} 
                    onCancel={() => setActiveRecorder(false)} 
                />
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 animate-in zoom-in-95">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600 animate-bounce">
                                <Trash2 size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Excluir Anotação?</h3>
                            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                                Tem certeza que deseja excluir "<strong>{deleteConfirm.title}</strong>"? <br/>Esta ação não pode ser desfeita.
                            </p>
                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 px-4 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 shadow-lg shadow-red-500/30 transition-colors"
                                >
                                    Sim, Excluir
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- IMAGE SOURCE SELECTION MODAL --- */}
            {showImageSourceModal && (
                <div className="fixed inset-0 z-[80] bg-gray-50 flex flex-col items-center justify-center p-6 animate-in slide-in-from-bottom-10">
                    <div className="w-full max-w-md flex flex-col h-full justify-center relative">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-bold text-gray-900">Novo Documento</h2>
                            <button onClick={() => setShowImageSourceModal(false)} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 flex flex-col justify-center gap-6">
                            <div className="bg-gradient-to-br from-brand-500 to-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-brand-500/20 relative overflow-hidden group cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99]" onClick={() => cameraInputRef.current?.click()}>
                                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity"><Camera size={120} /></div>
                                <div className="relative z-10">
                                    <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 border border-white/30"><Scan size={28} /></div>
                                    <h3 className="text-2xl font-bold mb-1">Tirar Foto</h3>
                                    <p className="text-brand-100 text-sm">Use a câmera para digitalizar agora</p>
                                </div>
                            </div>
                            <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-8 text-gray-600 relative overflow-hidden group cursor-pointer hover:border-brand-300 hover:bg-gray-50 transition-all active:scale-[0.99]" onClick={() => galleryInputRef.current?.click()}>
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
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Anotações</h1>
                        <p className="text-gray-500 font-medium mt-1">Capture ideias, áudios e manuscritos com IA</p>
                    </div>
                </div>

                {/* Search */}
                <div className="relative mb-8">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><Search size={20} /></div>
                    <input 
                        type="text" 
                        placeholder="Buscar em suas anotações..." 
                        className="w-full pl-12 pr-4 py-4 rounded-2xl border-none shadow-soft focus:ring-2 focus:ring-brand-500 bg-white text-gray-900 placeholder-gray-400 text-lg transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Notes Grid */}
                {isLoading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-500" size={32} /></div>
                ) : notes.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                        <StickyNote size={64} className="mx-auto mb-4 opacity-20" />
                        <p className="text-lg">Nenhuma anotação ainda.</p>
                        <p className="text-sm">Toque no + para criar.</p>
                    </div>
                ) : (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        
                        {/* Pinned Section */}
                        {pinnedNotes.length > 0 && (
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Pin size={12} fill="currentColor" /> Fixadas
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {pinnedNotes.map(note => <NoteCard key={note.id} note={note} onClick={() => openEditModal(note)} onPin={handlePinNote} onDelete={requestDelete} />)}
                                </div>
                            </div>
                        )}

                        {/* Other Notes */}
                        {otherNotes.length > 0 && (
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Outras</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {otherNotes.map(note => <NoteCard key={note.id} note={note} onClick={() => openEditModal(note)} onPin={handlePinNote} onDelete={requestDelete} />)}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* --- FAB --- */}
            <div className="fixed bottom-24 right-6 md:bottom-12 md:right-12 z-40 flex flex-col items-end gap-3">
                {isMenuOpen && (
                    <>
                        <button onClick={() => { setIsMenuOpen(false); setShowImageSourceModal(true); }} className="bg-white text-gray-700 p-3 rounded-full shadow-lg border border-gray-100 flex items-center gap-3 animate-in slide-in-from-bottom-2 fade-in hover:bg-gray-50">
                            <span className="text-sm font-bold pr-1">Foto/Upload</span>
                            <Camera size={20} className="text-purple-500" />
                        </button>
                        <button onClick={() => { setIsMenuOpen(false); setRecorderContext('new'); setActiveRecorder(true); }} className="bg-white text-gray-700 p-3 rounded-full shadow-lg border border-gray-100 flex items-center gap-3 animate-in slide-in-from-bottom-4 fade-in delay-75 hover:bg-gray-50">
                            <span className="text-sm font-bold pr-1">Gravar Áudio</span>
                            <Mic size={20} className="text-red-500" />
                        </button>
                        <button onClick={() => { setIsMenuOpen(false); setModalMode('create'); resetForm(); setShowModal(true); }} className="bg-white text-gray-700 p-3 rounded-full shadow-lg border border-gray-100 flex items-center gap-3 animate-in slide-in-from-bottom-6 fade-in delay-100 hover:bg-gray-50">
                            <span className="text-sm font-bold pr-1">Texto</span>
                            <PenTool size={20} className="text-brand-500" />
                        </button>
                    </>
                )}
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center text-white shadow-xl shadow-brand-500/40 border-4 border-white transition-all duration-300 ${isMenuOpen ? 'bg-gray-800 rotate-45' : 'bg-brand-600 hover:bg-brand-700'}`}>
                    <Plus size={32} />
                </button>
            </div>

            {/* Hidden Inputs */}
            <input type="file" ref={galleryInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleImageUpload} />
            <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleImageUpload} />

            {/* --- NOTE EDITOR MODAL (RICH TEXT) --- */}
            {showModal && (
                <div className="fixed inset-0 z-50 bg-white/95 backdrop-blur-sm flex items-center justify-center animate-in slide-in-from-bottom-10">
                    <style>{`
                        .rich-text-content ul {
                            list-style-type: disc;
                            margin-left: 1.5rem;
                            padding-left: 0.5rem;
                        }
                        .rich-text-content ol {
                            list-style-type: decimal;
                            margin-left: 1.5rem;
                            padding-left: 0.5rem;
                        }
                        .rich-text-content li {
                            margin-bottom: 0.25rem;
                        }
                    `}</style>
                    <div className="w-full h-full md:max-w-3xl md:h-auto md:max-h-[90vh] md:rounded-[2rem] md:shadow-2xl bg-white flex flex-col md:border border-gray-100 overflow-hidden">
                        {/* Modal Header */}
                        <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 md:rounded-t-[2rem]">
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
                                <X size={22} />
                            </button>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => { setRecorderContext('append'); setActiveRecorder(true); }}
                                    className="p-2 rounded-full text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
                                    title="Gravar Áudio"
                                >
                                    <Mic size={20} />
                                </button>
                                <button 
                                    onClick={() => setCurrentNote(prev => ({ ...prev, isPinned: !prev.isPinned }))}
                                    className={`p-2 rounded-full transition-colors ${currentNote.isPinned ? 'text-yellow-500 bg-yellow-50' : 'text-gray-300 hover:text-gray-500'}`}
                                >
                                    <Pin size={20} fill={currentNote.isPinned ? "currentColor" : "none"} />
                                </button>
                                <button 
                                    onClick={handleSaveNote}
                                    className="px-4 py-2 bg-brand-600 text-white rounded-full font-bold text-sm shadow-lg shadow-brand-500/20 hover:bg-brand-700 flex items-center gap-2"
                                >
                                    <Save size={18} /> Salvar
                                </button>
                            </div>
                        </div>

                        {/* Title Input */}
                        <div className="px-6 pt-6 pb-2">
                            <input 
                                type="text" 
                                placeholder="Título da Anotação"
                                className="w-full text-2xl font-bold text-gray-900 placeholder-gray-300 border-none outline-none bg-transparent"
                                value={currentNote.title}
                                onChange={e => setCurrentNote(prev => ({ ...prev, title: e.target.value }))}
                            />
                        </div>

                        {/* --- RICH TEXT TOOLBAR --- */}
                        <div className="px-4 py-2 border-y border-gray-100 bg-gray-50 flex flex-wrap items-center gap-2 shrink-0">
                            {/* Formatting */}
                            <div className="flex bg-white rounded-lg border border-gray-200 p-1 shadow-sm shrink-0">
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('bold')} className="p-1.5 hover:bg-gray-100 rounded text-gray-700" title="Negrito"><Bold size={16}/></button>
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('italic')} className="p-1.5 hover:bg-gray-100 rounded text-gray-700" title="Itálico"><Italic size={16}/></button>
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('underline')} className="p-1.5 hover:bg-gray-100 rounded text-gray-700" title="Sublinhado"><Underline size={16}/></button>
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('strikeThrough')} className="p-1.5 hover:bg-gray-100 rounded text-gray-700" title="Tachado"><Strikethrough size={16}/></button>
                            </div>

                            {/* Lists */}
                            <div className="flex bg-white rounded-lg border border-gray-200 p-1 shadow-sm shrink-0 ml-2">
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('insertUnorderedList')} className="p-1.5 hover:bg-gray-100 rounded text-gray-700" title="Marcadores"><List size={16}/></button>
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('insertOrderedList')} className="p-1.5 hover:bg-gray-100 rounded text-gray-700" title="Numeração"><ListOrdered size={16}/></button>
                                {/* CUSTOM CHECKLIST BUTTON */}
                                <button onMouseDown={(e) => e.preventDefault()} onClick={insertChecklist} className="p-1.5 hover:bg-brand-50 rounded text-brand-600 font-bold" title="Checklist (Caixa de Seleção)"><CheckSquare size={16}/></button>
                            </div>

                            {/* Alignment */}
                            <div className="flex bg-white rounded-lg border border-gray-200 p-1 shadow-sm shrink-0 ml-2 hidden sm:flex">
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('justifyLeft')} className="p-1.5 hover:bg-gray-100 rounded text-gray-700" title="Alinhar à Esquerda"><AlignLeft size={16}/></button>
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('justifyCenter')} className="p-1.5 hover:bg-gray-100 rounded text-gray-700" title="Centralizar"><AlignCenter size={16}/></button>
                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd('justifyRight')} className="p-1.5 hover:bg-gray-100 rounded text-gray-700" title="Alinhar à Direita"><AlignRight size={16}/></button>
                            </div>

                            {/* Colors & Fonts */}
                            <div className="flex bg-white rounded-lg border border-gray-200 p-1 shadow-sm shrink-0 ml-2 gap-1">
                                {/* Font Size */}
                                <div className="relative group">
                                    <button onMouseDown={(e) => e.preventDefault()} className="p-1.5 hover:bg-gray-100 rounded text-gray-700 flex items-center gap-1" title="Tamanho da Fonte"><Type size={16}/></button>
                                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg hidden group-hover:flex flex-col z-20 min-w-[40px] max-h-40 overflow-y-auto">
                                        {[1,2,3,4,5,6,7].map(s => (
                                            <button 
                                                key={s} 
                                                onMouseDown={(e) => { e.preventDefault(); execCmd('fontSize', s.toString()); }} 
                                                className="px-3 py-1 hover:bg-gray-100 text-sm w-full text-left"
                                            >
                                                T{s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                {/* Text Color Dropdown */}
                                <div className="relative group">
                                    <button 
                                        className="p-1.5 hover:bg-gray-100 rounded text-gray-700 flex items-center gap-1" 
                                        title="Cor do Texto"
                                        onMouseDown={(e) => e.preventDefault()}
                                    >
                                        <Palette size={16} />
                                    </button>
                                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl hidden group-hover:flex flex-col z-50 min-w-[140px] p-1 max-h-60 overflow-y-auto">
                                         <button
                                            onMouseDown={(e) => { e.preventDefault(); handleColorChange('foreColor', '#000000'); }}
                                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded text-xs text-gray-700 w-full"
                                         >
                                            <div className="w-4 h-4 rounded-full bg-black border border-gray-200"></div>
                                            Padrão
                                         </button>
                                        {PRESET_COLORS.map(c => (
                                            <button 
                                                key={c.value} 
                                                onMouseDown={(e) => { e.preventDefault(); handleColorChange('foreColor', c.value); }} 
                                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded text-xs text-gray-700 w-full"
                                            >
                                                <div className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: c.value }}></div>
                                                {c.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Highlight Color Dropdown */}
                                <div className="relative group">
                                    <button 
                                        className="p-1.5 hover:bg-yellow-50 rounded text-yellow-600 flex items-center gap-1" 
                                        title="Cor de Realce"
                                        onMouseDown={(e) => e.preventDefault()}
                                    >
                                        <Highlighter size={16} />
                                    </button>
                                    <div className="absolute top-full right-0 md:left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl hidden group-hover:flex flex-col z-50 min-w-[140px] p-1 max-h-60 overflow-y-auto">
                                         <button
                                            onMouseDown={(e) => { e.preventDefault(); handleColorChange('hiliteColor', 'transparent'); }}
                                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded text-xs text-gray-700 w-full"
                                         >
                                            <div className="w-4 h-4 rounded-full border border-gray-200 relative overflow-hidden">
                                                <div className="absolute inset-0 bg-red-500 rotate-45 w-[1px] left-1/2 -ml-[0.5px]"></div>
                                            </div>
                                            Sem Cor
                                         </button>
                                        {PRESET_COLORS.map(c => (
                                            <button 
                                                key={c.value} 
                                                onMouseDown={(e) => { e.preventDefault(); handleColorChange('hiliteColor', c.value); }} 
                                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded text-xs text-gray-700 w-full"
                                            >
                                                <div className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: c.value }}></div>
                                                {c.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Editor Content Area */}
                        <div className="flex-1 overflow-y-auto p-6 relative bg-white" onClick={() => editorRef.current?.focus()}>
                            <div 
                                ref={editorRef}
                                contentEditable
                                className="w-full min-h-full outline-none text-lg text-gray-700 leading-relaxed rich-text-content empty:before:content-[attr(placeholder)] empty:before:text-gray-300"
                                placeholder="Comece a digitar ou use o microfone..."
                                onInput={handleEditorInput}
                                onClick={handleEditorClick}
                                onKeyUp={saveSelection}
                                style={{
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word'
                                }}
                            ></div>
                        </div>
                        
                        {/* Footer Info */}
                        <div className="px-6 py-3 border-t border-gray-50 text-xs text-gray-400 flex justify-between md:rounded-b-[2rem] bg-gray-50/50 shrink-0">
                            <span className="uppercase font-bold tracking-wider">{currentNote.type === 'audio' ? 'Transcrição de Áudio' : currentNote.type === 'image' ? 'Extraído de Imagem' : 'Texto Manual'}</span>
                            <span>{new Date().toLocaleDateString('pt-BR')}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Sub-component for Note Card
const NoteCard: React.FC<{ note: Note, onClick: () => void, onPin: (n: Note, e: React.MouseEvent) => void, onDelete: (n: Note, e: React.MouseEvent) => void }> = ({ note, onClick, onPin, onDelete }) => (
    <div 
        onClick={onClick}
        className={`group bg-white p-5 rounded-2xl shadow-sm border border-transparent hover:border-brand-200 hover:shadow-lg transition-all cursor-pointer relative overflow-hidden flex flex-col h-48`}
    >
        {note.isPinned && <div className="absolute top-0 right-0 w-8 h-8 bg-yellow-100 rounded-bl-2xl flex items-center justify-center text-yellow-600"><Pin size={14} fill="currentColor" /></div>}
        
        <h3 className="font-bold text-gray-900 text-lg mb-2 line-clamp-2 leading-tight pr-6">{note.title}</h3>
        
        <div className="flex-1 overflow-hidden relative">
            <p className="text-gray-500 text-sm leading-relaxed line-clamp-4">
                {/* Strip HTML tags for preview to avoid raw HTML rendering issues or layout breaks */}
                {stripHtml(note.content)}
            </p>
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent"></div>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-50 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <span className={`p-1 rounded-md ${note.type === 'audio' ? 'bg-red-50 text-red-500' : note.type === 'image' ? 'bg-purple-50 text-purple-500' : 'bg-gray-100 text-gray-500'}`}>
                    {note.type === 'audio' ? <Mic size={12} /> : note.type === 'image' ? <ImageIcon size={12} /> : <PenTool size={12} />}
                </span>
                <span className="text-[10px] font-bold text-gray-400 uppercase">{new Date(note.createdAt).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}</span>
            </div>
            
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => onPin(note, e)} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-yellow-500">
                    <Pin size={14} />
                </button>
                <button onClick={(e) => onDelete(note, e)} className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500">
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    </div>
);