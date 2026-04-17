"use client";

import * as React from "react";

let _frameIdCounter = 0;

export interface GenUIFrameProps {
  /** HTML content to render inside the iframe */
  html: string;
  /** Whether the content is still streaming (defers scripts, strips last incomplete line) */
  streaming?: boolean;
  /** CSS class applied to the iframe */
  className?: string;
  /** Max width of the iframe (default: none) */
  maxWidth?: string;
  /** Theme CSS variables to inject into the iframe (e.g. from getComputedStyle(document.documentElement)) */
  themeVars?: Record<string, string>;
  /** Callback when a copilot.sendMessage() is called from inside the iframe */
  onSendMessage?: (message: string) => void;
  /** Callback when a copilot.action() is called from inside the iframe */
  onAction?: (name: string, data: unknown) => unknown | Promise<unknown>;
}

/**
 * Sandboxed iframe renderer for AI-generated HTML.
 *
 * Features:
 * - Static shell loaded once (Tailwind CSS + Chart.js CDN)
 * - Content pushed via postMessage (no iframe reloads on update)
 * - Auto-height via ResizeObserver
 * - Unique frame ID prevents cross-iframe interference
 * - Scripts deferred during streaming, executed on completion
 * - Theme vars injected via postMessage (not baked into srcDoc)
 * - `window.copilot` bridge for iframe → parent communication
 *
 * @experimental
 */
