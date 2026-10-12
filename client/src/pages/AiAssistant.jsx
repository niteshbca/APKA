import React, { useEffect, useRef, useState } from 'react';
import api from '../api/axios';
import { Card, Button, Spinner } from '../components/ui';

export default function AiAssistant() {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Namaste! Main aapka business assistant hoon. Sales, stock, profit, staff ya tasks ke baare me kuch bhi poochhein.' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const endRef = useRef(null);

  useEffect(() => {
    api.get('/ai/suggestions').then((r) => setSuggestions(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  const send = async (text) => {
    const q = (text || input).trim();
    if (!q || busy) return;
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setInput('');
    setBusy(true);
    try {
      const r = await api.post('/ai/chat', { message: q });
      setMessages((m) => [...m, { role: 'assistant', text: r.data.reply }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: `Error: ${e.message}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h2 className="mb-16">AI Assistant</h2>
      <Card>
        <div style={{ height: 420, overflowY: 'auto', padding: 8 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
              <div
                style={{
                  maxWidth: '78%', whiteSpace: 'pre-wrap', padding: '10px 14px', borderRadius: 12,
                  background: m.role === 'user' ? '#2563eb' : 'var(--surface-2, #f1f5f9)',
                  color: m.role === 'user' ? '#fff' : 'inherit',
                }}
              >
                {m.text}
              </div>
            </div>
          ))}
          {busy && <Spinner label="Soch raha hoon…" />}
          <div ref={endRef} />
        </div>

        <div className="flex gap-8" style={{ flexWrap: 'wrap', margin: '12px 0' }}>
          {suggestions.map((s) => (
            <Button key={s} size="sm" variant="ghost" onClick={() => send(s)}>{s}</Button>
          ))}
        </div>

        <div className="flex gap-8" style={{ alignItems: 'center' }}>
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="Ask about your business…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          />
          <Button onClick={() => send()} disabled={busy}>Send</Button>
        </div>
      </Card>
    </div>
  );
}
