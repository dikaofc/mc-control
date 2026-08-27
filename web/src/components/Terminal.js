'use client';
import { useEffect, useRef } from 'react';
import '@xterm/xterm/css/xterm.css';
import { terminalSocket } from '../lib/api';

// xterm.js touches the `self` global at import time, which crashes Next.js
// static prerender (SSR). Load it lazily inside the effect so it only ever
// executes in the browser.
export default function Terminal({ projectId }) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;
    let ro;

    (async () => {
      const { Terminal: XTerm } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');
      if (disposed || !containerRef.current) return;

      const term = new XTerm({
        cursorBlink: true,
        fontSize: typeof window !== 'undefined' && window.innerWidth < 600 ? 11 : 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace",
        theme: {
          background: '#080a0f',
          foreground: '#e8ecf4',
          cursor: '#448aff',
          cursorAccent: '#080a0f',
          selectionBackground: 'rgba(68, 138, 255, 0.25)',
          black: '#4a5568',
          red: '#ff5252',
          green: '#00e676',
          yellow: '#ffd740',
          blue: '#448aff',
          magenta: '#b388ff',
          cyan: '#18ffff',
          white: '#e8ecf4',
        },
        allowProposedApi: true,
        scrollback: 10000,
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(containerRef.current);
      fit.fit();
      termRef.current = term;

      const ws = terminalSocket(projectId, (msg) => {
        if (msg.type === 'data') term.write(msg.data);
        if (msg.type === 'exit') {
          term.writeln('\r\n\x1b[33m[Shell exited. Refresh to reconnect.]\x1b[0m');
        }
      });
      wsRef.current = ws;
      ws.onopen = () => term.focus();
      ws.onclose = () => term.writeln('\r\n\x1b[31m[Connection closed. Refresh to reconnect.]\x1b[0m');
      ws.onerror = () => term.writeln('\r\n\x1b[31m[Connection error.]\x1b[0m');

      term.onData((data) => {
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'data', data }));
      });

      const onResize = () => {
        try {
          fit.fit();
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        } catch {}
      };
      window.addEventListener('resize', onResize);
      ro = new ResizeObserver(onResize);
      ro.observe(containerRef.current);
    })();

    return () => {
      disposed = true;
      if (ro) ro.disconnect();
      try { wsRef.current && wsRef.current.close(); } catch {}
      if (termRef.current) termRef.current.dispose();
    };
  }, [projectId]);

  return (
    <div className="terminal-wrap">
      <div className="terminal-bar">
        <div className="terminal-dots">
          <span className="tdot" style={{ background: '#ff5252' }} />
          <span className="tdot" style={{ background: '#ffd740' }} />
          <span className="tdot" style={{ background: '#00e676' }} />
        </div>
        <span className="terminal-title">bash ~ VPS Terminal</span>
      </div>
      <div ref={containerRef} className="terminal-body" />
    </div>
  );
}
