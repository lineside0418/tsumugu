// src/store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface EditorState {
  text: string;
  setText: (text: string) => void;
  
  mode: 'edit' | 'preview';
  setMode: (mode: 'edit' | 'preview') => void;
  
  isSettingsOpen: boolean;
  toggleSettings: () => void;
  
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  
  settings: {
    fontFamily: string;
    direction: 'horizontal' | 'vertical';
    fontSize: string;
    lineHeight: string;
    textColor: string;
    backgroundColor: string;
    editorFontSize: string;
  };
  updateSetting: <K extends keyof EditorState['settings']>(key: K, value: EditorState['settings'][K]) => void;
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set) => ({
      text: '',
      setText: (text) => set({ text }),
      
      mode: 'edit',
      setMode: (mode) => set({ mode }),
      
      isSettingsOpen: false,
      toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
      
      theme: 'light',
      toggleTheme: () => set((state) => {
        const newTheme = state.theme === 'light' ? 'dark' : 'light';
        let newBg = state.settings.backgroundColor;
        let newText = state.settings.textColor;

        if (newTheme === 'dark' && state.settings.backgroundColor === '#ffffff') {
          newBg = '#191919';
          newText = '#e5e5e5';
        } else if (newTheme === 'light' && state.settings.backgroundColor === '#191919') {
          newBg = '#ffffff';
          newText = '#1f2937';
        }

        return { 
          theme: newTheme,
          settings: { ...state.settings, backgroundColor: newBg, textColor: newText }
        };
      }),
      
      settings: {
        fontFamily: 'var(--font-zen-mincho)',
        direction: 'horizontal',
        fontSize: '1.125rem',
        lineHeight: '2.2',
        textColor: '#1f2937', 
        backgroundColor: '#ffffff',
        editorFontSize: '1.125rem',
      },
      updateSetting: (key, value) => 
        set((state) => ({
          settings: { ...state.settings, [key]: value }
        })),
    }),
    {
      name: 'novel-editor-storage',
    }
  )
);