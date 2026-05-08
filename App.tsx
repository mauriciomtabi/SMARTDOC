import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, SmartDocument, DocCategory, SmartFolder } from './types';
import { NavBar } from './components/NavBar';
import { Scanner } from './components/Scanner';
import { DocCard } from './components/DocCard';
import { FinanceDashboard } from './components/FinanceDashboard';
import { NotesDashboard } from './components/NotesDashboard';
import { Auth } from './components/Auth';
import { Onboarding, TourStep } from './components/Onboarding';
import { supabase } from './services/supabase';
import { Search, ChevronLeft, Calendar, Tag, Info, Trash2, Filter, FolderPlus, Download, FolderOpen, Settings, X, Check, ChevronDown, AlertTriangle, ZoomIn, ZoomOut, Maximize2, Move, FolderInput, Edit, Save, Camera, MoreVertical, LayoutGrid, LogOut, Loader2, Star, FileText, Paperclip, RotateCw, Minus, Plus, Expand, Smile, Scan, HelpCircle, Share2, MessageCircle, File } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// Icons for folders
const AVAILABLE_ICONS = [
  '📁', '💼', '🏠', '🏥', '✈️', '🎓', '🛒', '📄', '💳', '🔧', '🚗', '⚖️', '💡', '🎉', '👶', '🐾'
];

const formatDateBR = (dateString: string) => {
  if (!dateString) return 'Data desconhecida';
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  }
  return dateString;
};

