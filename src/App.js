import React, { useState, useRef, useEffect } from 'react';
import { Send, Terminal, Square, Cloud, HardDrive } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Groq from "groq-sdk";

function App() {
  const [input, setInput] = useState('');
  const [chat, setChat] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  
  // Converte a string do ENV para booleano real
  const isCloudMode = process.env.REACT_APP_USE_CLOUD === 'true';

  const scrollRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Inicializa o Groq com a flag para rodar no navegador
  const groq = new Groq({ 
    apiKey: process.env.REACT_APP_GROQ_API_KEY || '',
    dangerouslyAllowBrowser: true 
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chat]);

  const stopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    setError(null);
    abortControllerRef.current = new AbortController();
    
    const userMessage = { role: 'user', content: input };
    
    // CRÍTICO: Preparamos o que vai para a IA ANTES de atualizar a tela com placeholders
    // O Groq dá erro 400 se enviarmos mensagens com conteúdo vazio.
    const messagesToPayload = [...chat, userMessage]
      .filter(m => m.content && m.content.trim() !== '')
      .map(m => ({ role: m.role, content: m.content }));

    // Atualiza a interface (aqui o placeholder vazio é permitido para o React)
    setChat(prev => [...prev, userMessage, { role: 'assistant', content: '' }]);
    setInput('');
    setIsStreaming(true);

    try {
      if (isCloudMode) {
  // 1. Garantimos que o payload seja um array puro de objetos role/content
  const cleanMessages = messagesToPayload.map(m => ({
    role: m.role,
    content: m.content
  }));

  const stream = await groq.chat.completions.create({
    messages: cleanMessages,
    model: "llama-3.3-70b-versatile", // Use este modelo (é o mais atual e estável)
    temperature: 0.7,               // Adicionar parâmetros ajuda a validar o request
    max_tokens: 1024,
    stream: true,
  });

  let fullText = "";
  for await (const chunk of stream) {
    // Opcional: console.log(chunk) aqui ajuda a ver o que está vindo
    const content = chunk.choices[0]?.delta?.content || "";
    if (content) {
      fullText += content;
      setChat(prev => {
        const newChat = [...prev];
        newChat[newChat.length - 1] = { role: 'assistant', content: fullText };
        return newChat;
      });
    }
  }
} else {
        // MODO LOCAL: Ollama Fetch
        const response = await fetch(`${process.env.REACT_APP_OLLAMA_URL || 'http://localhost:11434'}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortControllerRef.current.signal,
          body: JSON.stringify({
            model: model,
            messages: messagesToPayload,
            stream: true
          }),
        });

        if (!response.ok) throw new Error(`Ollama Offline: ${response.status}`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
 
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const json = JSON.parse(line);
              if (json.message?.content) {
                fullText += json.message.content;
                setChat(prev => {
                  const newChat = [...prev];
                  newChat[newChat.length - 1] = { role: 'assistant', content: fullText };
                  return newChat;
                });
              }
            } catch (e) {}
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log("Stream parado.");
      } else {
        setError(isCloudMode ? "Erro na Nuvem (Verifique sua chave)" : "Ollama desconectado.");
        setIsStreaming(false);
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0d1117', color: '#c9d1d9', fontFamily: 'sans-serif' }}>
      
      {/* HEADER */}
      <header style={{ padding: '15px 30px', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#161b22' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Terminal size={24} color="#58a6ff" />
          <h1 style={{ fontSize: '1.1rem', margin: 0 }}>Chaos to Code Lab</h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: isCloudMode ? '#a371f7' : '#3fb950' }}>
            {isCloudMode ? <Cloud size={16} /> : <HardDrive size={16} />}
            {isCloudMode ? 'LinkedIn Mode (Groq)' : 'Local Mode (Ollama)'}
          </div>
        </div>
      </header>

      {/* CHAT AREA */}
      <main ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '30px 15%' }}>
        {chat.map((msg, i) => (
          <div key={i} style={{ marginBottom: '20px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
            <div style={{ 
              display: 'inline-block', 
              padding: '12px 18px', 
              borderRadius: '12px', 
              backgroundColor: msg.role === 'user' ? '#1f6feb' : '#161b22',
              border: '1px solid #30363d',
              maxWidth: '85%',
              textAlign: 'left'
            }}>
              <ReactMarkdown 
                children={msg.content}
                components={{
                  code({node, inline, className, children, ...props}) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <SyntaxHighlighter children={String(children).replace(/\n$/, '')} style={vscDarkPlus} language={match[1]} PreTag="div" {...props} />
                    ) : (
                      <code className={className} {...props}>{children}</code>
                    )
                  }
                }}
              />
            </div>
          </div>
        ))}
      </main>

      {/* FOOTER */}
      <footer style={{ padding: '20px 15%', backgroundColor: '#0d1117' }}>
        {error && <div style={{ color: '#ff7b72', fontSize: '0.8rem', marginBottom: '8px' }}>⚠️ {error}</div>}
        <div style={{ display: 'flex', gap: '12px', backgroundColor: '#161b22', padding: '10px', borderRadius: '10px', border: '1px solid #30363d' }}>
          <input 
            value={input} 
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={isCloudMode ? "Pergunte algo ao Llama 3..." : "Aguardando comando local..."}
            style={{ flex: 1, backgroundColor: 'transparent', border: 'none', color: '#fff', outline: 'none' }}
          />
          {isStreaming ? (
            <button onClick={stopStreaming} style={{ backgroundColor: '#da3633', border: 'none', borderRadius: '8px', padding: '10px 15px', cursor: 'pointer' }}>
              <Square size={16} fill="white" color="white" />
            </button>
          ) : (
            <button onClick={sendMessage} disabled={!input.trim()} style={{ backgroundColor: !input.trim() ? '#21262d' : '#238636', border: 'none', borderRadius: '8px', padding: '10px 15px', color: 'white', cursor: 'pointer' }}>
              <Send size={18} />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

export default App;