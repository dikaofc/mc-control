'use client';
import { useEffect, useRef, useState } from 'react';
import '@xterm/xterm/css/xterm.css';
import { terminalSocket } from '../lib/api';

// xterm.js touches the `self` global at import time, which crashes Next.js
// static prerender (SSR). Load it lazily inside the effect so it only ever
// executes in the browser.
export default function Terminal({ projectId }) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const wsRef = useRef(null);
  const ctrlRef = useRef(false); // Ctrl latch for the next key
  const [ctrlOn, setCtrlOn] = useState(false);
  const [full, setFull] = useState(false);

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

      const send = (data) => {
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'data', data }));
      };
      term.onData(send);
      // expose send so the key bar can use it
      termRef.current._send = send;

      const onResize = () => {
        try {
          fit.fit();
          send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
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

  // Send a literal string / escape sequence to the PTY.
  function press(data) {
    const send = termRef.current && termRef.current._send;
    if (send) send(data);
    if (termRef.current) termRef.current.focus();
  }
  // Ctrl-combo: Ctrl(C) => 0x03 etc. For letters a-z: code = charCode - 96.
  function pressCtrl(letter) {
    const code = letter.toLowerCase().charCodeAt(0) - 96;
    press(String.fromCharCode(code));
    ctrlRef.current = false;
    setCtrlOn(false);
  }

  const keys = [
    { label: 'Ctrl', send: null, toggle: true },
    { label: 'Esc', send: '\x1b' },
    { label: 'Tab', send: '\t' },
    { label: '↑', send: '\x1b[A' },
    { label: '↓', send: '\x1b[B' },
    { label: '←', send: '\x1b[D' },
    { label: '→', send: '\x1b[C' },
    { label: 'Home', send: '\x1b[H' },
    { label: 'End', send: '\x1b[F' },
    { label: '/', send: '/' },
    { label: '-', send: '-' },
    { label: '|', send: '|' },
    { label: '~', send: '~' },
    { label: '=', send: '=' },
    { label: '\\', send: '\\' },
    { label: 'PgUp', send: '\x1b[5~' },
    { label: 'PgDn', send: '\x1b[6~' },
  ];

  return (
    <div className={'terminal-wrap' + (full ? ' terminal-full' : '')}>
      <div className="terminal-bar">
        <div className="terminal-dots">
          <span className="tdot" style={{ background: '#ff5252' }} />
          <span className="tdot" style={{ background: '#ffd740' }} />
          <span className="tdot" style={{ background: '#00e676' }} />
        </div>
        <span className="terminal-title">bash ~ VPS Terminal</span>
        <button className="term-fs-btn" onClick={() => setFull((f) => !f)}>
          {full ? 'Exit FS' : 'Fullscreen'}
        </button>
      </div>
      <div ref={containerRef} className="terminal-body" />

      {/* Termux-style key bar — full control from touch (Android Chrome). */}
      <div className="term-keys">
        {keys.map((k) => (
          <button
            key={k.label}
            className={'term-key' + (k.toggle && ctrlOn ? ' active' : '')}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (k.toggle) { ctrlRef.current = !ctrlRef.current; setCtrlOn(!ctrlOn); return; }
              if (ctrlOn && /^[a-z]$/i.test(k.label)) return pressCtrl(k.label);
              press(k.send);
            }}
          >
            {k.label}
          </button>
        ))}
        {/* Ctrl letter row: tap Ctrl, then a letter. Provided as quick combos. */}
        <span className="term-key-sep" />
        {['C', 'D', 'Z', 'L', 'R'].map((c) => (
          <button key={'ctrl' + c} className="term-key ctrl-combo" onMouseDown={(e) => e.preventDefault()}
            onClick={() => pressCtrl(c)}>C-{c}</button>
        ))}
      </div>
    </div>
  );
}
