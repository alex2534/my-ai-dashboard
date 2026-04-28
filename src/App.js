import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User } from 'lucide-react';

function App() {
  const [input, setInput] = useState('');
  const [chat, setChat] = useState([]);
  const [model, setModel] = useState('qwen2.5-coder:32b');
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef(null);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat]);

  const sendMessage = async () => {
    if (!input || isStreaming) return;
    
    const userMessage = { role: 'user', content: input };
    const assistantPlaceholder = { role: 'assistant', content: '' };
    
    // Atualiza a tela com a pergunta e o espaço para a resposta
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
        
        // O Ollama pode mandar vários JSONs colados. Precisamos separar por quebra de linha.
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            if (json.message && json.message.content) {
              fullText += json.message.content;
              
              // Atualiza o estado do chat com o texto acumulado
              setChat(prev => {
                const newChat = [...prev];
                newChat[newChat.length - 1].content = fullText;
                return newChat;
              });
            }
            if (json.done) setIsStreaming(false);
          } catch (e) {
            console.error("Erro ao processar pedaço do JSON", e);
          }
        }
      }
    } catch (error) {
      console.error("Falha na conexão com o Ollama:", error);
      setChat(prev => [...prev, { role: 'assistant', content: 'Erro de conexão. Verifique se o Ollama está rodando com OLLAMA_ORIGINS="*".' }]);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#1a1a2e', minHeight: '100vh', color: '#fff' }}>
      <header style={{ borderBottom: '1px solid #333', marginBottom: '20px', paddingBottom: '10px' }}>
        <h1 style={{ color: '#4facfe' }}>Chaos to Code: IA Dashboard</h1>
        
        <select 
          value={model} 
          onChange={(e) => setModel(e.target.value)} 
          style={{ padding: '8px', borderRadius: '5px', backgroundColor: '#16213e', color: '#fff', border: '1px solid #4facfe', cursor: 'pointer' }}
        >
          <option value="qwen2.5-coder:32b">Qwen 32B (Auditor Sênior)</option>
          <option value="deepseek-coder-v2:16b">DeepSeek 16B (Desenvolvedor Pleno)</option>
          <option value="mistral-nemo">Mistral Nemo (Roteirista)</option>
          <option value="phi3.5">Phi-3.5 (Assistente Instantâneo)</option>
          <option value="qwen2.5-coder:7b">Qwen 7B (Equilibrado)</option>
        </select>
      </header>

      {/* Área de Chat */}
      <div 
        ref={scrollRef}
        style={{ border: '1px solid #333', borderRadius: '12px', padding: '20px', height: '500px', overflowY: 'auto', backgroundColor: '#16213e' }}
      >
        {chat.map((msg, i) => (
          <div key={i} style={{ marginBottom: '20px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
            <div style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
               {msg.role === 'user' ? <User size={16} color="#4facfe"/> : <Bot size={16} color="#00f2fe"/>}
               <span style={{ fontSize: '12px', color: '#888' }}>{msg.role === 'user' ? 'Você' : 'IA'}</span>
            </div>
            <p style={{ 
              display: 'inline-block', 
              padding: '12px 16px', 
              borderRadius: '15px', 
              maxWidth: '80%',
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
              backgroundColor: msg.role === 'user' ? '#4facfe' : '#0f3460',
              color: '#fff',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
              {msg.content || (isStreaming && i === chat.length - 1 ? '...' : '')}
            </p>
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
        <input 
          value={input} 
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Peça um código ou análise de auditoria..."
          disabled={isStreaming}
          style={{ 
            flex: 1, 
            padding: '15px', 
            borderRadius: '8px', 
            border: '1px solid #333', 
            backgroundColor: '#0f3460', 
            color: '#fff',
            outline: 'none'
          }}
        />
        <button 
          onClick={sendMessage} 
          disabled={isStreaming}
          style={{ 
            padding: '10px 25px', 
            backgroundColor: isStreaming ? '#555' : '#4facfe', 
            color: 'white', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: isStreaming ? 'not-allowed' : 'pointer',
            transition: '0.3s'
          }}
        >
          {isStreaming ? 'Processando...' : <Send size={20} />}
        </button>
      </div>
    </div>
  );
}

export default App;