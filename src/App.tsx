import React, { useState, useEffect, useRef } from 'react';

// 【升級 1：安全性】改用環境變數讀取 API Key，避免在 GitHub 或前端外洩
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

// --- SVG 圖示 (維持原樣) ---
const Icons = {
  Mic: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  ),
  Stop: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  ),
  Camera: () => ( 
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  ),
  Languages: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 8 6 6" />
      <path d="m4 14 6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="m22 22-5-10-5 10" />
      <path d="M14 18h6" />
    </svg>
  ),
  Volume: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  ),
  Loader: () => (
    <svg
      className="animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  ),
};

const App = () => {
  const [mode, setMode] = useState('voice');
  const [isListening, setIsListening] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [status, setStatus] = useState('ready');

  const [recognizedText, setRecognizedText] = useState('');
  const [results, setResults] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [base64Image, setBase64Image] = useState(null);
  const [imageMimeType, setImageMimeType] = useState(null); // 新增：記錄圖片真實格式

  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ja-JP';
      recognition.interimResults = true;
      recognition.continuous = true;

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        setRecognizedText(finalTranscript || interimTranscript);
      };

      recognition.onerror = (e) => {
        console.error('語音辨識錯誤:', e.error);
        setIsListening(false);
        setStatus('error');
      };

      recognitionRef.current = recognition;
    } else {
      console.warn('此瀏覽器不支援語音辨識功能');
    }
  }, []);

  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setStatus('ready');
    } else {
      setResults([]);
      setRecognizedText('');
      setStatus('listening');
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        setStatus('error');
      }
    }
  };

  const startTranslation = async (textToTranslate) => {
    const target = textToTranslate || recognizedText;
    if (!target && !base64Image) return;

    if (!apiKey) {
      alert('請確認環境變數 VITE_GEMINI_API_KEY 已設定！');
      return;
    }

    setIsTranslating(true);
    setStatus('translating');

    try {
      const prompt =
        mode === 'image'
          ? '這是一張在日本拍攝的照片，請辨識其中的日文並翻譯。輸出 JSON 陣列，欄位需完全符合：japanese, reading, chinese, analysis (文化解析或用法提示)。不要輸出任何 Markdown 標記或其他文字。'
          : `請翻譯這段日文：${target}。並提供讀音與深層背景解析。輸出 JSON 陣列，欄位需完全符合：japanese, reading, chinese, analysis。不要輸出任何 Markdown 標記或其他文字。`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  // 動態帶入真實的圖片 MimeType，避免 JPEG 被當成 PNG 導致 API 報錯
                  ...(mode === 'image' && base64Image
                    ? [
                        {
                          inlineData: {
                            mimeType: imageMimeType,
                            data: base64Image,
                          },
                        },
                      ]
                    : []),
                ],
              },
            ],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      );

      const data = await response.json();
      const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (resultText) {
        // 【升級 2：防呆解析】過濾掉 AI 有時會多給的 ```json 標記，避免 JSON.parse 崩潰
        const cleanJsonText = resultText
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim();
        setResults(JSON.parse(cleanJsonText));
        setStatus('ready');
      }
    } catch (e) {
      console.error('翻譯 API 錯誤:', e);
      setStatus('error');
    } finally {
      setIsTranslating(false);
    }
  };

  // 【升級 3：極速發音】改用瀏覽器內建 TTS，零延遲且省下 API 呼叫時間
  const speak = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      utterance.rate = 0.9; // 稍微放慢語速，聽得更清楚
      window.speechSynthesis.speak(utterance);
    } else {
      alert('您的瀏覽器不支援語音播放功能');
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageMimeType(file.type || 'image/jpeg'); // 記錄真實格式
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result);
        setBase64Image(reader.result.split(',')[1]);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      <nav className="bg-indigo-600 text-white p-5 shadow-lg sticky top-0 z-50 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="bg-white/20 p-2 rounded-xl">
            <Icons.Languages />
          </div>
          <span className="text-xl font-bold tracking-tight">
            JAPAN GO! 隨身譯
          </span>
        </div>
        <div className="flex gap-1 bg-indigo-800 p-1 rounded-xl">
          <button
            onClick={() => setMode('voice')}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
              mode === 'voice'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-indigo-300'
            }`}
          >
            聽講
          </button>
          <button
            onClick={() => setMode('image')}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
              mode === 'image'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-indigo-300'
            }`}
          >
            拍照
          </button>
        </div>
      </nav>

      <main className="max-w-xl mx-auto p-4 space-y-6">
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200">
          {mode === 'voice' ? (
            <div className="flex flex-col items-center gap-8">
              <div className="relative">
                {isListening && (
                  <div className="absolute inset-0 animate-ping bg-red-400 rounded-full opacity-25"></div>
                )}
                <button
                  onClick={toggleVoice}
                  className={`w-28 h-28 rounded-full flex items-center justify-center shadow-2xl transition-all z-10 relative ${
                    isListening
                      ? 'bg-red-500 text-white'
                      : 'bg-indigo-600 text-white hover:scale-105'
                  }`}
                >
                  {isListening ? <Icons.Stop /> : <Icons.Mic />}
                </button>
              </div>

              <div className="text-center space-y-3 w-full">
                <div className="h-20 flex flex-col justify-center">
                  <p
                    className={`text-xl font-black ${
                      isListening ? 'text-red-500' : 'text-slate-700'
                    }`}
                  >
                    {status === 'listening'
                      ? '請對著手機講日文...'
                      : status === 'translating'
                      ? '正在分析並翻譯...'
                      : '準備好了'}
                  </p>
                  <p className="text-sm text-slate-400 mt-2 px-6 italic min-h-[1.5rem]">
                    {recognizedText || '可以聽店員介紹、廣播或路人說話'}
                  </p>
                </div>

                {recognizedText && !isListening && (
                  <button
                    onClick={() => startTranslation()}
                    disabled={isTranslating}
                    className="w-full mt-4 py-4 bg-emerald-500 text-white rounded-2xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                  >
                    {isTranslating ? <Icons.Loader /> : '辨識成功！立即翻譯'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-indigo-100 rounded-[2rem] cursor-pointer hover:bg-indigo-50/30 transition-all overflow-hidden relative">
                {selectedImage ? (
                  <img
                    src={selectedImage}
                    className="w-full h-full object-contain p-2"
                    alt="Preview"
                  />
                ) : (
                  <div className="text-center p-6 text-slate-400">
                    <div className="mx-auto w-16 h-16 mb-4 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center">
                      <Icons.Camera />
                    </div>
                    <p className="font-bold text-slate-700">拍照或上傳圖片</p>
                    <p className="text-xs">招牌、包裝或地圖文字</p>
                  </div>
                )}
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                />
              </label>
              {selectedImage && (
                <button
                  onClick={() => startTranslation()}
                  disabled={isTranslating}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2"
                >
                  {isTranslating ? <Icons.Loader /> : '開始圖片辨識翻譯'}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {results.length > 0 && (
            <h2 className="text-sm font-bold text-slate-400 px-4 uppercase tracking-widest">
              翻譯結果
            </h2>
          )}
          {results.map((r, i) => (
            <div
              key={i}
              className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-3 duration-500"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-slate-800">
                    {r.chinese}
                  </h3>
                  <p className="text-sm text-slate-400 font-medium">
                    {r.japanese}{' '}
                    <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                      [{r.reading}]
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => speak(r.japanese)}
                  className="p-3 bg-indigo-50 text-indigo-500 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all"
                >
                  <Icons.Volume />
                </button>
              </div>
              <div className="bg-indigo-50/50 p-4 rounded-2xl text-sm text-slate-600 leading-relaxed border border-indigo-100/30">
                <p className="font-bold text-indigo-400 text-[10px] mb-1 uppercase tracking-tighter">
                  文化/用法解析
                </p>
                {r.analysis}
              </div>
            </div>
          ))}

          {status === 'error' && (
            <div className="p-6 bg-red-50 text-red-500 rounded-[2rem] text-center font-bold border border-red-100">
              發生錯誤，請檢查網路連線或稍後再試。
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