// Helper for Currency
const formatCurrency = (value: number | string) => {
  const num = Number(value);
  if (isNaN(num)) return value;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  
  // Tour State
  const [runTour, setRunTour] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const [currentView, setCurrentView] = useState<View>(View.HOME);
  const [documents, setDocuments] = useState<SmartDocument[]>([]);
  const [folders, setFolders] = useState<SmartFolder[]>([]);
  
  // Navigation State
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<SmartDocument | null>(null);
  
  // Edit Mode State
  const [isEditingDoc, setIsEditingDoc] = useState(false);
  const [editFormData, setEditFormData] = useState<SmartDocument | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Sharing State
  const [showShareModal, setShowShareModal] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // UI State - Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const filterContainerRef = useRef<HTMLDivElement>(null);
  
  // Folder Management State
  const [isManageFolderOpen, setIsManageFolderOpen] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [folderNameInput, setFolderNameInput] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(AVAILABLE_ICONS[0]);

  // Delete Confirmation State
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [folderDeleteConfirm, setFolderDeleteConfirm] = useState<{ id: string, name: string } | null>(null);

  // Viewer State (Detail View)
  const [detailScale, setDetailScale] = useState(100);
  const [detailRotation, setDetailRotation] = useState(0);

  // Image Viewer State (Zoom/Pan)
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [viewerScale, setViewerScale] = useState(1);
  const [viewerPosition, setViewerPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const lastTouchDistance = useRef<number | null>(null);

  // Detect mobile for tour target logic
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- TOUR STEPS GENERATION (Dynamic based on device) ---
  const getTourSteps = (): TourStep[] => [
    { 
        title: 'Bem-vindo ao SmartDoc', 
        description: 'Seu assistente pessoal para organizar documentos e finanças com Inteligência Artificial. Vamos fazer um tour rápido para conhecer as principais funcionalidades.', 
        view: 'HOME',
        image: 'https://images.unsplash.com/photo-1633265486064-086b219458ce?auto=format&fit=crop&q=80&w=800&h=600'
    },
    {
        title: 'Módulo Finanças: A Porta de Entrada',
        description: 'Na tela principal, você tem uma visão clara do seu **patrimônio** e **fluxo de caixa**.<br/><br/>• Acompanhe receitas e despesas<br/>• Veja seu saldo em tempo real',
        view: 'FINANCE',
        image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=800&h=600'
    },
    {
        title: 'Lançamentos: O Pulo do Gato 🎙️',
        description: 'Aqui está o grande diferencial: use o **Lançamento por Áudio**!<br/><br/>Basta falar "Gastei 50 reais de gasolina" e a IA entende o contexto, valor e categoria. Você também pode usar o modo **Manual** se preferir.',
        view: 'FINANCE',
        image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=800&h=600'
    },
    {
        title: 'Gestão, Produtividade e Inteligência',
        description: '• Organize **Categorias**<br/>• Visualize **Projeções** futuras<br/>• Use a **Cópia de despesas do mês anterior** para ganhar tempo.<br/><br/>Na aba **Relatórios**, veja indicadores inteligentes e compartilhe o resumo via WhatsApp!',
        view: 'FINANCE',
        image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800&h=600'
    },
    {
        title: 'Documentos: Sua Pasta Digital Infinita',
        description: 'Elimine a busca caótica em e-mails ou pastas físicas.<br/><br/>• Organize contratos<br/>• Guarde certificados<br/>• Salve exames em um só lugar',
        view: 'HOME',
        image: 'https://images.unsplash.com/photo-1618044733300-9472054094ee?auto=format&fit=crop&q=80&w=800&h=600'
    },
    {
        title: 'Scanner Inteligente 📸',
        description: 'Aqui está o grande diferencial: aponte a câmera ou faça upload e o nosso **Scanner Inteligente** entra em ação.<br/><br/>A IA lê e organiza o documento para que você possa buscá-lo facilmente depois.',
        view: 'HOME',
        image: 'https://images.unsplash.com/photo-1512314889357-e157c22f938d?auto=format&fit=crop&q=80&w=800&h=600'
    },
    {
        title: 'Anotações: Seu Cérebro Dinâmico',
        description: 'Ganhe agilidade no dia a dia com suas anotações e **Listas de Atividades**.',
        view: 'HOME',
        image: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&q=80&w=800&h=600'
    },
    {
        title: 'Áudio e Transcrição Mágica ✨',
        description: 'Aqui está o grande diferencial: registre lembretes rápidos via **Áudio** ou tire uma foto de uma anotação feita à mão.<br/><br/>A IA fará a **Transcrição de Manuscritos** automaticamente para texto digital!',
        view: 'HOME',
        image: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&q=80&w=800&h=600'
    }
  ];

  const tourSteps = getTourSteps();

  // --- SUPABASE AUTH & DATA LOADING ---

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingInitial(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchData();
      checkOnboardingStatus();
    }
  }, [session]);

  const checkOnboardingStatus = async () => {
    // 1. Check LocalStorage (Fastest check)
    const localHasSeen = localStorage.getItem('smartdoc_onboarding_completed');
    if (localHasSeen) return;

    // 2. Check Database (Source of Truth)
    try {
        const { data, error } = await supabase
            .from('user_settings')
            .select('has_seen_onboarding')
            .eq('user_id', session.user.id)
            .single();
        
        if (data && data.has_seen_onboarding) {
            // User saw it on another device, update local storage
            localStorage.setItem('smartdoc_onboarding_completed', 'true');
        } else {
            // New user OR hasn't seen it yet -> Start Tour
            startTour();
        }
    } catch (e) {
        // Fallback: If table doesn't exist or error, behave like new user if localStorage was empty
        startTour();
    }
  };

  // Tour Logic: Handle Step Changes
  useEffect(() => {
    if (!runTour) return;

    const step = tourSteps[tourStepIndex];
    if (!step) return;
    
    // Automatically switch views if required by the step
    if (step.view === 'FINANCE' && currentView !== View.FINANCE) {
      setCurrentView(View.FINANCE);
    } else if (step.view === 'HOME' && currentView !== View.HOME) {
      setCurrentView(View.HOME);
    }

  }, [runTour, tourStepIndex, currentView]);

  const startTour = () => {
    setRunTour(true);
    setTourStepIndex(0);
  };

  const nextTourStep = () => {
    if (tourStepIndex < tourSteps.length - 1) {
      setTourStepIndex(prev => prev + 1);
    } else {
      finishTour();
    }
  };

  const prevTourStep = () => {
    if (tourStepIndex > 0) {
      setTourStepIndex(prev => prev - 1);
    }
  };

  const finishTour = async () => {
    setRunTour(false);
    
    // Update Local Storage
    localStorage.setItem('smartdoc_onboarding_completed', 'true');
    
    // Update Database
    if (session?.user?.id) {
        try {
            await supabase.from('user_settings').upsert({
                user_id: session.user.id,
                has_seen_onboarding: true,
                updated_at: Date.now()
            });
        } catch (e) {
            console.error("Failed to save onboarding status", e);
        }
    }

    // Ensure we go back to home if left in finance
    if (currentView === View.FINANCE) setCurrentView(View.HOME);
  };

  // Reset viewer state when opening a doc
  useEffect(() => {
    if (selectedDoc) {
        setDetailScale(100);
        setDetailRotation(0);
        setShowShareModal(false); // Ensure modal is closed on new doc open
    }
  }, [selectedDoc]);

  const fetchData = async () => {
    try {
      const { data: docsData, error: docsError } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
      const { data: foldersData, error: foldersError } = await supabase.from('folders').select('*').order('created_at', { ascending: true });

      if (docsError) console.error('Error fetching docs', docsError);
      if (foldersError) console.error('Error fetching folders', foldersError);

      // --- MAPPING: Database (snake_case) to App (CamelCase) ---
      if (docsData) {
        const mappedDocs: SmartDocument[] = docsData.map((d: any) => ({
          id: d.id,
          folderId: d.folder_id,
          title: d.title,
          category: d.category,
          date: d.date,
          summary: d.summary,
          keyValues: d.key_values || {},
          imageUrl: d.image_url,
          icon: d.icon, // Mapping new field
          isFavorite: d.is_favorite || false,
          createdAt: d.created_at
        }));
        setDocuments(mappedDocs);
      }

      if (foldersData) {
        const mappedFolders: SmartFolder[] = foldersData.map((f: any) => ({
          id: f.id,
          name: f.name,
          icon: f.icon,
          createdAt: f.created_at
        }));
        setFolders(mappedFolders);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // --- PERSISTENCE LOGIC (SUPABASE) ---

  const uploadImage = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${session.user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from('documents').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleScanComplete = async (newDoc: SmartDocument, originalFile: File) => {
    let finalDoc = { ...newDoc, isFavorite: false };

    // 0. AUTO-CREATE FOLDER CHECK
    if (finalDoc.folderId === 'CREATE_DEFAULT_FOLDER') {
       try {
          const newFolderPayload = {
             user_id: session.user.id,
             name: 'Todos',
             icon: '📁',
             created_at: Date.now()
          };
          
          const { data: folderData, error: folderError } = await supabase.from('folders').insert(newFolderPayload).select().single();

          if (folderError) throw folderError;

          if (folderData) {
              const newSmartFolder: SmartFolder = {
                  id: folderData.id,
                  name: folderData.name,
                  icon: folderData.icon,
                  createdAt: folderData.created_at
              };
              
              setFolders(prev => [...prev, newSmartFolder]);
              finalDoc.folderId = newSmartFolder.id;
          }
       } catch (e: any) {
          console.error("Error creating default folder", e);
          alert(`Erro ao criar pasta automática 'Todos': ${e.message}`);
          return;
       }
    }

    // Optimistic Update
    setDocuments(prev => [finalDoc, ...prev]);
    setCurrentView(View.HOME);
    
    try {
      // 1. Upload Image
      const publicUrl = await uploadImage(originalFile);
      
      // Update local object
      finalDoc = { ...finalDoc, imageUrl: publicUrl };
      setDocuments(prev => prev.map(d => d.id === finalDoc.id ? finalDoc : d));
      
      // 2. Save Metadata to DB
      const docToSave = {
        user_id: session.user.id,
        folder_id: finalDoc.folderId,
        title: finalDoc.title,
        category: finalDoc.category,
        date: finalDoc.date,
        summary: finalDoc.summary,
        key_values: finalDoc.keyValues,
        image_url: publicUrl,
        icon: finalDoc.icon, // Save icon
        is_favorite: false,
        created_at: finalDoc.createdAt
      };

      const { data, error } = await supabase.from('documents').insert(docToSave).select().single();
      
      if (error) throw error;
      
      if (data) {
        const confirmedDoc: SmartDocument = {
            id: data.id,
            folderId: data.folder_id,
            title: data.title,
            category: data.category,
            date: data.date,
            summary: data.summary,
            keyValues: data.key_values,
            imageUrl: data.image_url,
            icon: data.icon, // Map icon back
            isFavorite: data.is_favorite,
            createdAt: data.created_at
        };
        setDocuments(prev => prev.map(d => d.id === finalDoc.id ? confirmedDoc : d));
        setSelectedDoc(confirmedDoc);
      }
    } catch (error: any) {
      console.error("Error saving document:", error);
      alert(`Erro ao salvar: ${error.message || 'Verifique sua conexão.'}`);
      setDocuments(prev => prev.filter(d => d.id !== finalDoc.id));
    }
  };

  const toggleFavorite = async (doc: SmartDocument) => {
    const newValue = !doc.isFavorite;
    
    const updatedDoc = { ...doc, isFavorite: newValue };
    setDocuments(prev => prev.map(d => d.id === doc.id ? updatedDoc : d));
    if (selectedDoc?.id === doc.id) {
        setSelectedDoc(updatedDoc);
    }

    try {
        await supabase.from('documents').update({ is_favorite: newValue }).eq('id', doc.id);
    } catch (e) {
        console.error("Error toggling favorite", e);
        const rollbackDoc = { ...doc, isFavorite: !newValue };
        setDocuments(prev => prev.map(d => d.id === doc.id ? rollbackDoc : d));
        if (selectedDoc?.id === doc.id) setSelectedDoc(rollbackDoc);
    }
  };

  const executeDelete = async () => {
    if (selectedDoc) {
      try {
        const { error } = await supabase.from('documents').delete().eq('id', selectedDoc.id);
        if (error) throw error;
        
        setDocuments(prev => prev.filter(d => d.id !== selectedDoc.id));
        setSelectedDoc(null);
        setIsDeleteConfirmOpen(false);

        if (selectedDoc.imageUrl.includes('supabase')) {
           const pathParts = selectedDoc.imageUrl.split('/documents/');
           if (pathParts.length > 1) {
              const path = pathParts[1];
              await supabase.storage.from('documents').remove([path]);
           }
        }

      } catch (error) {
        console.error("Error deleting doc:", error);
        alert("Erro ao excluir.");
      }
    }
  };

  const handleMoveDocument = async (docId: string, newFolderId: string) => {
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, folderId: newFolderId } : d));
    const updatedDoc = documents.find(d => d.id === docId);
    if (updatedDoc) setSelectedDoc({ ...updatedDoc, folderId: newFolderId });
    else if (selectedDoc) setSelectedDoc({ ...selectedDoc, folderId: newFolderId });

    await supabase.from('documents').update({ folder_id: newFolderId }).eq('id', docId);
  };

  // Edit Mode Functions
  const startEditing = () => {
    if (selectedDoc) {
      setEditFormData({ ...selectedDoc });
      setIsEditingDoc(true);
    }
  };

  const cancelEditing = () => {
    setEditFormData(null);
    setIsEditingDoc(false);
  };

  const saveEditing = async () => {
    if (editFormData && selectedDoc) {
      const updatedDoc = { ...editFormData };
      
      setDocuments(prev => prev.map(d => d.id === updatedDoc.id ? updatedDoc : d));
      setSelectedDoc(updatedDoc);
      setIsEditingDoc(false);
      setEditFormData(null);

      try {
        const updatePayload = {
           title: updatedDoc.title,
           date: updatedDoc.date,
           summary: updatedDoc.summary,
           key_values: updatedDoc.keyValues,
           image_url: updatedDoc.imageUrl,
           icon: updatedDoc.icon, // Save custom icon
           is_favorite: updatedDoc.isFavorite
        };

        const { error } = await supabase.from('documents').update(updatePayload).eq('id', updatedDoc.id);

        if (error) throw error;
      } catch (err) {
        console.error("Error updating doc", err);
        alert("Erro ao atualizar documento.");
      }
    }
  };

  const updateEditField = (field: keyof SmartDocument, value: any) => {
    if (editFormData) {
      setEditFormData(prev => prev ? { ...prev, [field]: value } : null);
    }
  };

  const updateKeyValue = (key: string, value: string) => {
    if (editFormData) {
      setEditFormData(prev => prev ? {
        ...prev,
        keyValues: {
          ...prev.keyValues,
          [key]: value
        }
      } : null);
    }
  };

  const handleImageUpdate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editFormData && session) {
        try {
           const publicUrl = await uploadImage(file);
           setEditFormData({ ...editFormData, imageUrl: publicUrl });
        } catch(e) {
          alert("Erro ao fazer upload da nova imagem.");
        }
    }
  };

  // Folder Management
  const handleSaveFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderNameInput.trim()) return;

    try {
      if (editingFolderId) {
        const { error } = await supabase.from('folders').update({ name: folderNameInput, icon: selectedIcon }).eq('id', editingFolderId);
        if (error) throw error;
        
        setFolders(prev => prev.map(f => f.id === editingFolderId ? { ...f, name: folderNameInput, icon: selectedIcon } : f));
      } else {
        const newFolderPayload = {
          user_id: session.user.id,
          name: folderNameInput,
          icon: selectedIcon,
          created_at: Date.now()
        };
        const { data, error } = await supabase.from('folders').insert(newFolderPayload).select().single();
        if (error) throw error;
        
        if (data) {
             const newFolder: SmartFolder = {
                 id: data.id,
                 name: data.name,
                 icon: data.icon,
                 createdAt: data.created_at
             };
             setFolders(prev => [...prev, newFolder]);
        }
      }
      setIsManageFolderOpen(false);
    } catch (e) {
      console.error("Error saving folder", e);
      alert("Erro ao salvar pasta.");
    }
  };

  // NEW: Request deletion logic replacing native confirmation
  const requestDeleteFolder = (id: string) => {
    const folder = folders.find(f => f.id === id);
    if (folder) {
        setIsManageFolderOpen(false); // Close the settings modal
        setFolderDeleteConfirm({ id: folder.id, name: folder.name });
    }
  };

  // NEW: Confirm deletion logic
  const confirmDeleteFolder = async () => {
    if (!folderDeleteConfirm) return;
    const { id } = folderDeleteConfirm;
    
    try {
        const fallbackId = folders.find(f => f.id !== id && (f.name === 'Todos' || f.name === 'Geral'))?.id || folders.find(f => f.id !== id)?.id || 'root'; 
        
        await supabase.from('documents').update({ folder_id: fallbackId }).eq('folder_id', id);
        await supabase.from('folders').delete().eq('id', id);

        setDocuments(prev => prev.map(d => d.folderId === id ? { ...d, folderId: fallbackId } : d));
        setFolders(prev => prev.filter(f => f.id !== id));
        setCurrentFolderId(null);
        setFolderDeleteConfirm(null);
    } catch (e) {
        console.error(e);
        alert("Erro ao excluir pasta.");
    }
  };

  // Click Outside Handlers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
      if (filterContainerRef.current && !filterContainerRef.current.contains(event.target as Node)) {
        setIsFilterMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const openCreateFolder = () => {
    setEditingFolderId(null);
    setFolderNameInput('');
    setSelectedIcon(AVAILABLE_ICONS[0]);
    setIsManageFolderOpen(true);
  };

  const openEditFolder = (folder: SmartFolder) => {
    setEditingFolderId(folder.id);
    setFolderNameInput(folder.name);
    setSelectedIcon(folder.icon);
    setIsManageFolderOpen(true);
  };

  const handleDownload = (doc: SmartDocument) => {
    const isPdf = doc.imageUrl.toLowerCase().endsWith('.pdf');
    const isAudio = doc.imageUrl.toLowerCase().endsWith('.webm') || doc.imageUrl.toLowerCase().endsWith('.mp3');
    
    const link = document.createElement('a');
    link.href = doc.imageUrl;
    
    let ext = '.jpg';
    if(isPdf) ext = '.pdf';
    if(isAudio) ext = '.webm';
    
    link.download = `${doc.title.replace(/\s+/g, '_')}_${doc.date}${ext}`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Share Logic
  const handleShareNative = async () => {
    if (!selectedDoc) return;
    setIsSharing(true);

    try {
        // 1. Fetch Blob from URL (Using cors mode)
        const response = await fetch(selectedDoc.imageUrl, { mode: 'cors' });
        const blob = await response.blob();
        
        // 2. Determine File Properties
        const isPdf = selectedDoc.imageUrl.toLowerCase().includes('.pdf');
        const filename = `${selectedDoc.title.replace(/[^a-z0-9]/gi, '_')}.${isPdf ? 'pdf' : 'jpg'}`;
        const mimeType = isPdf ? 'application/pdf' : 'image/jpeg';

        // 3. Create File Object
        const file = new File([blob], filename, { type: mimeType });

        // 4. Share using Navigator
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: selectedDoc.title,
                text: `${selectedDoc.title} - ${selectedDoc.summary}`
            });
        } else {
            // Fallback: Download if share not supported
            handleDownload(selectedDoc);
        }
    } catch (error) {
        console.error("Sharing failed", error);
        alert("Não foi possível compartilhar diretamente. O arquivo será baixado.");
        handleDownload(selectedDoc);
    } finally {
        setIsSharing(false);
    }
  };

  const getPseudoFilename = (doc: SmartDocument) => {
      const isPdf = doc.imageUrl.toLowerCase().includes('.pdf');
      const isAudio = doc.imageUrl.toLowerCase().includes('.webm');
      let ext = '.jpg';
      if(isPdf) ext = '.pdf';
      if(isAudio) ext = '.webm';
      const cleanTitle = doc.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
      return `${cleanTitle}_${doc.id.substring(0, 6)}${ext}`.toUpperCase();
  };

  // Search Logic
  const searchSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const term = searchQuery.toLowerCase();
    const titles = Array.from(new Set<string>(
      documents
        .filter(d => d.title.toLowerCase().includes(term))
        .map(d => d.title)
    ));
    return titles.slice(0, 5);
  }, [searchQuery, documents]);

  const filteredDocuments = documents.filter(doc => {
    if (showFavoritesOnly && !doc.isFavorite) return false; 
    
    const currentFolderObj = folders.find(f => f.id === currentFolderId);
    const isTodosFolder = currentFolderObj?.name === 'Todos';

    if (currentFolderId && !isTodosFolder && doc.folderId !== currentFolderId) return false;
    
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          doc.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          JSON.stringify(doc.keyValues).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(doc.category);
    return matchesSearch && matchesCategory;
  });

  // Zoom Handlers
  const handleZoomIn = () => setViewerScale(prev => Math.min(prev + 0.5, 5));
  const handleZoomOut = () => setViewerScale(prev => Math.max(prev - 0.5, 1));
  const handleResetZoom = () => {
    setViewerScale(1);
    setViewerPosition({ x: 0, y: 0 });
  };
  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY * -0.002;
    setViewerScale(prev => Math.min(Math.max(1, prev + delta), 5));
  };
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (viewerScale <= 1) return;
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    dragStartRef.current = { x: clientX - viewerPosition.x, y: clientY - viewerPosition.y };
  };
  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setViewerPosition({ x: clientX - dragStartRef.current.x, y: clientY - dragStartRef.current.y });
  };
  const handleDragEnd = () => setIsDragging(false);
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setIsDragging(false);
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      lastTouchDistance.current = dist;
    } else {
      handleDragStart(e);
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistance.current) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const delta = dist - lastTouchDistance.current;
      setViewerScale(prev => Math.min(Math.max(1, prev + (delta * 0.005)), 5));
      lastTouchDistance.current = dist;
    } else {
      handleDragMove(e);
    }
  };
  const handleTouchEnd = () => { lastTouchDistance.current = null; handleDragEnd(); };

  // Helper to identify PDF/Audio
  const isPdfDoc = (doc: SmartDocument | null) => doc?.imageUrl.toLowerCase().includes('.pdf');
  const isAudioDoc = (doc: SmartDocument | null) => doc?.imageUrl.toLowerCase().includes('.webm') || doc?.imageUrl.toLowerCase().includes('.mp3');

  // Zoom Helpers for Detail View
  const zoomIn = () => setDetailScale(prev => Math.min(prev + 10, 200));
  const zoomOut = () => setDetailScale(prev => Math.max(prev - 10, 10));
  const rotateLeft = () => setDetailRotation(prev => prev - 90);
  const rotateRight = () => setDetailRotation(prev => prev + 90);

  // --- RENDER ---

  if (loadingInitial) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
        <img src="https://i.postimg.cc/ZKPfX7xK/Chat-GPT-Image-16-de-fev-de-2026-13-26-05-removebg-preview.png" alt="Logo" className="w-20 h-20 object-contain animate-pulse rounded-2xl shadow-sm" />
        <Loader2 className="animate-spin text-brand-600" size={32} />
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <>
      {/* Interactive Tour Overlay */}
      {runTour && (
        <Onboarding 
          steps={tourSteps}
          currentStepIndex={tourStepIndex}
          onNext={nextTourStep}
          onPrev={prevTourStep}
          onSkip={finishTour}
        />
      )}

      {/* --- FOLDER DELETE CONFIRMATION MODAL --- */}
      {folderDeleteConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 animate-in zoom-in-95">
                <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600 animate-bounce">
                        <Trash2 size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Excluir Pasta?</h3>
                    <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                        Tem certeza que deseja excluir a pasta "<strong>{folderDeleteConfirm.name}</strong>"? <br/>Os documentos serão movidos para "Geral".
                    </p>
                    <div className="flex gap-3 w-full">
                        <button
                            onClick={() => setFolderDeleteConfirm(null)}
                            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={confirmDeleteFolder}
                            className="flex-1 px-4 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 shadow-lg shadow-red-500/30 transition-colors"
                        >
                            Sim, Excluir
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* 1. Document Details Overlay */}
      {selectedDoc && (
       <div className="fixed inset-0 z-50 bg-gray-50/95 backdrop-blur-sm overflow-y-auto animate-in slide-in-from-right duration-300 safe-area-pb">
          {/* Share Modal (Clone of Finance Style) */}
          {showShareModal && (
            <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Compartilhar</h3>
                            <p className="text-xs text-gray-500">Enviar arquivo original</p>
                        </div>
                        <button onClick={() => setShowShareModal(false)} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"><X size={20}/></button>
                    </div>

                    <div className="flex-1 overflow-y-auto mb-4 bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center min-h-[250px] relative overflow-hidden group">
                        {isPdfDoc(selectedDoc) ? (
                            <div className="flex flex-col items-center gap-2">
                                <FileText size={64} className="text-red-500" />
                                <span className="text-sm font-bold text-gray-700">Documento PDF</span>
                            </div>
                        ) : isAudioDoc(selectedDoc) ? (
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center text-brand-600">
                                    <div className="w-3 h-3 bg-current rounded-full animate-ping"></div>
                                </div>
                                <span className="text-sm font-bold text-gray-700">Arquivo de Áudio</span>
                            </div>
                        ) : (
                            <img src={selectedDoc.imageUrl} alt="Preview" className="w-full h-full object-cover opacity-90" />
                        )}
                        
                        {/* Overlay Info */}
                        <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur p-3 border-t border-gray-200">
                            <p className="text-xs font-bold text-gray-900 truncate">{selectedDoc.title}</p>
                            <p className="text-[10px] text-gray-500">{formatDateBR(selectedDoc.date)}</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <button 
                            onClick={handleShareNative} 
                            disabled={isSharing}
                            className="w-full flex items-center gap-4 p-4 bg-green-600 text-white rounded-2xl hover:bg-green-700 transition-colors font-bold text-sm shadow-lg shadow-green-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                                {isSharing ? <Loader2 className="animate-spin" size={18} /> : <MessageCircle size={18} />}
                            </div>
                            {isSharing ? 'Preparando...' : 'Compartilhar no WhatsApp'}
                        </button>

                        <button 
                            onClick={() => handleDownload(selectedDoc)}
                            className="w-full flex items-center gap-4 p-4 bg-gray-50 text-gray-700 rounded-2xl hover:bg-gray-100 transition-colors font-bold text-sm"
                        >
                            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                                <Download size={18} />
                            </div>
                            Baixar Arquivo
                        </button>
                    </div>
                </div>
            </div>
          )}

          {/* Delete Confirmation Modal (Docs) */}
          {isDeleteConfirmOpen && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 animate-in zoom-in-95">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600 animate-bounce">
                        <AlertTriangle size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Excluir Documento?</h3>
                    <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                      Tem certeza que deseja excluir "<strong>{selectedDoc.title}</strong>"? <br/>Esta ação é irreversível.
                    </p>
                    <div className="flex gap-3 w-full">
                        <button
                          onClick={() => setIsDeleteConfirmOpen(false)}
                          className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={executeDelete}
                          className="flex-1 px-4 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 shadow-lg shadow-red-500/30 transition-colors"
                        >
                          Sim, Excluir
                        </button>
                    </div>
                  </div>
              </div>
            </div>
          )}

          {/* Full Screen Image Viewer */}
          {isImageViewerOpen && !isPdfDoc(selectedDoc) && !isAudioDoc(selectedDoc) && (
            <div className="fixed inset-0 z-[80] bg-black flex flex-col animate-in fade-in duration-300">
               <div className="flex items-center justify-between p-4 text-white z-20 bg-gradient-to-b from-black/60 to-transparent">
                  <h3 className="text-sm font-medium opacity-90 truncate max-w-[200px]">{selectedDoc.title}</h3>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleDownload(selectedDoc)}
                      className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-colors backdrop-blur-md"
                    >
                      <Download size={20} />
                    </button>
                    <button 
                      onClick={() => { setIsImageViewerOpen(false); handleResetZoom(); }}
                      className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-colors backdrop-blur-md"
                    >
                      <X size={20} />
                    </button>
                  </div>
               </div>

               <div 
                className="flex-1 overflow-hidden relative flex items-center justify-center cursor-move touch-none"
                onWheel={handleWheel}
                onMouseDown={handleDragStart}
                onMouseMove={handleDragMove}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onDoubleClick={viewerScale > 1 ? handleResetZoom : handleZoomIn}
               >
                  <img 
                    src={selectedDoc.imageUrl} 
                    alt={selectedDoc.title} 
                    className="max-w-none transition-transform duration-75 ease-linear select-none"
                    style={{
                      transform: `scale(${viewerScale}) translate(${viewerPosition.x / viewerScale}px, ${viewerPosition.y / viewerScale}px)`,
                      maxHeight: '100%',
                      maxWidth: '100%',
                      cursor: viewerScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                    }}
                    draggable={false}
                  />
               </div>

               <div className="p-8 flex justify-center gap-4 z-20 pb-16 safe-area-pb">
                  <div className="flex items-center gap-4 bg-gray-900/80 backdrop-blur-xl rounded-full px-6 py-3 border border-white/10 shadow-2xl">
                    <button onClick={handleZoomOut} className="text-white/80 hover:text-white transition-colors" disabled={viewerScale <= 1}>
                      <ZoomOut size={24} className={viewerScale <= 1 ? "opacity-30" : ""} />
                    </button>
                    <span className="text-white text-sm font-mono w-12 text-center">{Math.round(viewerScale * 100)}%</span>
                    <button onClick={handleZoomIn} className="text-white/80 hover:text-white transition-colors" disabled={viewerScale >= 5}>
                      <ZoomIn size={24} className={viewerScale >= 5 ? "opacity-30" : ""} />
                    </button>
                    <div className="w-px h-6 bg-white/20 mx-2"></div>
                    <button onClick={handleResetZoom} className="text-white/80 hover:text-white transition-colors">
                      <Maximize2 size={20} />
                    </button>
                  </div>
               </div>
            </div>
          )}

          <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-gray-100 p-4 flex items-center justify-between z-10 safe-area-pt shadow-sm">
            <button 
              onClick={() => {
                if (isEditingDoc) cancelEditing();
                else setSelectedDoc(null);
              }}
              className="p-2.5 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
            <h2 className="font-bold text-gray-900 text-lg">
              {isEditingDoc ? 'Editando' : 'Detalhes'}
            </h2>
            <div className="flex gap-2 items-center">
              {isEditingDoc ? (
                 <>
                   <button 
                    onClick={cancelEditing}
                    className="p-2.5 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                   >
                     <X size={20} />
                   </button>
                   <button 
                    onClick={saveEditing}
                    className="p-2.5 text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-full transition-colors font-semibold"
                   >
                     <Check size={20} />
                   </button>
                 </>
              ) : (
                <>
                  <button
                    onClick={() => toggleFavorite(selectedDoc)}
                    className={`p-2.5 rounded-full transition-all ${selectedDoc.isFavorite ? 'text-yellow-500 bg-yellow-50' : 'text-gray-400 hover:bg-gray-100'}`}
                  >
                    <Star size={20} fill={selectedDoc.isFavorite ? "currentColor" : "none"} />
                  </button>

                  <button 
                    onClick={startEditing}
                    className="p-2.5 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <Edit size={20} />
                  </button>
                  
                  <div className="relative group">
                    <button className="p-2.5 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                      <FolderInput size={20} />
                    </button>
                    <select 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        value={selectedDoc.folderId}
                        onChange={(e) => handleMoveDocument(selectedDoc.id, e.target.value)}
                        style={{ colorScheme: 'light' }}
                    >
                        {folders.map(f => (
                            <option key={f.id} value={f.id} className="bg-white text-gray-900">{f.name}</option>
                        ))}
                    </select>
                  </div>

                  <button 
                    onClick={() => setShowShareModal(true)}
                    className="p-2.5 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    title="Compartilhar"
                  >
                    <Share2 size={20} />
                  </button>

                  <button 
                    onClick={() => setIsDeleteConfirmOpen(true)}
                    className="p-2.5 -mr-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  >
                    <Trash2 size={20} />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8">
             <div className="flex flex-col xl:flex-row gap-6">
                
                {/* --- ATTACHMENT VIEWER SECTION --- */}
                <div className="w-full xl:w-7/12 flex flex-col">
                   <div className="rounded-xl overflow-hidden shadow-2xl border border-gray-700 bg-[#1e293b]">
                      
                      {/* 1. Header Dark Bar */}
                      <div className="bg-[#0f172a] px-4 py-3 flex items-center justify-between text-white border-b border-gray-700">
                         <div className="flex items-center gap-3 overflow-hidden">
                            <Paperclip size={20} className="text-gray-400 shrink-0" />
                            <span className="font-semibold text-sm truncate text-gray-200" title={getPseudoFilename(selectedDoc)}>
                                {getPseudoFilename(selectedDoc)}
                            </span>
                         </div>
                         <div className="flex items-center gap-2 shrink-0">
                            {/* DOWNLOAD BUTTON REMAINS HERE IN VIEWER */}
                            <button 
                                onClick={() => handleDownload(selectedDoc)}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-300 hover:text-white"
                                title="Baixar"
                            >
                                <Download size={20} />
                            </button>
                            <button 
                                onClick={() => setSelectedDoc(null)}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-300 hover:text-white"
                                title="Fechar Visualizador"
                            >
                                <X size={20} />
                            </button>
                         </div>
                      </div>

                      {/* 2. Toolbar (Zoom/Rotate) - Visible for Images */}
                      {!isAudioDoc(selectedDoc) && (
                        <div className="bg-[#1e293b] px-4 py-2 flex items-center justify-between border-b border-gray-700 text-gray-300">
                            <div className="flex items-center gap-4">
                                {!isPdfDoc(selectedDoc) && (
                                    <>
                                        <div className="flex items-center gap-1 bg-[#334155] rounded-lg p-1">
                                            <button onClick={zoomOut} className="p-1 hover:text-white hover:bg-white/10 rounded" title="Diminuir Zoom">
                                                <Minus size={16} />
                                            </button>
                                            <span className="text-xs font-mono w-10 text-center">{detailScale}%</span>
                                            <button onClick={zoomIn} className="p-1 hover:text-white hover:bg-white/10 rounded" title="Aumentar Zoom">
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                        <div className="w-px h-6 bg-gray-600"></div>
                                        <button onClick={rotateRight} className="p-2 hover:bg-[#334155] rounded-lg transition-colors" title="Girar">
                                            <RotateCw size={18} />
                                        </button>
                                    </>
                                )}
                                {isPdfDoc(selectedDoc) && (
                                    <span className="text-xs text-gray-500 font-medium px-2">Visualizador de PDF</span>
                                )}
                            </div>
                            
                            {isPdfDoc(selectedDoc) && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs bg-[#334155] px-2 py-1 rounded text-gray-400">1 / 1</span>
                                </div>
                            )}
                        </div>
                      )}

                      {/* 3. Main Content Area */}
                      <div className="bg-[#334155] w-full min-h-[300px] md:h-[650px] overflow-hidden relative flex items-center justify-center">
                         {isPdfDoc(selectedDoc) ? (
                             <iframe 
                                src={`${selectedDoc.imageUrl}#toolbar=0&navpanes=0`} 
                                className="w-full h-full border-none bg-white"
                                title="Document PDF"
                             />
                         ) : isAudioDoc(selectedDoc) ? (
                             <div className="flex flex-col items-center justify-center text-white w-full p-8 gap-6">
                                 <div className="w-24 h-24 bg-brand-500 rounded-full flex items-center justify-center animate-pulse">
                                     {/* Audio Icon */}
                                 </div>
                                 <audio controls className="w-full max-w-md" src={selectedDoc.imageUrl}>
                                     Seu navegador não suporta o elemento de áudio.
                                 </audio>
                                 <p className="text-gray-400 text-sm">Gravação da Reunião</p>
                             </div>
                         ) : (
                             <div className="w-full h-full overflow-auto flex items-center justify-center p-8 bg-grid-pattern">
                                 <style>{`
                                    .bg-grid-pattern {
                                        background-image: linear-gradient(45deg, #28303d 25%, transparent 25%), linear-gradient(-45deg, #28303d 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #28303d 75%), linear-gradient(-45deg, transparent 75%, #28303d 75%);
                                        background-size: 20px 20px;
                                        background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
                                        background-color: #334155;
                                    }
                                 `}</style>
                                 <img 
                                    src={isEditingDoc ? (editFormData?.imageUrl || selectedDoc.imageUrl) : selectedDoc.imageUrl}
                                    alt="Documento"
                                    className="max-w-none shadow-2xl transition-transform duration-200 ease-out origin-center"
                                    style={{
                                        transform: `scale(${detailScale / 100}) rotate(${detailRotation}deg)`
                                    }}
                                 />
                             </div>
                         )}
                      </div>
                   </div>
                </div>

                {/* --- DETAILS SECTION --- */}
                <div className="w-full xl:w-5/12 space-y-6">
                    <div>
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-brand-100 text-brand-700 uppercase tracking-wide">
                                {selectedDoc.category}
                            </span>
                            
                            {isEditingDoc ? (
                                <div className="flex items-center gap-2 bg-white border border-brand-300 px-3 py-1 rounded-full focus-within:ring-2 ring-brand-200">
                                <Calendar size={14} className="text-brand-500"/>
                                <input 
                                    type="date" 
                                    className="text-xs text-gray-700 bg-transparent outline-none font-medium"
                                    value={editFormData?.date || ''}
                                    onChange={(e) => updateEditField('date', e.target.value)}
                                />
                                </div>
                            ) : (
                                <span className="text-xs font-medium text-gray-500 flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-full">
                                <Calendar size={14} /> {formatDateBR(selectedDoc.date)}
                                </span>
                            )}
                        </div>

                        {/* --- ICON PICKER (Edit Mode Only) --- */}
                        {isEditingDoc && (
                             <div className="mb-4">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Smile size={14} /> Personalizar Ícone
                                </label>
                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                    {AVAILABLE_ICONS.map(icon => (
                                        <button
                                            key={icon}
                                            type="button"
                                            onClick={() => updateEditField('icon', icon)}
                                            className={`text-xl h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-xl transition-all border ${editFormData?.icon === icon ? 'bg-brand-100 border-brand-500 ring-1 ring-brand-500' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                                        >
                                            {icon}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => updateEditField('icon', undefined)} // Reset to default
                                        className={`text-xs h-10 w-auto px-3 flex-shrink-0 flex items-center justify-center rounded-xl transition-all border ${!editFormData?.icon ? 'bg-brand-100 border-brand-500' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                                    >
                                        Padrão
                                    </button>
                                </div>
                             </div>
                        )}

                        {isEditingDoc ? (
                            <input 
                            type="text" 
                            className="w-full text-3xl font-bold text-gray-900 border-b-2 border-brand-200 focus:border-brand-500 outline-none pb-2 bg-transparent placeholder-gray-300 transition-colors"
                            value={editFormData?.title || ''}
                            onChange={(e) => updateEditField('title', e.target.value)}
                            placeholder="Título do Documento"
                            />
                        ) : (
                            <h1 className="text-3xl font-bold text-gray-900 leading-tight tracking-tight flex items-center gap-3">
                                {selectedDoc.icon && <span className="text-4xl">{selectedDoc.icon}</span>}
                                {selectedDoc.title}
                            </h1>
                        )}
                    </div>

                    <div className={`p-6 rounded-2xl border transition-all ${isEditingDoc ? 'bg-white border-brand-200 shadow-lg shadow-brand-500/5' : 'bg-white border-gray-100 shadow-sm'}`}>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Info size={14} /> Resumo
                        </h3>
                        {isEditingDoc ? (
                            <textarea 
                            className="w-full text-base text-gray-700 bg-transparent outline-none resize-none min-h-[100px] leading-relaxed"
                            value={editFormData?.summary || ''}
                            onChange={(e) => updateEditField('summary', e.target.value)}
                            placeholder="Escreva um resumo..."
                            />
                        ) : (
                            <div className="prose prose-sm prose-gray max-w-none">
                                {/* Simple renderer for line breaks if not using a markdown lib */}
                                {selectedDoc.summary.split('\n').map((line, i) => (
                                    <p key={i} className="text-gray-600 leading-relaxed mb-2">{line}</p>
                                ))}
                            </div>
                        )}
                    </div>

                    {((selectedDoc.keyValues && Object.keys(selectedDoc.keyValues).length > 0) || isEditingDoc) && (
                        <div>
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Tag size={14} /> Detalhes Extraídos
                            </h3>
                            <div className="grid grid-cols-1 gap-3">
                            {(isEditingDoc ? Object.entries(editFormData?.keyValues || {}) : Object.entries(selectedDoc.keyValues)).map(([key, value]) => (
                                <div key={key} className={`border px-4 py-3 rounded-xl flex items-center justify-between transition-colors ${isEditingDoc ? 'bg-white border-brand-200' : 'bg-gray-50 border-gray-100'}`}>
                                <span className="text-xs text-gray-500 font-medium uppercase">{key}</span>
                                {isEditingDoc ? (
                                    <input 
                                    type="text"
                                    className="text-right font-semibold text-gray-800 outline-none bg-transparent border-b border-gray-300 focus:border-brand-500 focus:text-brand-600 w-1/2"
                                    value={value}
                                    onChange={(e) => updateKeyValue(key, e.target.value)}
                                    />
                                ) : (
                                    <span className="text-gray-900 font-semibold text-sm">
                                    {typeof value === 'number' && (key.toLowerCase().includes('total') || key.toLowerCase().includes('valor'))
                                        ? formatCurrency(value)
                                        : value}
                                    </span>
                                )}
                                </div>
                            ))}
                            </div>
                        </div>
                    )}
                </div>
             </div>
          </div>
       </div>
      )}

      {/* 2. Scanner View */}
      {currentView === View.SCAN && (
        <Scanner 
            currentFolderId={currentFolderId} // Allow null for smart suggestion
            folders={folders}
            onScanComplete={handleScanComplete} 
            onCancel={() => setCurrentView(View.HOME)} 
        />
      )}

      {/* 3. Finance View (NEW) */}
      {currentView === View.FINANCE && (
        <>
            <NavBar 
                currentView={currentView} 
                onChangeView={(v) => {
                if(v === View.HOME) setCurrentFolderId(null); 
                setCurrentView(v);
                }}
                onSignOut={() => supabase.auth.signOut()}
                onStartTour={startTour}
            />
            <FinanceDashboard session={session} />
        </>
      )}

      {/* 4. Notes View (Fixing White Screen) */}
      {currentView === View.NOTES && (
        <>
            <NavBar 
                currentView={currentView} 
                onChangeView={(v) => {
                if(v === View.HOME) setCurrentFolderId(null); 
                setCurrentView(v);
                }}
                onSignOut={() => supabase.auth.signOut()}
                onStartTour={startTour}
            />
            <NotesDashboard session={session} />
        </>
      )}

      {/* 5. Home View (Folders & Lists) */}
      {currentView === View.HOME && (
        <div className="min-h-screen bg-gray-50 pb-28 md:pb-0 safe-area-pb">
        <NavBar 
            currentView={currentView} 
            onChangeView={(v) => {
            if(v === View.HOME) setCurrentFolderId(null); 
            setCurrentView(v);
            }}
            onSignOut={() => supabase.auth.signOut()}
            onStartTour={startTour}
        />
        
        {/* Mobile Floating Action Button (Only on Home View) */}
        <div className="md:hidden fixed bottom-24 right-4 z-40 animate-in zoom-in slide-in-from-bottom-4">
            <button
                id="btn-new-scan"
                onClick={() => setCurrentView(View.SCAN)}
                className="w-14 h-14 bg-brand-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-brand-500/40 border-4 border-white active:scale-90 transition-transform"
            >
                <Scan size={26} strokeWidth={2.5} />
            </button>
        </div>

        <main className="max-w-6xl mx-auto pt-8 md:pt-28 px-4 md:px-8 safe-area-pt">
            
            {/* Top Header */}
            <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center justify-between mb-6">
                {currentFolderId ? (
                    <div className="flex items-center gap-3">
                        <button 
                        onClick={() => setCurrentFolderId(null)}
                        className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-full text-gray-600 hover:bg-gray-100 shadow-sm transition-all"
                        >
                        <ChevronLeft size={20} />
                        </button>
                        <div>
                            <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-0.5">Pasta</div>
                            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <span className="text-3xl">{folders.find(f => f.id === currentFolderId)?.icon}</span>
                                {folders.find(f => f.id === currentFolderId)?.name}
                            </h2>
                        </div>
                        <button 
                        onClick={() => {
                            const f = folders.find(f => f.id === currentFolderId);
                            if(f) openEditFolder(f);
                        }}
                        className="p-2 text-gray-300 hover:text-brand-600 transition-colors ml-2"
                        >
                        <Settings size={20} />
                        </button>
                    </div>
                ) : (
                    <div className="flex justify-between items-end w-full">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">Meus Documentos</h1>
                            <p className="text-gray-500 mt-1 font-medium">Organização Inteligente.</p>
                        </div>
                    <div className="flex gap-2">
                        <button 
                        id="btn-new-scan-desktop"
                        onClick={() => setCurrentView(View.SCAN)}
                        className="hidden md:flex text-white bg-brand-600 hover:bg-brand-700 px-4 py-2.5 rounded-xl items-center gap-2 text-sm font-bold transition-colors shadow-lg shadow-brand-500/20"
                        >
                        <Scan size={18} />
                        <span className="hidden sm:inline">Novo Scanner</span>
                        </button>
                        <button 
                        id="btn-new-folder"
                        onClick={openCreateFolder}
                        className="text-brand-600 bg-brand-50 hover:bg-brand-100 px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold transition-colors"
                        >
                        <FolderPlus size={18} />
                        <span className="hidden sm:inline">Nova Pasta</span>
                        </button>
                    </div>
                    </div>
                )}
            </div>

            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-4 z-20 relative">
                {/* Search with Suggestions */}
                <div className="relative flex-1" ref={searchContainerRef}>
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                        <Search size={20} />
                    </div>
                    <input 
                    type="text" 
                    placeholder={currentFolderId ? "Buscar nesta pasta..." : "O que você procura?"}
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-0 shadow-soft focus:shadow-xl focus:ring-0 text-gray-900 placeholder-gray-400 bg-white transition-all font-medium"
                    value={searchQuery}
                    onFocus={() => setShowSuggestions(true)}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowSuggestions(true);
                    }}
                    />
                    {/* Suggestions Dropdown */}
                    {showSuggestions && searchSuggestions.length > 0 && (
                    <ul className="absolute top-full left-0 right-0 mt-2 bg-white/90 backdrop-blur-md border border-white/20 rounded-2xl shadow-xl z-30 max-h-60 overflow-y-auto p-2">
                        {searchSuggestions.map((suggestion, index) => (
                        <li 
                            key={index}
                            className="px-4 py-3 hover:bg-brand-50 hover:text-brand-700 cursor-pointer text-sm text-gray-700 flex items-center gap-3 rounded-xl transition-colors"
                            onClick={() => {
                            setSearchQuery(suggestion);
                            setShowSuggestions(false);
                            }}
                        >
                            <Search size={16} className="text-brand-300" />
                            {suggestion}
                        </li>
                        ))}
                    </ul>
                    )}
                </div>
                
                {/* Filter Area: Favorites Toggle + Categories */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                        className={`h-full flex items-center justify-center px-4 py-3.5 rounded-2xl shadow-soft font-medium transition-all ${
                        showFavoritesOnly 
                            ? 'bg-yellow-400 text-white shadow-yellow-500/30 ring-2 ring-yellow-400 ring-offset-2' 
                            : 'bg-white text-gray-400 hover:text-yellow-500 hover:bg-gray-50'
                        }`}
                        title="Ver Favoritos"
                    >
                        <Star size={18} fill={showFavoritesOnly ? "currentColor" : "none"} strokeWidth={2.5} />
                    </button>

                    {/* Multi-select Filter Dropdown */}
                    <div className="relative min-w-[160px]" ref={filterContainerRef}>
                        <button
                        onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                        className={`w-full h-full flex items-center justify-between px-4 py-3.5 rounded-2xl shadow-soft font-medium transition-all ${
                            isFilterMenuOpen || selectedCategories.length > 0 ? 'bg-brand-600 text-white shadow-brand-500/30' : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                        >
                        <div className="flex items-center gap-2 overflow-hidden">
                            <Filter size={18} />
                            <span className="truncate text-sm">
                            {selectedCategories.length === 0 
                                ? 'Filtrar' 
                                : `${selectedCategories.length} ativo(s)`}
                            </span>
                        </div>
                        <ChevronDown size={16} className={`transition-transform ${isFilterMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isFilterMenuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-64 bg-white/90 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl z-30 p-2 animate-in zoom-in-95 origin-top-right">
                            <div className="text-xs font-bold text-gray-400 uppercase px-3 py-2">Categorias</div>
                            {Object.values(DocCategory).map(cat => {
                            const isSelected = selectedCategories.includes(cat);
                            return (
                                <div 
                                key={cat}
                                onClick={() => toggleCategory(cat)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-sm mb-1 transition-all ${
                                    isSelected ? 'bg-brand-50 text-brand-700 font-bold' : 'hover:bg-gray-100 text-gray-600'
                                }`}
                                >
                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                                    isSelected ? 'bg-brand-500 border-brand-500' : 'border-gray-300 bg-white'
                                }`}
                                >
                                    {isSelected && <Check size={14} className="text-white" />}
                                </div>
                                {cat}
                                </div>
                            );
                            })}
                            <div className="border-t border-gray-100 mt-2 pt-2 px-1">
                                <button 
                                onClick={() => {
                                    setSelectedCategories([]);
                                    setIsFilterMenuOpen(false);
                                }}
                                className="w-full py-2 text-xs font-semibold text-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                Limpar Filtros
                                </button>
                            </div>
                        </div>
                        )}
                    </div>
                </div>
            </div>
            </div>

            {/* Modal: Manage Folder */}
            {isManageFolderOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in">
                <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-8 animate-in zoom-in-95 scale-100">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900">
                        {editingFolderId ? 'Configurar Pasta' : 'Criar Nova Pasta'}
                    </h3>
                    <button onClick={() => setIsManageFolderOpen(false)} className="bg-gray-100 p-2 rounded-full text-gray-500 hover:text-gray-900 transition-colors">
                    <X size={20} />
                    </button>
                </div>
                
                <form onSubmit={handleSaveFolder}>
                    <div className="mb-6">
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-3 tracking-wider">Escolha um Ícone</label>
                    <div className="grid grid-cols-8 gap-2">
                        {AVAILABLE_ICONS.map(icon => (
                        <button
                            key={icon}
                            type="button"
                            onClick={() => setSelectedIcon(icon)}
                            className={`text-2xl h-10 w-10 flex items-center justify-center rounded-xl transition-all ${selectedIcon === icon ? 'bg-brand-100 ring-2 ring-brand-500 scale-110' : 'hover:bg-gray-50 hover:scale-105'}`}
                        >
                            {icon}
                        </button>
                        ))}
                    </div>
                    </div>

                    <div className="mb-8">
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-wider">Nome da Pasta</label>
                    <input 
                        autoFocus
                        type="text" 
                        placeholder="Ex: Viagem 2024"
                        className="w-full px-4 py-3 bg-gray-50 text-gray-900 border-none rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium placeholder-gray-400 transition-shadow"
                        value={folderNameInput}
                        onChange={e => setFolderNameInput(e.target.value)}
                    />
                    </div>

                    <div className="flex flex-col gap-3">
                    <button 
                        type="submit" 
                        className="w-full bg-brand-600 text-white px-6 py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-brand-500/30 hover:bg-brand-700 hover:shadow-brand-500/50 transition-all active:scale-[0.98]"
                    >
                        Salvar Pasta
                    </button>
                    
                    {editingFolderId && (
                        <button 
                        type="button"
                        onClick={() => requestDeleteFolder(editingFolderId)}
                        className="w-full px-6 py-3.5 text-red-500 bg-red-50 hover:bg-red-100 rounded-xl font-bold text-sm transition-colors"
                        >
                        Excluir Pasta
                        </button>
                    )}
                    </div>
                </form>
                </div>
            </div>
            )}

            {/* --- MAIN CONTENT AREA --- */}

            {/* SCENARIO 1: Folder Grid (Root View & No Search & No Filter) */}
            {!currentFolderId && !searchQuery && selectedCategories.length === 0 && !showFavoritesOnly && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-in slide-in-from-bottom-8 duration-700">
                {folders.map(folder => {
                    const count = documents.filter(d => d.folderId === folder.id).length;
                    return (
                    <button 
                        key={folder.id}
                        onClick={() => setCurrentFolderId(folder.id)}
                        className="flex flex-col items-center p-6 bg-white rounded-3xl shadow-soft hover:shadow-xl hover:-translate-y-1 transition-all group border border-transparent hover:border-brand-100 relative overflow-hidden"
                    >
                        <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-4xl mb-4 group-hover:bg-brand-50 group-hover:scale-110 transition-all duration-300 shadow-inner">
                            {folder.icon}
                        </div>
                        <span className="font-bold text-gray-800 text-sm text-center truncate w-full mb-1 group-hover:text-brand-700 transition-colors">{folder.name}</span>
                        <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">{count} docs</span>
                    </button>
                    )
                })}
            </div>
            )}

            {/* SCENARIO 2: Document List (Inside Folder OR Searching OR Filtering) */}
            {(currentFolderId || searchQuery || selectedCategories.length > 0 || showFavoritesOnly) && (
            <div>
                {filteredDocuments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center opacity-0 animate-in fade-in duration-700 fill-mode-forwards">
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6 text-gray-300">
                        <FolderOpen size={48} strokeWidth={1.5} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Está meio vazio por aqui</h3>
                    <p className="text-gray-500 max-w-xs mx-auto">Nenhum documento encontrado com os filtros atuais.</p>
                    {currentFolderId && !searchQuery && selectedCategories.length === 0 && !showFavoritesOnly && (
                        <button 
                        onClick={() => setCurrentView(View.SCAN)}
                        className="mt-6 bg-brand-600 text-white px-6 py-3 rounded-full font-semibold shadow-lg shadow-brand-500/30 hover:bg-brand-700 transition-all hover:scale-105"
                        >
                        Adicionar Primeiro Documento
                        </button>
                    )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in slide-in-from-bottom-8 duration-500">
                    {filteredDocuments.map((doc) => (
                        <DocCard 
                            key={doc.id} 
                            doc={doc} 
                            onClick={setSelectedDoc}
                            onToggleFavorite={toggleFavorite} 
                        />
                    ))}
                    </div>
                )}
            </div>
            )}
        </main>
        </div>
      )}
    </>
  );
};

export default App;