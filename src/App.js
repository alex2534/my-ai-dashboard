import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Terminal, Cpu, Square } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

function App() {
  const [input, setInput] = useState('');
  const [chat, setChat] = useState([]);
  const [model, setModel] = useState('Phi-3.5');
  const [isStreaming, setIsStreaming] = useState(false);

  const scrollRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat]);

  const stopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
      setChat(prev => {
        const newChat = [...prev];
        if (newChat.length > 0 && newChat[newChat.length - 1].role === 'assistant') {
          newChat[newChat.length - 1].content += "\n\n*Geração interrompida.*";
        }
        return newChat;
      });
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    // Criar o sinal para cancelamento
    abortControllerRef.current = new AbortController();

    const userMessage = { role: 'user', content: input };

    // REGRA DE OURO: O Ollama só recebe o que tem conteúdo. 
    // Não enviamos o placeholder vazio que será criado para o assistente.
    const messagesToPayload = [...chat, userMessage].map(m => ({
      role: m.role,
      content: m.content
    }));

    // Atualiza a UI: Adiciona a pergunta e um balão vazio para a resposta
    setChat(prev => [...prev, userMessage, { role: 'assistant', content: '' }]);
    setInput('');
    setIsStreaming(true);

    try {
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          model: model,
          messages: messagesToPayload,
          stream: true
        }),
      });

      if (!response.ok) throw new Error(`Erro Ollama: ${response.status}`);

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
                // Atualiza o último balão (o do assistente) com o texto acumulado
                newChat[newChat.length - 1] = { role: 'assistant', content: fullText };
                return newChat;
              });
            }
          } catch (e) { /* Chunk parcial, aguarda o próximo */ }
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log("Stream cancelado pelo usuário.");
      } else {
        setChat(prev => [...prev, { role: 'assistant', content: "⚠️ Erro de conexão com o Ollama. Verifique se ele está rodando." }]);
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0d1117', color: '#c9d1d9', fontFamily: 'Segoe UI, sans-serif' }}>

      {/* HEADER */}
      <header style={{ padding: '15px 25px', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#161b22' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Terminal color="#58a6ff" />
          <h1 style={{ fontSize: '1.1rem', margin: 0 }}>Chaos to Code <span style={{ color: '#8b949e' }}>| Lab</span></h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Cpu size={18} color={isStreaming ? '#f0883e' : '#3fb950'} />
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={{ padding: '5px', borderRadius: '5px', backgroundColor: '#0d1117', color: '#fff', border: '1px solid #30363d' }}
          >
            <option value="phi3.5">Phi-3.5</option>
            <option value="deepseek-coder-v2:16b">DeepSeek 16B</option>
            <option value="qwen2.5-coder:32b">Qwen 32B</option>


          </select>
        </div>
      </header>

      {/* CHAT AREA */}
      <main ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 15%' }}>
        {chat.map((msg, i) => (
          <div key={i} style={{ marginBottom: '20px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
            <div style={{ fontSize: '0.8rem', color: '#8b949e', marginBottom: '5px' }}>
              {msg.role === 'user' ? 'Alex' : 'Auditor-IA'}
            </div>
            <div style={{
              display: 'inline-block',
              padding: '12px 18px',
              borderRadius: '15px',
              backgroundColor: msg.role === 'user' ? '#1f6feb' : '#161b22',
              textAlign: 'left',
              maxWidth: '85%',
              border: '1px solid #30363d'
            }}>
              <ReactMarkdown
                children={msg.content}
                components={{
                  code({ node, inline, className, children, ...props }) {
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
            </div>
          </div>
        ))}
      </main>

      {/* FOOTER / INPUT */}
      <footer style={{ padding: '20px 15%', backgroundColor: '#0d1117' }}>
        <div style={{ display: 'flex', gap: '10px', backgroundColor: '#161b22', padding: '10px', borderRadius: '10px', border: '1px solid #30363d' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Mande sua dúvida..."
            style={{ flex: 1, backgroundColor: 'transparent', border: 'none', color: '#fff', outline: 'none' }}
          />

          {isStreaming ? (
            <button onClick={stopStreaming} style={{ backgroundColor: '#da3633', border: 'none', borderRadius: '5px', padding: '10px', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center' }}>
              <Square size={18} fill="white" />
            </button>
          ) : (
            <button onClick={sendMessage} style={{ backgroundColor: '#238636', border: 'none', borderRadius: '5px', padding: '10px', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center' }}>
              <Send size={18} />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

export default App;