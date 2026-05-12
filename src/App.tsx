// src/App.tsx
import React, { useEffect, useRef, useState } from 'react';
import { PenLine, Eye, Settings2, Download, Moon, Sun, CheckCircle2, X, Image as ImageIcon, Loader2, Bold, Italic, Minus, Copy, Check, Menu, FileDown, FileUp } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { toPng } from 'html-to-image';
import { useEditorStore } from './store';

import logoImg from './logo.png';

marked.setOptions({
  breaks: true,
  gfm: true,
});

function App() {
  const { 
    text: savedText, setText: setSavedText, 
    mode, setMode, 
    isSettingsOpen, toggleSettings, 
    theme, toggleTheme,
    settings, updateSetting 
  } = useEditorStore();
  
  const [localText, setLocalText] = useState(savedText);
  const [isSaving, setIsSaving] = useState(false);
  const [exportImage, setExportImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastExportHash, setLastExportHash] = useState<string | null>(null);
  
  const [twitterChunks, setTwitterChunks] = useState<string[] | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); // JSON読み込み用
  
  const historyRef = useRef<string[]>([savedText]);
  const historyStepRef = useRef<number>(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalText(savedText);
  }, [savedText]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    setIsSaving(true);
    const timer = setTimeout(() => {
      setSavedText(localText);
      setIsSaving(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, [localText, setSavedText]);

  const commitHistory = (newText: string) => {
    if (historyRef.current[historyStepRef.current] === newText) return;
    const newHistory = historyRef.current.slice(0, historyStepRef.current + 1);
    newHistory.push(newText);
    if (newHistory.length > 100) newHistory.shift(); 
    historyRef.current = newHistory;
    historyStepRef.current = newHistory.length - 1;
  };

  const updateTextWithHistory = (newText: string, immediate = false) => {
    setLocalText(newText);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (immediate) {
      commitHistory(newText);
    } else {
      typingTimeoutRef.current = setTimeout(() => {
        commitHistory(newText);
      }, 500);
    }
  };

  const undo = () => {
    if (historyStepRef.current > 0) {
      historyStepRef.current -= 1;
      setLocalText(historyRef.current[historyStepRef.current]);
    }
  };

  const redo = () => {
    if (historyStepRef.current < historyRef.current.length - 1) {
      historyStepRef.current += 1;
      setLocalText(historyRef.current[historyStepRef.current]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
      return;
    }

    const pairs: Record<string, string> = {
      '「': '」', '『': '』', '（': '）', '【': '】', '"': '"', "'": "'"
    };

    if (pairs[e.key]) {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const selected = localText.slice(start, end);

      if (selected) {
        const newText = localText.slice(0, start) + e.key + selected + pairs[e.key] + localText.slice(end);
        updateTextWithHistory(newText, true);
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = start + 1;
            textareaRef.current.selectionEnd = start + 1 + selected.length;
          }
        }, 0);
      } else {
        const newText = localText.slice(0, start) + e.key + pairs[e.key] + localText.slice(end);
        updateTextWithHistory(newText, true);
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 1;
          }
        }, 0);
      }
    }
  };

  const handleToolbarAction = (prefix: string, suffix: string = '', cursorOffset: number = 0) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const selected = localText.slice(start, end);

    let newText;
    if (selected && suffix) {
      newText = localText.slice(0, start) + prefix + selected + suffix + localText.slice(end);
      updateTextWithHistory(newText, true);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.selectionStart = start + prefix.length;
          textareaRef.current.selectionEnd = start + prefix.length + selected.length;
        }
      }, 0);
    } else {
      const insertStr = prefix + suffix;
      newText = localText.slice(0, start) + insertStr + localText.slice(end);
      updateTextWithHistory(newText, true);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + cursorOffset;
        }
      }, 0);
    }
  };

  const getParsedHtml = () => {
    const withRuby = localText.replace(/\|([^《]+)《([^》]+)》/g, '<ruby>$1<rt>$2</rt></ruby>');
    const rawHtml = marked.parse(withRuby) as string;
    return DOMPurify.sanitize(rawHtml);
  };

  const handleExportClick = async () => {
    setIsMobileMenuOpen(false); 
    const currentHash = localText + JSON.stringify(settings);
    if (exportImage && lastExportHash === currentHash) return; 

    setIsCapturing(true);
    const wasEditMode = mode === 'edit';
    if (wasEditMode) {
      setMode('preview');
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const element = document.getElementById('preview-canvas');
    if (element) {
      try {
        const dataUrl = await toPng(element, {
          backgroundColor: settings.backgroundColor,
          pixelRatio: 1.5, 
        });
        setExportImage(dataUrl);
        setLastExportHash(currentHash);
      } catch (error) {
        console.error("画像生成エラー:", error);
        alert("画像の生成に失敗しました。");
      }
    }
    setIsCapturing(false);
  };

  const downloadImage = () => {
    if (!exportImage) return;
    const link = document.createElement('a');
    link.href = exportImage;
    link.download = 'tsumugu_export.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const splitForX = () => {
    setIsMobileMenuOpen(false); 
    if (!localText.trim()) return;
    const MAX_LEN = 130; 
    const chunks: string[] = [];
    let current = "";
    
    const segments = localText.split(/(?<=[。\n])/); 
    
    for (const segment of segments) {
      if (current.length + segment.length <= MAX_LEN) {
        current += segment;
      } else {
        if (current.trim()) chunks.push(current.trim());
        current = "";
        if (segment.length > MAX_LEN) {
           let s = segment;
           while(s.length > MAX_LEN) {
              chunks.push(s.slice(0, MAX_LEN).trim());
              s = s.slice(MAX_LEN);
           }
           current = s;
        } else {
           current = segment;
        }
      }
    }
    if (current.trim()) chunks.push(current.trim());
    
    if (chunks.length > 1) {
      setTwitterChunks(chunks.map((c, i) => `${c}\n\n(${i + 1}/${chunks.length})`));
    } else {
      setTwitterChunks(chunks);
    }
  };

  const handleCopyChunk = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // ------------------------------------
  // プロジェクトの JSON 書き出し・読み込み処理
  // ------------------------------------
  const exportProjectJson = () => {
    const projectData = {
      version: 1,
      appName: 'Tsumugu',
      text: localText,
      settings: settings
    };
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tsumugu_project.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsMobileMenuOpen(false);
  };

  const importProjectJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.text !== undefined) {
          updateTextWithHistory(data.text, true);
        }
        if (data.settings) {
          // Object.keys を用いてすべての設定項目を復元
          (Object.keys(data.settings) as Array<keyof typeof settings>).forEach(key => {
            updateSetting(key, data.settings[key]);
          });
        }
        // 連続で同じファイルを読み込めるようにリセット
        if (fileInputRef.current) fileInputRef.current.value = '';
        setIsMobileMenuOpen(false);
        alert('プロジェクトを読み込みました！');
      } catch (err) {
        console.error(err);
        alert('ファイルの読み込みに失敗しました。対応していない形式です。');
      }
    };
    reader.readAsText(file);
  };

  const bgColors = ['#ffffff', '#fdfbf7', '#f3f4f6', '#191919', '#2d3748', '#0f172a'];
  const textColors = ['#1f2937', '#4b5563', '#9ca3af', '#e5e5e5', '#f8fafc'];
  const fontSizes = [{ label: '小', value: '1rem' }, { label: '中', value: '1.125rem' }, { label: '大', value: '1.25rem' }];

  return (
    // 【重要】fixed inset-0 で画面サイズにアプリを完全固定し、背景のバウンススクロールを無効化
    <div className="fixed inset-0 bg-[#fcfcfc] dark:bg-[#191919] text-gray-900 dark:text-[#e5e5e5] transition-colors duration-300 flex flex-col overscroll-none">
      
      {/* 隠し input (JSON読み込み用) */}
      <input type="file" accept=".json" ref={fileInputRef} onChange={importProjectJson} className="hidden" />

      {/* PC版ヘッダー */}
      <header className="hidden sm:flex h-16 px-6 items-center justify-between z-10 border-b border-gray-100 dark:border-neutral-800/50 bg-white/80 dark:bg-[#191919]/80 backdrop-blur-md shrink-0">
        <div className="flex items-center w-1/3">
          <div className="flex items-center space-x-2 bg-gray-100 dark:bg-neutral-800/80 px-2 py-1.5 rounded-lg border border-transparent hover:border-gray-200 dark:hover:border-neutral-700 transition-colors">
            <div className="w-7 h-7 rounded-md overflow-hidden shrink-0 shadow-sm border border-gray-200 dark:border-neutral-700">
              <img src={logoImg} alt="Tsumugu" className="w-full h-full object-cover" />
            </div>
            <input 
              type="text" 
              defaultValue="無題のプロジェクト" 
              className="text-sm font-display font-bold bg-transparent outline-none w-32 lg:w-48 truncate text-gray-800 dark:text-gray-200"
            />
            <div className="flex items-center justify-center shrink-0 pr-1">
              {isSaving ? (
                <Loader2 size={14} className="animate-spin text-gray-400" />
              ) : (
                <CheckCircle2 size={14} className="text-gray-400 dark:text-gray-500" />
              )}
            </div>
          </div>
        </div>

        <div className="absolute left-1/2 transform -translate-x-1/2 flex bg-gray-100 dark:bg-neutral-800/80 p-1 rounded-xl shadow-inner">
          <button 
            onClick={() => { setMode('edit'); setIsMobileMenuOpen(false); }}
            className={`flex items-center space-x-2 px-5 py-2 rounded-lg font-bold text-sm transition-all duration-200 ${mode === 'edit' && !isMobileMenuOpen ? 'bg-white dark:bg-[#252525] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            <PenLine size={16} strokeWidth={2.5} />
            <span>執筆</span>
          </button>
          <button 
            onClick={() => { setMode('preview'); setIsMobileMenuOpen(false); }}
            className={`flex items-center space-x-2 px-5 py-2 rounded-lg font-bold text-sm transition-all duration-200 ${mode === 'preview' && !isMobileMenuOpen ? 'bg-white dark:bg-[#252525] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            <Eye size={16} strokeWidth={2.5} />
            <span>プレビュー</span>
          </button>
        </div>

        <div className="flex items-center justify-end space-x-2 w-1/3">
          <button onClick={splitForX} className="w-10 h-10 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-xl transition-colors" title="X(Twitter)用に分割">
            <span className="font-display font-bold text-lg">𝕏</span>
          </button>
          <button 
            onClick={handleExportClick}
            disabled={isCapturing}
            className="w-10 h-10 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-xl transition-colors disabled:opacity-50" 
            title="画像化"
          >
            {isCapturing ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} strokeWidth={2} />}
          </button>
          <div className="w-px h-5 bg-gray-200 dark:bg-neutral-700 mx-1"></div>
          <button 
            onClick={toggleSettings}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${isSettingsOpen ? 'bg-gray-900 dark:bg-[#e5e5e5] text-white dark:text-gray-900' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800'}`} 
          >
            <Settings2 size={20} strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* スマホ版 フローティングトップバー */}
      <header className="sm:hidden absolute top-4 left-4 right-4 h-14 px-4 z-20 bg-white/95 dark:bg-[#252525]/95 backdrop-blur-md rounded-2xl shadow-md border border-gray-100 dark:border-neutral-800 flex items-center justify-between">
        <div className="flex items-center space-x-3 overflow-hidden flex-1">
          <div className="w-7 h-7 rounded-md overflow-hidden shrink-0 shadow-sm border border-gray-200 dark:border-neutral-700">
            <img src={logoImg} alt="Tsumugu" className="w-full h-full object-cover" />
          </div>
          <input 
            type="text" 
            defaultValue="無題のプロジェクト" 
            className="text-sm font-display font-bold bg-transparent outline-none w-full truncate text-gray-800 dark:text-gray-200"
          />
        </div>
        <div className="flex items-center justify-center shrink-0 pl-2">
          {isSaving ? (
            <Loader2 size={16} className="animate-spin text-gray-400" />
          ) : (
            <CheckCircle2 size={16} className="text-gray-400 dark:text-gray-500" />
          )}
        </div>
      </header>

      {/* メインワークスペース（ここをflex-1 min-h-0にすることで背景スクロールを防止） */}
      <main className="flex-1 relative flex flex-col min-h-0 pt-20 sm:pt-0 pb-16 sm:pb-0">
        
        {/* スマホメニュータブ */}
        {isMobileMenuOpen ? (
          <div className="sm:hidden flex-1 overflow-y-auto px-4 space-y-8 pb-10 animate-in fade-in duration-200">
            <h2 className="font-display font-bold text-2xl dark:text-white px-2 pt-2">メニュー</h2>
            
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">アクション</h3>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={handleExportClick} className="flex flex-col items-center justify-center space-y-2 bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-gray-100 dark:border-neutral-800 active:scale-95 transition-transform shadow-sm">
                  <Download size={24} className="text-gray-700 dark:text-gray-300" />
                  <span className="text-sm font-bold dark:text-gray-200">画像化</span>
                </button>
                <button onClick={splitForX} className="flex flex-col items-center justify-center space-y-2 bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-gray-100 dark:border-neutral-800 active:scale-95 transition-transform shadow-sm">
                  <span className="font-display font-bold text-2xl leading-none text-gray-700 dark:text-gray-300">𝕏</span>
                  <span className="text-sm font-bold dark:text-gray-200">用に分割</span>
                </button>
                <button onClick={exportProjectJson} className="flex flex-col items-center justify-center space-y-2 bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-gray-100 dark:border-neutral-800 active:scale-95 transition-transform shadow-sm">
                  <FileDown size={24} className="text-gray-700 dark:text-gray-300" />
                  <span className="text-sm font-bold dark:text-gray-200">保存 (JSON)</span>
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center space-y-2 bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-gray-100 dark:border-neutral-800 active:scale-95 transition-transform shadow-sm">
                  <FileUp size={24} className="text-gray-700 dark:text-gray-300" />
                  <span className="text-sm font-bold dark:text-gray-200">読込 (JSON)</span>
                </button>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">アプリのテーマ</h3>
              <div className="flex p-1 bg-gray-100 dark:bg-neutral-800/80 rounded-xl">
                <button onClick={() => theme === 'dark' && toggleTheme()} className={`flex-1 flex items-center justify-center space-x-2 text-sm py-3 rounded-lg font-bold transition-all ${theme === 'light' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}><Sun size={18} strokeWidth={2.5} /><span>Light</span></button>
                <button onClick={() => theme === 'light' && toggleTheme()} className={`flex-1 flex items-center justify-center space-x-2 text-sm py-3 rounded-lg font-bold transition-all ${theme === 'dark' ? 'bg-[#252525] text-white shadow-sm' : 'text-gray-500'}`}><Moon size={18} strokeWidth={2.5} /><span>Dark</span></button>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">エディタ設定</h3>
              <div className="space-y-4 bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold dark:text-gray-300">文字の大きさ</span>
                  <div className="flex space-x-2">
                    {fontSizes.map(fs => (
                      <button key={fs.value} onClick={() => updateSetting('editorFontSize', fs.value)} className={`px-4 py-2 text-xs font-bold rounded-lg ${settings.editorFontSize === fs.value ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-gray-400'}`}>{fs.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">画像出力・プレビュー設定</h3>
              <div className="space-y-5 bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm">
                <select value={settings.fontFamily} onChange={(e) => updateSetting('fontFamily', e.target.value)} className="w-full text-sm font-bold bg-gray-50 dark:bg-[#1a1a1a] dark:text-[#e5e5e5] border border-gray-200 dark:border-neutral-700 rounded-xl p-4 outline-none cursor-pointer">
                  <option value="var(--font-zen-kaku)">Zen Kaku Gothic New (角ゴシック)</option>
                  <option value="var(--font-zen-maru)">Zen Maru Gothic New (丸ゴシック)</option>
                  <option value="var(--font-zen-mincho)">Zen Old Mincho (明朝)</option>
                  <option value="var(--font-zen-kurenaido)">Zen Kurenaido (手書き)</option>
                </select>
                <div className="flex p-1 bg-gray-100 dark:bg-neutral-800/80 rounded-xl">
                 <button onClick={() => updateSetting('direction', 'horizontal')} className={`flex-1 text-sm py-3 rounded-lg font-bold transition-all ${settings.direction === 'horizontal' ? 'bg-white dark:bg-[#252525] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}>横書き</button>
                 <button onClick={() => updateSetting('direction', 'vertical')} className={`flex-1 text-sm py-3 rounded-lg font-bold transition-all ${settings.direction === 'vertical' ? 'bg-white dark:bg-[#252525] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}>縦書き</button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold dark:text-gray-300">文字の大きさ</span>
                  <div className="flex space-x-2">
                    {fontSizes.map(fs => (
                      <button key={fs.value} onClick={() => updateSetting('fontSize', fs.value)} className={`px-4 py-2 text-xs font-bold rounded-lg ${settings.fontSize === fs.value ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-gray-400'}`}>{fs.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-500 block mb-2">背景色</span>
                  <div className="flex flex-wrap gap-4">
                    {bgColors.map(color => (
                      <button key={color} onClick={() => updateSetting('backgroundColor', color)} className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${settings.backgroundColor === color ? 'border-gray-900 dark:border-white scale-110 shadow-md' : 'border-gray-200 dark:border-neutral-700'}`} style={{ backgroundColor: color }} />
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-500 block mb-2">文字色</span>
                  <div className="flex flex-wrap gap-4">
                    {textColors.map(color => (
                      <button key={color} onClick={() => updateSetting('textColor', color)} className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${settings.textColor === color ? 'border-gray-900 dark:border-white scale-110 shadow-md' : 'border-gray-200 dark:border-neutral-700'}`} style={{ backgroundColor: color }} />
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : mode === 'edit' ? (
          <div className="flex-1 flex flex-col p-2 sm:p-12 relative min-h-0 animate-in fade-in duration-200 max-w-4xl mx-auto w-full">
            <div className="flex-1 flex flex-col bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-sm border border-gray-200 dark:border-neutral-800 overflow-hidden relative min-h-0">
              {/* テキストエリア単体でスクロールさせることで背景を完全固定 */}
              <textarea 
                ref={textareaRef}
                value={localText}
                onChange={(e) => updateTextWithHistory(e.target.value, false)}
                onKeyDown={handleKeyDown}
                style={{ 
                  fontSize: settings.editorFontSize, 
                  lineHeight: '2.2em',
                }}
                // 上マージンをかなり小さく（pt-4）変更。下マージンはボトムナビと被らないように大きめ（pb-32）に
                className="flex-1 w-full resize-none outline-none bg-transparent text-gray-800 dark:text-[#e5e5e5] px-4 pt-4 pb-32 sm:px-14 sm:py-16 placeholder-gray-300 dark:placeholder-neutral-600 overflow-y-auto overscroll-none"
                placeholder="物語を始めましょう...&#13;&#10;(例: |漢字《かんじ》 でルビになります)"
                autoFocus
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-12 flex justify-center items-start animate-in fade-in duration-200 overscroll-none">
            <div 
              id="preview-canvas"
              className="p-8 sm:p-16 shadow-lg transition-colors duration-300 ease-in-out bg-white dark:bg-[#191919] mb-20 sm:mb-0"
              style={{
                fontFamily: settings.fontFamily,
                fontSize: settings.fontSize,
                lineHeight: settings.lineHeight,
                color: settings.textColor,
                backgroundColor: settings.backgroundColor,
                writingMode: settings.direction === 'vertical' ? 'vertical-rl' : 'horizontal-tb',
                minHeight: '60vh',
                width: settings.direction === 'vertical' ? 'auto' : '100%',
                maxWidth: settings.direction === 'vertical' ? 'none' : '48rem',
              }}
            >
              <div 
                className={`prose prose-sm sm:prose-lg max-w-none ${settings.direction === 'vertical' ? '' : 'prose-p:my-4'} prose-headings:font-display prose-headings:font-bold prose-hr:border-gray-300 dark:prose-hr:border-neutral-700 prose-strong:text-[inherit] prose-strong:font-bold`}
                style={{ writingMode: 'inherit', color: 'inherit' }}
                dangerouslySetInnerHTML={{ __html: getParsedHtml() || '<p style="opacity: 0.5;">テキストがありません</p>' }} 
              />
            </div>
          </div>
        )}
      </main>

      {/* フローティングツールバー (PCのみ表示) */}
      {!isMobileMenuOpen && mode === 'edit' && (
        <div className="hidden sm:flex absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-white/95 dark:bg-neutral-800/95 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-200 dark:border-neutral-700 rounded-full px-4 py-2 items-center space-x-2 z-20">
          <button onClick={() => handleToolbarAction('「', '」', 1)} className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-full transition-colors font-bold text-sm">「」</button>
          <button onClick={() => handleToolbarAction('（', '）', 1)} className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-full transition-colors font-bold text-sm">（）</button>
          <div className="w-px h-5 bg-gray-200 dark:bg-neutral-600 mx-1"></div>
          <button onClick={() => handleToolbarAction('……', '', 2)} className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-full transition-colors font-bold tracking-widest text-xs">……</button>
          <button onClick={() => handleToolbarAction('**', '**', 2)} className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-full transition-colors"><Bold size={16} strokeWidth={2.5} /></button>
          <button onClick={() => handleToolbarAction('*', '*', 1)} className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-full transition-colors"><Italic size={16} strokeWidth={2.5} /></button>
          <div className="w-px h-5 bg-gray-200 dark:bg-neutral-600 mx-1"></div>
          <button onClick={() => handleToolbarAction('\n---\n', '', 5)} className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-full transition-colors"><Minus size={18} strokeWidth={2.5} /></button>
        </div>
      )}

      {/* スマホ専用 ボトムナビゲーション */}
      <nav className="sm:hidden absolute bottom-0 left-0 w-full h-16 bg-white/95 dark:bg-[#191919]/95 backdrop-blur-md border-t border-gray-200 dark:border-neutral-800 z-50 flex items-center justify-around px-2 pb-safe">
        <button onClick={() => { setMode('edit'); setIsMobileMenuOpen(false); }} className={`flex flex-col items-center justify-center w-[30%] h-full space-y-1 ${!isMobileMenuOpen && mode === 'edit' ? 'text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
          <PenLine size={20} strokeWidth={!isMobileMenuOpen && mode === 'edit' ? 2.5 : 2} />
          <span className="text-[10px] font-bold">執筆</span>
        </button>
        <button onClick={() => { setMode('preview'); setIsMobileMenuOpen(false); }} className={`flex flex-col items-center justify-center w-[30%] h-full space-y-1 ${!isMobileMenuOpen && mode === 'preview' ? 'text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
          <Eye size={20} strokeWidth={!isMobileMenuOpen && mode === 'preview' ? 2.5 : 2} />
          <span className="text-[10px] font-bold">プレビュー</span>
        </button>
        <button onClick={() => setIsMobileMenuOpen(true)} className={`flex flex-col items-center justify-center w-[30%] h-full space-y-1 ${isMobileMenuOpen ? 'text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
          <Menu size={20} strokeWidth={isMobileMenuOpen ? 2.5 : 2} />
          <span className="text-[10px] font-bold">メニュー</span>
        </button>
      </nav>

      {/* PC用 設定パネルバックグラウンド */}
      {isSettingsOpen && !isMobileMenuOpen && (
        <div className="hidden sm:block fixed inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm z-40 transition-opacity" onClick={toggleSettings} />
      )}

      {/* PC用 右サイド設定パネル */}
      <aside className={`hidden sm:block fixed top-0 right-0 h-full w-96 bg-white dark:bg-[#1e1e1e] border-l border-gray-100 dark:border-neutral-800 shadow-2xl z-50 transform transition-transform duration-300 overflow-y-auto ${isSettingsOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-display font-bold text-xl dark:text-white">設定</h2>
            <button onClick={toggleSettings} className="text-gray-400 hover:text-gray-900 dark:hover:text-white p-2 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>
          <div className="space-y-8">
            {/* プロジェクト管理 (PC用 JSONエクスポート・インポート) */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">プロジェクトの管理</label>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={exportProjectJson} className="flex items-center justify-center space-x-2 bg-gray-50 dark:bg-[#252525] hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors p-3 rounded-xl border border-gray-200 dark:border-neutral-700">
                  <FileDown size={18} className="text-gray-700 dark:text-gray-300" />
                  <span className="text-sm font-bold dark:text-gray-300">書き出し</span>
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center space-x-2 bg-gray-50 dark:bg-[#252525] hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors p-3 rounded-xl border border-gray-200 dark:border-neutral-700">
                  <FileUp size={18} className="text-gray-700 dark:text-gray-300" />
                  <span className="text-sm font-bold dark:text-gray-300">読み込み</span>
                </button>
              </div>
            </div>
            
            <hr className="border-gray-100 dark:border-neutral-800" />

            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">アプリのテーマ</label>
              <div className="flex p-1 bg-gray-100 dark:bg-neutral-800/80 rounded-xl">
                <button onClick={() => theme === 'dark' && toggleTheme()} className={`flex-1 flex items-center justify-center space-x-2 text-sm py-2 rounded-lg font-bold transition-all ${theme === 'light' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}><Sun size={16} strokeWidth={2.5} /><span>Light</span></button>
                <button onClick={() => theme === 'light' && toggleTheme()} className={`flex-1 flex items-center justify-center space-x-2 text-sm py-2 rounded-lg font-bold transition-all ${theme === 'dark' ? 'bg-[#252525] text-white shadow-sm' : 'text-gray-500'}`}><Moon size={16} strokeWidth={2.5} /><span>Dark</span></button>
              </div>
            </div>
            <hr className="border-gray-100 dark:border-neutral-800" />
            
            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">エディタ設定</label>
              <div className="space-y-4 bg-gray-50 dark:bg-[#252525] p-4 rounded-xl border border-gray-200 dark:border-neutral-700">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold dark:text-gray-300">文字の大きさ</span>
                  <div className="flex space-x-2">
                    {fontSizes.map(fs => (
                      <button key={fs.value} onClick={() => updateSetting('editorFontSize', fs.value)} className={`px-3 py-1 text-xs font-bold rounded-md ${settings.editorFontSize === fs.value ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-200 text-gray-600 dark:bg-neutral-700 dark:text-gray-400'}`}>{fs.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">画像出力・プレビュー設定</label>
              <div className="space-y-4">
                <select value={settings.fontFamily} onChange={(e) => updateSetting('fontFamily', e.target.value)} className="w-full text-sm font-bold bg-gray-50 dark:bg-[#252525] dark:text-[#e5e5e5] border border-gray-200 dark:border-neutral-700 rounded-xl p-3 outline-none cursor-pointer">
                  <option value="var(--font-zen-kaku)">Zen Kaku Gothic New (角ゴシック)</option>
                  <option value="var(--font-zen-maru)">Zen Maru Gothic New (丸ゴシック)</option>
                  <option value="var(--font-zen-mincho)">Zen Old Mincho (明朝)</option>
                  <option value="var(--font-zen-kurenaido)">Zen Kurenaido (手書き)</option>
                </select>
                <div className="flex p-1 bg-gray-100 dark:bg-neutral-800/80 rounded-xl">
                 <button onClick={() => updateSetting('direction', 'horizontal')} className={`flex-1 text-sm py-2 rounded-lg font-bold transition-all ${settings.direction === 'horizontal' ? 'bg-white dark:bg-[#252525] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}>横書き</button>
                 <button onClick={() => updateSetting('direction', 'vertical')} className={`flex-1 text-sm py-2 rounded-lg font-bold transition-all ${settings.direction === 'vertical' ? 'bg-white dark:bg-[#252525] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}>縦書き</button>
                </div>
                <div className="flex items-center justify-between bg-gray-50 dark:bg-[#252525] p-3 rounded-xl border border-gray-200 dark:border-neutral-700">
                  <span className="text-sm font-bold dark:text-gray-300">文字の大きさ</span>
                  <div className="flex space-x-2">
                    {fontSizes.map(fs => (
                      <button key={fs.value} onClick={() => updateSetting('fontSize', fs.value)} className={`px-3 py-1 text-xs font-bold rounded-md ${settings.fontSize === fs.value ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-200 text-gray-600 dark:bg-neutral-700 dark:text-gray-400'}`}>{fs.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-500 block mb-2">背景色</span>
                  <div className="flex flex-wrap gap-3">
                    {bgColors.map(color => (
                      <button key={color} onClick={() => updateSetting('backgroundColor', color)} className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${settings.backgroundColor === color ? 'border-gray-900 dark:border-white scale-110 shadow-md' : 'border-gray-300 dark:border-neutral-700'}`} style={{ backgroundColor: color }} />
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-500 block mb-2">文字色</span>
                  <div className="flex flex-wrap gap-3">
                    {textColors.map(color => (
                      <button key={color} onClick={() => updateSetting('textColor', color)} className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${settings.textColor === color ? 'border-gray-900 dark:border-white scale-110 shadow-md' : 'border-gray-300 dark:border-neutral-700'}`} style={{ backgroundColor: color }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* 画像エクスポート モーダル */}
      {exportImage && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-100 dark:border-neutral-800">
              <h3 className="font-display font-bold text-lg text-gray-900 dark:text-white">画像の書き出し</h3>
              <button onClick={() => setExportImage(null)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white p-2 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>
            <div className="p-4 sm:p-6 bg-gray-50/50 dark:bg-[#111] flex-1 overflow-y-auto flex justify-center items-center">
              <img src={exportImage} alt="エクスポートプレビュー" className="max-h-full max-w-full rounded-lg shadow-sm border border-gray-200 dark:border-neutral-800 object-contain" />
            </div>
            <div className="p-4 md:p-6 border-t border-gray-100 dark:border-neutral-800 bg-white dark:bg-[#1a1a1a] flex flex-col sm:flex-row gap-3">
              <button onClick={downloadImage} className="flex-1 flex items-center justify-center space-x-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-3.5 px-4 rounded-xl font-bold hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shadow-sm">
                <ImageIcon size={18} strokeWidth={2.5} />
                <span>画像を保存</span>
              </button>
              <button onClick={() => { setExportImage(null); splitForX(); }} className="flex-1 flex items-center justify-center space-x-2 bg-black text-white dark:bg-[#252525] dark:text-[#e5e5e5] py-3.5 px-4 rounded-xl font-bold hover:bg-gray-800 dark:hover:bg-neutral-700 transition-colors shadow-sm">
                <span className="font-display text-lg">𝕏</span>
                <span>用に文字を分割する</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 𝕏(Twitter) 分割モーダル */}
      {twitterChunks && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-100 dark:border-neutral-800">
              <div className="flex items-center space-x-2">
                <span className="font-display font-bold text-xl text-gray-900 dark:text-white">𝕏</span>
                <h3 className="font-display font-bold text-sm text-gray-500 dark:text-gray-400">用にテキストを分割</h3>
              </div>
              <button onClick={() => setTwitterChunks(null)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white p-2 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 bg-gray-50/50 dark:bg-[#111] flex-1 overflow-y-auto space-y-4">
              {twitterChunks.length === 0 && (
                <p className="text-center text-gray-400 py-10">テキストがありません</p>
              )}
              {twitterChunks.map((chunk, idx) => (
                <div key={idx} className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-neutral-800 rounded-xl p-4 shadow-sm relative group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-gray-400 bg-gray-100 dark:bg-neutral-800 px-2 py-1 rounded-md">
                      ポスト {idx + 1}
                    </span>
                    <button 
                      onClick={() => handleCopyChunk(chunk, idx)}
                      className="flex items-center space-x-1 text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-neutral-800"
                    >
                      {copiedIndex === idx ? (
                        <><Check size={14} className="text-green-500"/> <span className="text-green-500">コピー完了</span></>
                      ) : (
                        <><Copy size={14} /> <span>コピー</span></>
                      )}
                    </button>
                  </div>
                  <p className="text-sm text-gray-800 dark:text-[#e5e5e5] whitespace-pre-wrap leading-relaxed">
                    {chunk}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;