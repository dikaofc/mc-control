'use client';
import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { terminalSocket } from '../lib/api';

export default function Terminal({ projectId }) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace",
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor: '#58a6ff',
        cursorAccent: '#0d1117',
        selectionBackground: '#264f78',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#e6edf3',
      },
      allowProposedApi: true,
      scrollback: 10000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    // Show welcome message
    term.writeln('\x1b[1;32m╔══════════════════════════════════════╗\x1b[0m');
    term.writeln('\x1b[1;32m║     🖥️  VPS Panel Terminal          ║\x1b[0m');
    term.writeln('\x1b[1;32m╚══════════════════════════════════════╝\x1b[0m');
    term.writeln('');

    const ws = terminalSocket(projectId, (msg) => {
      if (msg.type === 'data') term.write(msg.data);
    });
    wsRef.current = ws;
    ws.onopen = () => {
      term.focus();
      term.writeln('\x1b[90mConnected to workspace. Starting shell...\x1b[0m\r\n');
    };
    ws.onclose = () => {
      term.writeln('\r\n\x1b[31m[Connection closed. Reconnect by refreshing the page.]\x1b[0m');
    };
    ws.onerror = () => {
      term.writeln('\r\n\x1b[31m[Connection error. Check if the server is running.]\x1b[0m');
    };

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
    const ro = new ResizeObserver(onResize);
    ro.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      try { ws.close(); } catch {}
      term.dispose();
    };
  }, [projectId]);

  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div style={{
        background: '#161b22',
        padding: '6px 12px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#f85149', display: 'inline-block' }} />
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#d29922', display: 'inline-block' }} />
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#3fb950', display: 'inline-block' }} />
        <span style={{ color: 'var(--text-dim)', fontSize: 12, marginLeft: 8 }}>bash — VPS Terminal</span>
      </div>
      <div ref={containerRef} style={{ width: '100%', height: '70vh', background: '#0d1117' }} />
    </div>
  );
}