export function GenUIFrame({
  html,
  streaming = false,
  className,
  maxWidth,
  themeVars,
  onSendMessage,
  onAction,
}: GenUIFrameProps) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const readyRef = React.useRef(false);
  const themeVarsRef = React.useRef(themeVars);
  const [height, setHeight] = React.useState(0);
  const frameId = React.useRef(`genui_${++_frameIdCounter}`);

  // Keep ref in sync so onLoad always sees latest themeVars
  React.useEffect(() => {
    themeVarsRef.current = themeVars;
  });

  // During streaming: strip last incomplete line + remove scripts
  const displayHtml = React.useMemo(() => {
    if (!streaming) return html;
    const lines = html.split("\n");
    if (lines.length > 1) lines.pop();
    return lines.join("\n").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  }, [html, streaming]);

  // Static shell — never changes, no themeVars baked in
  const shell = React.useMemo(() => {
    const id = frameId.current;
    return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<script src="https://cdn.tailwindcss.com"><\/script>
<script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>
<style>
  html,body{margin:0;padding:0;font-family:ui-sans-serif,system-ui,sans-serif;overflow:hidden;background:var(--background,transparent)!important}
  *{box-sizing:border-box}
  #root{padding:0}
  canvas{background:transparent!important}
</style>
<script>
var FRAME_ID='${id}';
var _callId=0,_pending={};

// ── Auto-height reporting ──
function reportHeight(){
  var h=document.getElementById('root').scrollHeight;
  if(h>0) window.parent.postMessage({action:'resize',id:FRAME_ID,height:h},'*');
}

// ── Copilot bridge API (available to AI-generated HTML) ──
window.copilot={
  sendMessage:function(msg){
    window.parent.postMessage({action:'copilot:sendMessage',id:FRAME_ID,message:msg},'*');
  },
  action:function(name,data){
    var cid=++_callId;
    window.parent.postMessage({action:'copilot:action',id:FRAME_ID,name:name,data:data,callId:cid},'*');
    return new Promise(function(resolve){_pending[cid]=resolve});
  }
};

// ── Message handler ──
window.addEventListener('message',function(e){
  if(!e.data||e.data.id!==FRAME_ID)return;
  if(e.data.action==='theme'){
    var css=':root{';
    var vars=e.data.vars||{};
    for(var k in vars){if(vars.hasOwnProperty(k))css+=k+':'+vars[k]+';'}
    css+='}';
    var el=document.getElementById('theme-vars');
    if(!el){el=document.createElement('style');el.id='theme-vars';document.head.appendChild(el);}
    el.textContent=css;
    if(window.Chart){
      var fg=vars['--foreground']||'#888';
      var border=vars['--border']||'rgba(128,128,128,0.2)';
      Chart.defaults.color=fg;
      Chart.defaults.borderColor=border;
      if(Chart.defaults.plugins&&Chart.defaults.plugins.legend)
        Chart.defaults.plugins.legend.labels.color=fg;
      // Prevent black area fills — default to semi-transparent if AI didn't set one
      var ds=Chart.defaults.datasets=Chart.defaults.datasets||{};
      ['line','radar'].forEach(function(t){
        ds[t]=ds[t]||{};
        if(!ds[t].backgroundColor) ds[t].backgroundColor='rgba(99,102,241,0.15)';
      });
    }
  }
  if(e.data.action==='hydrate'){
    document.getElementById('root').innerHTML=e.data.html;
    if(!e.data.streaming){
      document.querySelectorAll('#root script').forEach(function(s){
        var n=document.createElement('script');n.text=s.text;s.parentNode.replaceChild(n,s);
      });
    }
    // Poll at 30ms, 150ms, 400ms, 800ms to catch async renders (e.g. Chart.js)
    [30,150,400,800].forEach(function(ms){setTimeout(reportHeight,ms)});
  }
  if(e.data.action==='copilot:actionResult'&&_pending[e.data.callId]){
    _pending[e.data.callId](e.data.result);
    delete _pending[e.data.callId];
  }
});

new ResizeObserver(function(){reportHeight()}).observe(document.getElementById('root'));
<\/script>
</head><body><div id="root"></div></body></html>`;
  }, []);

  // Listen for messages from THIS iframe only
  React.useEffect(() => {
    const id = frameId.current;
    const handleMessage = (e: MessageEvent) => {
      if (!e.data || e.data.id !== id) return;

      // Auto-height
      if (e.data.action === "resize" && typeof e.data.height === "number") {
        setHeight(e.data.height);
      }

      // Bridge: sendMessage
      if (e.data.action === "copilot:sendMessage" && onSendMessage) {
        onSendMessage(e.data.message);
      }

      // Bridge: custom action
      if (e.data.action === "copilot:action" && onAction) {
        const result = onAction(e.data.name, e.data.data);
        // Send result back to iframe (supports sync and async handlers)
        Promise.resolve(result).then((res) => {
          iframeRef.current?.contentWindow?.postMessage(
            {
              action: "copilot:actionResult",
              id,
              callId: e.data.callId,
              result: res,
            },
            "*",
          );
        });
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onSendMessage, onAction]);

  // Helper: send theme vars to iframe
  const sendTheme = React.useCallback(
    (vars: Record<string, string> | undefined) => {
      if (!vars || !iframeRef.current?.contentWindow) return;
      iframeRef.current.contentWindow.postMessage(
        { action: "theme", id: frameId.current, vars },
        "*",
      );
    },
    [],
  );

  // Push content on iframe load + send theme
  React.useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const id = frameId.current;
    const onLoad = () => {
      readyRef.current = true;
      // Send theme first so vars are available when HTML is injected
      const vars = themeVarsRef.current;
      if (vars && Object.keys(vars).length > 0) {
        iframe.contentWindow?.postMessage({ action: "theme", id, vars }, "*");
      }
      iframe.contentWindow?.postMessage(
        { action: "hydrate", id, html: displayHtml, streaming },
        "*",
      );
    };
    iframe.addEventListener("load", onLoad);
    return () => iframe.removeEventListener("load", onLoad);
  }, []);

  // Push content updates via postMessage
  React.useEffect(() => {
    if (!displayHtml || !readyRef.current) return;
    iframeRef.current?.contentWindow?.postMessage(
      { action: "hydrate", id: frameId.current, html: displayHtml, streaming },
      "*",
    );
  }, [displayHtml, streaming]);

  // Push theme updates (when themeVars prop changes)
  React.useEffect(() => {
    if (!readyRef.current) return;
    sendTheme(themeVars);
  }, [themeVars, sendTheme]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={shell}
      sandbox="allow-scripts allow-same-origin"
      style={{
        height: height > 0 ? `${height}px` : "40px",
        width: "100%",
        maxWidth: maxWidth ?? "100%",
        transition: "height 0.15s ease",
        border: "none",
        display: "block",
      }}
      className={className ?? "bg-transparent overflow-hidden"}
      title="Rendered HTML"
    />
  );
}
