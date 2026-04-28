import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Terminal, Cpu } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

function App() {
  const [input, setInput] = useState('');
  const [chat, setChat] = useState([]);
  const [model, setModel] = useState('qwen2.5-coder:32b');
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  // Scroll automático para a última mensagem
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat]);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;
    
    const userMessage = { role: 'user', content: input };
    const assistantPlaceholder = { role: 'assistant', content: '' };
    
    const updatedChat = [...chat, userMessage];
    setChat([...updatedChat, assistantPlaceholder]);
    setInput('');
    setIsStreaming(true);

    try {
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          model: model, 
          messages: updatedChat, 
          stream: true 
        }),
      });

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
                newChat[newChat.length - 1].content = fullText;
                return newChat;
              });
            }
          } catch (e) { /* Erro parcial de JSON ignore */ }
        }
      }
    } catch (error) {
      setChat(prev => [...prev, { role: 'assistant', content: 'Erro de conexão. Verifique o terminal do Ollama.' }]);
    } finally {
      setIsStreaming(false);
    }


  };

  

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0d1117', color: '#c9d1d9', fontFamily: 'Inter, sans-serif' }}>
      
      {/* HEADER PROFISSIONAL */}
      <header style={{ padding: '15px 25px', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#161b22' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Terminal color="#58a6ff" />
          <h1 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 'bold' }}>Chaos to Code <span style={{ color: '#8b949e', fontWeight: 'normal' }}>| Dashboard IA</span></h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Cpu size={18} color={isStreaming ? '#f0883e' : '#3fb950'} />
          <select 
            value={model} 
            onChange={(e) => setModel(e.target.value)} 
            style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: '#0d1117', color: '#c9d1d9', border: '1px solid #30363d', outline: 'none' }}
          >
            <option value="qwen2.5-coder:32b">Qwen 32B (Expert)</option>
            <option value="deepseek-coder-v2:16b">DeepSeek 16B</option>
            <option value="mistral-nemo">Mistral Nemo</option>
            <option value="phi3.5">Phi-3.5 (Fast)</option>
          </select>
        </div>
      </header>

      {/* ÁREA DE CHAT COM MARKDOWN E SYNTAX HIGHLIGHT */}
      <main ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 10% 20px 10%', scrollBehavior: 'smooth' }}>
        {chat.map((msg, i) => (
          <div key={i} style={{ marginBottom: '25px', display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#8b949e', fontSize: '0.85rem' }}>
              {msg.role === 'user' ? <><span style={{ color: '#58a6ff' }}>Alex Rodrigues</span> <User size={14}/></> : <><Bot size={14} color="#3fb950"/> <span>Auditor AI</span></>}
            </div>
            
            <div style={{ 
              backgroundColor: msg.role === 'user' ? '#1f6feb' : '#161b22',
              color: '#fff',
              padding: '5px 15px',
              borderRadius: '12px',
              maxWidth: '90%',
              border: msg.role === 'user' ? 'none' : '1px solid #30363d',
              fontSize: '0.95rem',
              lineHeight: '1.6'
            }}>
              <ReactMarkdown
                children={msg.content}
                components={{
                  code({node, inline, className, children, ...props}) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <SyntaxHighlighter
                        children={String(children).replace(/\n$/, '')}
                        style={vscDarkPlus}
                        language={match[1]}
                        PreTag="div"
                        {...props}
                      />
                    ) : (
                      <code className={className} {...props} style={{ backgroundColor: '#2d333b', padding: '2px 4px', borderRadius: '4px' }}>
                        {children}
                      </code>
                    )
                  }
                }}
              />
              {isStreaming && i === chat.length - 1 && !msg.content && <span>|</span>}
            </div>
          </div>
        ))}
      </main>

      {/* INPUT ESTILIZADO */}
      <footer style={{ padding: '20px 10%', backgroundColor: '#0d1117' }}>
        <div style={{ display: 'flex', gap: '12px', backgroundColor: '#161b22', padding: '8px', borderRadius: '12px', border: '1px solid #30363d' }}>
          <input 
            value={input} 
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Digite sua dúvida de código ou auditoria..."
            style={{ flex: 1, backgroundColor: 'transparent', border: 'none', color: '#c9d1d9', outline: 'none', padding: '10px' }}
            disabled={isStreaming}
          />
          <button 
            onClick={sendMessage} 
            disabled={isStreaming}
            style={{ 
              backgroundColor: isStreaming ? '#21262d' : '#238636', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              padding: '10px 20px', 
              cursor: isStreaming ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Send size={18} />
          </button>
        </div>
      </footer>
    </div>
  );
}

export default App;