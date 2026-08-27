'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import '@xterm/xterm/css/xterm.css';
import { terminalSocket } from '../lib/api';

export default function Terminal({ projectId }) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const wsRef = useRef(null);
  const ctrlRef = useRef(false);
  const [ctrlOn, setCtrlOn] = useState(false);
  const [full, setFull] = useState(false);
  const [shiftOn, setShiftOn] = useState(false);
  const [altOn, setAltOn] = useState(false);

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
        fontSize: window.innerWidth < 600 ? 12 : 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace",
        theme: {
          background: '#080a0f',
          foreground: '#e8ecf4',
          cursor: '#448aff',
          cursorAccent: '#080a0f',
          selectionBackground: 'rgba(68, 138, 255, 0.25)',
          black: '#4a5568', red: '#ff5252', green: '#00e676', yellow: '#ffd740',
          blue: '#448aff', magenta: '#b388ff', cyan: '#18ffff', white: '#e8ecf4',
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
        if (msg.type === 'exit') term.writeln('\r\n\x1b[33m[Shell exited. Refresh to reconnect.]\x1b[0m');
      });
      wsRef.current = ws;
      ws.onopen = () => term.focus();
      ws.onclose = () => term.writeln('\r\n\x1b[31m[Connection closed.]\x1b[0m');
      ws.onerror = () => term.writeln('\r\n\x1b[31m[Connection error.]\x1b[0m');

      const send = (data) => {
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'data', data }));
      };
      term.onData(send);
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

  // Re-fit when toggling fullscreen
  useEffect(() => {
    setTimeout(() => {
      if (termRef.current && termRef.current._send) {
        try {
          // Trigger resize via the ResizeObserver
          if (containerRef.current) {
            const ro = new ResizeObserver(() => {});
            ro.observe(containerRef.current);
            setTimeout(() => ro.disconnect(), 200);
          }
        } catch {}
      }
    }, 100);
  }, [full]);

  const press = useCallback((data) => {
    const send = termRef.current && termRef.current._send;
    if (send) send(data);
    if (termRef.current) termRef.current.focus();
  }, []);

  const pressCtrl = useCallback((letter) => {
    const code = letter.toLowerCase().charCodeAt(0) - 96;
    press(String.fromCharCode(code));
    ctrlRef.current = false;
    setCtrlOn(false);
  }, [press]);

  const pressCombo = useCallback((modifiers, key) => {
    // Build escape sequence from modifiers
    let prefix = '';
    if (altOn) prefix = '\x1b';
    if (shiftOn) prefix += '\x1b[1;2';  // Shift
    // Just send the key with modifiers prepended
    press(prefix + key);
  }, [press, altOn, shiftOn]);

  // Toggle modifiers
  const toggleMod = (mod) => {
    if (mod === 'ctrl') { ctrlRef.current = !ctrlRef.current; setCtrlOn(!ctrlOn); }
    if (mod === 'shift') setShiftOn(!shiftOn);
    if (mod === 'alt') setAltOn(!altOn);
  };

  const modActive = (mod) => {
    if (mod === 'ctrl') return ctrlOn;
    if (mod === 'shift') return shiftOn;
    if (mod === 'alt') return altOn;
    return false;
  };

  // Key definitions — Termux-style comprehensive layout
  const mods = [
    { id: 'ctrl', label: 'CTRL' },
    { id: 'alt', label: 'ALT' },
    { id: 'shift', label: 'SHIFT' },
  ];

  const navKeys = [
    { label: 'ESC', send: '\x1b' },
    { label: 'TAB', send: '\t' },
    { label: 'UP', send: '\x1b[A' },
    { label: 'DOWN', send: '\x1b[B' },
    { label: 'LEFT', send: '\x1b[D' },
    { label: 'RIGHT', send: '\x1b[C' },
  ];

  const editKeys = [
    { label: 'HOME', send: '\x1b[H' },
    { label: 'END', send: '\x1b[F' },
    { label: 'PgUp', send: '\x1b[5~' },
    { label: 'PgDn', send: '\x1b[6~' },
    { label: 'INS', send: '\x1b[2~' },
    { label: 'DEL', send: '\x1b[3~' },
    { label: 'BKSP', send: '\x7f' },
  ];

  const symbolKeys = [
    { label: '/', send: '/' },
    { label: '-', send: '-' },
    { label: '_', send: '_' },
    { label: '|', send: '|' },
    { label: '~', send: '~' },
    { label: '`', send: '`' },
    { label: '=', send: '=' },
    { label: '+', send: '+' },
    { label: '\\', send: '\\' },
    { label: ';', send: ';' },
    { label: ':', send: ':' },
    { label: "'", send: "'" },
    { label: '"', send: '"' },
    { label: '(', send: '(' },
    { label: ')', send: ')' },
    { label: '[', send: '[' },
    { label: ']', send: ']' },
    { label: '{', send: '{' },
    { label: '}', send: '}' },
    { label: '<', send: '<' },
    { label: '>', send: '>' },
    { label: '!', send: '!' },
    { label: '@', send: '@' },
    { label: '#', send: '#' },
    { label: '$', send: '$' },
    { label: '%', send: '%' },
    { label: '^', send: '^' },
    { label: '&', send: '&' },
    { label: '*', send: '*' },
    { label: '?', send: '?' },
  ];

  const ctrlCombos = [
    { label: 'C', key: 'C' },
    { label: 'D', key: 'D' },
    { label: 'Z', key: 'Z' },
    { label: 'L', key: 'L' },
    { label: 'A', key: 'A' },
    { label: 'E', key: 'E' },
    { label: 'K', key: 'K' },
    { label: 'U', key: 'U' },
    { label: 'W', key: 'W' },
  ];

  return (
    <div className={'terminal-wrap' + (full ? ' terminal-full' : '')}>
      {/* Title bar */}
      <div className="terminal-bar">
        <div className="terminal-dots">
          <span className="tdot" style={{ background: '#ff5252' }} />
          <span className="tdot" style={{ background: '#ffd740' }} />
          <span className="tdot" style={{ background: '#00e676' }} />
        </div>
        <span className="terminal-title">bash ~ VPS Terminal</span>
        {full && <button className="term-fs-btn" onClick={() => setFull(false)}>Exit FS</button>}
        {!full && <button className="term-fs-btn" onClick={() => setFull(true)}>Fullscreen</button>}
      </div>

      {/* Terminal viewport */}
      <div ref={containerRef} className="terminal-body" />

      {/* Termux-style keyboard */}
      <div className="term-keys">
        {/* Modifier row */}
        <div className="term-key-row">
          {mods.map((m) => (
            <button key={m.id}
              className={'term-key mod-key' + (modActive(m.id) ? ' active' : '')}
              onMouseDown={(e) => e.preventDefault()}
              onTouchStart={(e) => { e.preventDefault(); toggleMod(m.id); }}
            >{m.label}</button>
          ))}
          <span className="term-key-spacer" />
          {ctrlCombos.map((c) => (
            <button key={'c-' + c.label} className="term-key ctrl-combo"
              onMouseDown={(e) => e.preventDefault()}
              onTouchStart={(e) => { e.preventDefault(); pressCtrl(c.key); }}
            >C-{c.label}</button>
          ))}
        </div>

        {/* Navigation row */}
        <div className="term-key-row">
          {navKeys.map((k) => (
            <button key={k.label} className="term-key nav-key"
              onMouseDown={(e) => e.preventDefault()}
              onTouchStart={(e) => { e.preventDefault(); press(k.send); }}
            >{k.label}</button>
          ))}
        </div>

        {/* Edit row */}
        <div className="term-key-row">
          {editKeys.map((k) => (
            <button key={k.label} className="term-key edit-key"
              onMouseDown={(e) => e.preventDefault()}
              onTouchStart={(e) => { e.preventDefault(); press(k.send); }}
            >{k.label}</button>
          ))}
        </div>

        {/* Symbols row (scrollable) */}
        <div className="term-key-row term-key-scroll">
          {symbolKeys.map((k) => (
            <button key={k.label} className="term-key sym-key"
              onMouseDown={(e) => e.preventDefault()}
              onTouchStart={(e) => { e.preventDefault(); press(k.send); }}
            >{k.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
