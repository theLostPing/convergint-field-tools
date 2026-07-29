/* =====================================================================
   AMP Console  —  drive AAM Pro's /api/v1.2 API from the browser.

   WHY: on the customer's Windows Server, every command-line client
   (System32 curl, Git curl, PowerShell/.NET) dies at the TLS handshake
   (Schannel can't do AMP's mid-handshake renegotiation). The BROWSER's
   TLS works fine. This script runs IN the browser and does HTTP digest
   auth itself — so it needs no address-bar login, no OpenSSL, no install.

   HOW TO USE:
     1. Open the AAM Pro dashboard in Chrome/Firefox and log in.
     2. Fill in AMP_USER / AMP_PASS below (your API-Access user).
     3. F12 -> Console -> paste this whole file -> Enter.
     4. Run:   await amp.discover()      // lists real IDs, confirms v1.2 is live
        then:  await amp.fire('walk-test', 5)     // test a session
        then:  await amp.provision()      // create the sessions (edit SESSIONS first)
   ===================================================================== */

// ---------- CONFIG: fill these in ----------
var AMP_USER = "<API_USER>";
var AMP_PASS = "<API_PASSWORD>";
var AMP_BASE = "";   // "" = same origin (running on the dashboard). Node test overrides this.

// Sessions to create in provision() — fill visualProfileId + targets from discover()
var SESSIONS = [
  // { customId:'fire-announce',  prio:'HIGH', visualProfileId:3, targets:['sit_1'] },
  // { customId:'fire-hold',      prio:'LOW',  visualProfileId:3, targets:['sit_1'] },
  // ...add the rest from your button map...
];

// For amp.rules() — the C6110 button map. Each entry = ONE console rule (one POST).
// Repeat the same btn number for a button that fires multiple rules (multi-step).
var BUTTONS = [
  // {btn:7, name:'Fire',      play:'fire-announce', fileId:11, repeat:0},
  // {btn:7, name:'Fire',      play:'fire-hold',     fileId:4,  repeat:0},
  // {btn:6, name:'All Clear', stop:'fire-hold'},
  // {btn:6, name:'All Clear', play:'allclear',      fileId:6,  repeat:1},
];
// -------------------------------------------

function md5(string){
  function sa(x,y){var l=(x&0xffff)+(y&0xffff);return((x>>16)+(y>>16)+(l>>16)<<16)|(l&0xffff);}
  function rl(n,c){return(n<<c)|(n>>>(32-c));}
  function cmn(q,a,b,x,s,t){return sa(rl(sa(sa(a,q),sa(x,t)),s),b);}
  function ff(a,b,c,d,x,s,t){return cmn((b&c)|(~b&d),a,b,x,s,t);}
  function gg(a,b,c,d,x,s,t){return cmn((b&d)|(c&~d),a,b,x,s,t);}
  function hh(a,b,c,d,x,s,t){return cmn(b^c^d,a,b,x,s,t);}
  function ii(a,b,c,d,x,s,t){return cmn(c^(b|~d),a,b,x,s,t);}
  function core(x,len){
    x[len>>5]|=0x80<<(len%32); x[(((len+64)>>>9)<<4)+14]=len;
    var i,oa,ob,oc,od,a=1732584193,b=-271733879,c=-1732584194,d=271733878;
    for(i=0;i<x.length;i+=16){
      oa=a;ob=b;oc=c;od=d;
      a=ff(a,b,c,d,x[i],7,-680876936);d=ff(d,a,b,c,x[i+1],12,-389564586);c=ff(c,d,a,b,x[i+2],17,606105819);b=ff(b,c,d,a,x[i+3],22,-1044525330);
      a=ff(a,b,c,d,x[i+4],7,-176418897);d=ff(d,a,b,c,x[i+5],12,1200080426);c=ff(c,d,a,b,x[i+6],17,-1473231341);b=ff(b,c,d,a,x[i+7],22,-45705983);
      a=ff(a,b,c,d,x[i+8],7,1770035416);d=ff(d,a,b,c,x[i+9],12,-1958414417);c=ff(c,d,a,b,x[i+10],17,-42063);b=ff(b,c,d,a,x[i+11],22,-1990404162);
      a=ff(a,b,c,d,x[i+12],7,1804603682);d=ff(d,a,b,c,x[i+13],12,-40341101);c=ff(c,d,a,b,x[i+14],17,-1502002290);b=ff(b,c,d,a,x[i+15],22,1236535329);
      a=gg(a,b,c,d,x[i+1],5,-165796510);d=gg(d,a,b,c,x[i+6],9,-1069501632);c=gg(c,d,a,b,x[i+11],14,643717713);b=gg(b,c,d,a,x[i],20,-373897302);
      a=gg(a,b,c,d,x[i+5],5,-701558691);d=gg(d,a,b,c,x[i+10],9,38016083);c=gg(c,d,a,b,x[i+15],14,-660478335);b=gg(b,c,d,a,x[i+4],20,-405537848);
      a=gg(a,b,c,d,x[i+9],5,568446438);d=gg(d,a,b,c,x[i+14],9,-1019803690);c=gg(c,d,a,b,x[i+3],14,-187363961);b=gg(b,c,d,a,x[i+8],20,1163531501);
      a=gg(a,b,c,d,x[i+13],5,-1444681467);d=gg(d,a,b,c,x[i+2],9,-51403784);c=gg(c,d,a,b,x[i+7],14,1735328473);b=gg(b,c,d,a,x[i+12],20,-1926607734);
      a=hh(a,b,c,d,x[i+5],4,-378558);d=hh(d,a,b,c,x[i+8],11,-2022574463);c=hh(c,d,a,b,x[i+11],16,1839030562);b=hh(b,c,d,a,x[i+14],23,-35309556);
      a=hh(a,b,c,d,x[i+1],4,-1530992060);d=hh(d,a,b,c,x[i+4],11,1272893353);c=hh(c,d,a,b,x[i+7],16,-155497632);b=hh(b,c,d,a,x[i+10],23,-1094730640);
      a=hh(a,b,c,d,x[i+13],4,681279174);d=hh(d,a,b,c,x[i],11,-358537222);c=hh(c,d,a,b,x[i+3],16,-722521979);b=hh(b,c,d,a,x[i+6],23,76029189);
      a=hh(a,b,c,d,x[i+9],4,-640364487);d=hh(d,a,b,c,x[i+12],11,-421815835);c=hh(c,d,a,b,x[i+15],16,530742520);b=hh(b,c,d,a,x[i+2],23,-995338651);
      a=ii(a,b,c,d,x[i],6,-198630844);d=ii(d,a,b,c,x[i+7],10,1126891415);c=ii(c,d,a,b,x[i+14],15,-1416354905);b=ii(b,c,d,a,x[i+5],21,-57434055);
      a=ii(a,b,c,d,x[i+12],6,1700485571);d=ii(d,a,b,c,x[i+3],10,-1894986606);c=ii(c,d,a,b,x[i+10],15,-1051523);b=ii(b,c,d,a,x[i+1],21,-2054922799);
      a=ii(a,b,c,d,x[i+8],6,1873313359);d=ii(d,a,b,c,x[i+15],10,-30611744);c=ii(c,d,a,b,x[i+6],15,-1560198380);b=ii(b,c,d,a,x[i+13],21,1309151649);
      a=ii(a,b,c,d,x[i+4],6,-145523070);d=ii(d,a,b,c,x[i+11],10,-1120210379);c=ii(c,d,a,b,x[i+2],15,718787259);b=ii(b,c,d,a,x[i+9],21,-343485551);
      a=sa(a,oa);b=sa(b,ob);c=sa(c,oc);d=sa(d,od);
    }
    return[a,b,c,d];
  }
  function b2r(inp){var o='';for(var i=0;i<inp.length*32;i+=8)o+=String.fromCharCode((inp[i>>5]>>>(i%32))&0xff);return o;}
  function r2b(inp){var o=[];o[(inp.length>>2)-1]=undefined;for(var i=0;i<o.length;i++)o[i]=0;for(i=0;i<inp.length*8;i+=8)o[i>>5]|=(inp.charCodeAt(i/8)&0xff)<<(i%32);return o;}
  function hex(inp){var t='0123456789abcdef',o='',x,i;for(i=0;i<inp.length;i++){x=inp.charCodeAt(i);o+=t.charAt((x>>>4)&0x0f)+t.charAt(x&0x0f);}return o;}
  var s=unescape(encodeURIComponent(string));
  return hex(b2r(core(r2b(s),s.length*8)));
}

async function digestFetch(method, path, body){
  if(String(AMP_USER+AMP_PASS).includes('<')){
    console.error('%c⛔ Credentials not set. Run:  amp.login(USER, PASSWORD)  with the AMP API user — not the <...> placeholder.','color:#c00;font-weight:bold;font-size:14px');
    throw new Error('creds still contain a <placeholder> — run amp.login(user, password) with the real values first');
  }
  const opts={method,headers:{Accept:'application/json'},credentials:'omit'};
  if(body!==undefined){opts.body=JSON.stringify(body);opts.headers['Content-Type']='application/json';}
  let r=await fetch(AMP_BASE+path,opts);
  if(r.status===401){
    const wa=r.headers.get('www-authenticate')||'';
    const g=k=>(wa.match(new RegExp(k+'="?([^",]+)"?'))||[])[1];
    const realm=g('realm'),nonce=g('nonce'),qop=g('qop')||'auth',opaque=g('opaque');
    const ha1=md5(`${AMP_USER}:${realm}:${AMP_PASS}`);
    const ha2=md5(`${method}:${path}`);
    const nc='00000001',cnonce=Math.random().toString(16).slice(2,10)+Math.random().toString(16).slice(2,10);
    const resp=md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
    let auth=`Digest username="${AMP_USER}", realm="${realm}", nonce="${nonce}", uri="${path}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${resp}"`;
    if(opaque)auth+=`, opaque="${opaque}"`;
    opts.headers['Authorization']=auth;
    r=await fetch(AMP_BASE+path,opts);
  }
  return r;
}
async function api(method,ep,body){
  const r=await digestFetch(method,'/api/v1.2/'+ep,body);
  const t=await r.text();
  let data; try{data=JSON.parse(t);}catch{data=t;}
  return {status:r.status,data};
}

var amp={
  // Set creds without editing the file:  amp.login('Convergint','2683')
  login(u,p){ AMP_USER=u; AMP_PASS=p; console.log(`creds set: user=${u}`); },
  // Save text as a file ON THIS MACHINE (browser download). In Node it just prints.
  download(name,text){
    if(typeof document==='undefined'){return name;}
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'}));
    a.download=name; document.body.appendChild(a); a.click(); a.remove();
    console.log('⬇ downloaded',name); return name;
  },
  // Fill BUTTONS[] up top, then run this: prints + downloads a ready-to-enter C6110 rule sheet.
  rules(server){
    server = server || (typeof location!=='undefined' && location.host) || '<SERVER_IP>';
    if(!BUTTONS.length){console.warn('Fill BUTTONS[] first (top of the file), then run amp.rules().');return;}
    const byBtn={};
    for(const b of BUTTONS)(byBtn[b.btn]=byBtn[b.btn]||[]).push(b);
    let out=`C6110 CONSOLE RULES  —  server ${server}\n`+
            `Enter each under System > Events > Rules. Every one: method POST, header\n`+
            `Content-Type: application/json, Auth = Digest (the AMP API user),\n`+
            `Validate server certificate = OFF. Multiple rules on one button = fire together.\n\n`;
    for(const btn of Object.keys(byBtn).sort((a,b)=>a-b)){
      out+=`===== Button ${btn} : ${byBtn[btn][0].name} =====\n`;
      byBtn[btn].forEach((r,i)=>{
        const cid=r.stop||r.play, action=r.stop?'stopAudioFiles':'playAudioFiles';
        const ids=(r.fileIds||[r.fileId]).map(String);
        const body=r.stop?'{}':JSON.stringify({fileIds:ids,repeat:r.repeat});
        out+=`  rule ${i+1}: POST https://${server}/api/v1.2/audioSessions/custom/${cid}/${action}\n`+
             `          body: ${body}\n`;
      });
      out+='\n';
    }
    console.log(out);   // printed right here — copy from the console, no file-hunting needed
    console.log('%c↑ Those are your button rules. A copy also saved as console-rules.txt (browser downloads).','color:#0a0;font-weight:bold');
    amp.download('console-rules.txt',out);
    return out;
  },
  // FIRST thing to run when nothing works — tells you WHICH API the box actually has.
  async diagnose(){
    const probes=[
      ['v1.2 audioFiles','/api/v1.2/audioFiles'],
      ['v1.2 audioSessions','/api/v1.2/audioSessions'],
      ['v1.1 audioFiles','/api/v1.1/audioFiles'],
      ['v1.1 audioSessions','/api/v1.1/audioSessions'],
      ['webapi libraries','/webapi/v1/libraries'],
    ];
    console.log('Probing API surfaces with your digest creds...\n');
    const out=[];
    for(const [name,path] of probes){
      let status,note;
      try{const r=await digestFetch('GET',path);status=r.status;}
      catch(e){status='ERR';note=e.message;}
      note=note||(status===200?'✅ LIVE — use this':status===401?'auth failed (wrong API user/pass?)':status===404?'not present':status===406?'exists (JSON-only)':'redirect/other');
      out.push({surface:name,path,status,meaning:note});
    }
    console.table(out);
    console.log('Read it: any 200 = that API is live, use it. ALL 401 = wrong creds. v1.2 404 but v1.1 200 = box is v1.1-only (older) → sessions/stop unavailable, tell home-Claude.');
    return out;
  },
  async discover(){
    const f=await api('GET','audioFiles');
    if(f.status===401){console.error('❌ 401 — check AMP_USER/AMP_PASS (the API-Access user, not your dashboard login).');return;}
    if(f.status!==200){console.error(`❌ status ${f.status} — v1.2 may not be live here.`,f.data);return;}
    console.log('✅ /api/v1.2 is LIVE and digest auth works.');
    const [v,t,s]=await Promise.all([api('GET','visualProfiles'),api('GET','targets'),api('GET','audioSessions')]);
    console.log('%c AUDIO FILES','font-weight:bold');console.table(f.data);
    console.log('%c VISUAL PROFILES','font-weight:bold');console.table(v.data);
    console.log('%c TARGETS','font-weight:bold');console.table(t.data);
    console.log('%c EXISTING SESSIONS','font-weight:bold');console.table(s.data);
    amp._last={audioFiles:f.data,visualProfiles:v.data,targets:t.data,sessions:s.data};
    return amp._last;
  },
  // Build the 11 sessions + button map from discover() BY NAME — no hand-copied ids.
  // amp.build({ colours:{fire,wv,tornado,lightning,allclear}, zones:{site,hangar,lobby},
  //             audio:{fire,wv,tornado,lightning,allclear,test,lightningAllclear}, testRepeat:120 })
  // Each value is a NAME (or part of one) you saw in discover(); it resolves to the id.
  // EVERY zone slot takes one name OR a list — real sites split a "zone" across several
  // targets (a speaker zone plus its strobe group), so site/hangar/lobby all accept arrays.
  // audio.lightningAllclear is optional: set it if the site has its own lightning all-clear
  // recording, otherwise the generic all-clear file is used for both.
  async build(o){
    const d = amp._last || await amp.discover();
    if(!d){console.error('discover() failed — set creds first (amp.login).');return;}
    // EXACT match wins before substring. "All zones" is a substring of "All Zones White
    // Noise", so a first-substring-wins matcher aims every emergency at the noise bed and
    // returns 200 OK doing it. Ambiguity is shouted about rather than silently resolved.
    const pick=(arr,q,keys)=>{ q=String(q||'').toLowerCase();
      const val=(x,k)=>String(x[k]??'').toLowerCase();
      let h=arr.find(x=>keys.some(k=>val(x,k)===q));
      if(!h){
        const hits=arr.filter(x=>keys.some(k=>val(x,k).includes(q)));
        if(hits.length>1)console.warn('⚠ AMBIGUOUS name:',q,'matched',hits.length+':',hits.map(x=>x.niceName||x.name||x.id).join(' | '),'— using the first. Pass the EXACT name to be certain.');
        h=hits[0];
      }
      if(!h)console.warn('⚠ no match for:',q,'(check the name you passed to build())'); return h; };
    const aud=q=>{const h=pick(d.audioFiles,q,['name']);return h&&h.id;};
    const prof=q=>{const h=pick(d.visualProfiles,q,['name']);return h&&h.id;};
    const zone=q=>{const h=pick(d.targets,q,['niceName','id']);return h&&h.id;};
    const C=o.colours||{}, Z=o.zones||{}, A=o.audio||{};
    // every zone slot takes a name OR a list of names
    const many=q=>(q==null?[]:Array.isArray(q)?q:[q]).map(zone);
    const site=many(Z.site), hangar=many(Z.hangar), lobby=many(Z.lobby);
    const sil60=aud(A.silence60||'silence-60'), sil30=aud(A.silence30||'silence-30');
    const clr=aud(A.allclear), tst=aud(A.test);
    const lclr=A.lightningAllclear?aud(A.lightningAllclear):clr;
    // Walk test: repeat is CYCLES, not minutes. Work the count out from the real file
    // lengths on the box so the run time is what was asked for — a hard-coded count
    // silently doubles the moment someone swaps the tone or the silence file.
    const flen=id=>{const h=(d.audioFiles||[]).find(x=>String(x.id)===String(id));return (h&&h.length)||0;};
    const cycle=flen(tst)+flen(sil30);
    const testMins=o.testMinutes||30;
    const testRepeat=o.testRepeat||(cycle>0?Math.max(1,Math.round(testMins*60/cycle)):57);
    if(!o.testRepeat)console.log(`walk test: ${cycle.toFixed(1)}s per cycle x ${testRepeat} = ~${Math.round(testRepeat*cycle/60)} min`);
    SESSIONS=[
      {customId:'fire-announce',      prio:'MEDIUM', visualProfileId:prof(C.fire),      targets:site},
      {customId:'wv-announce',        prio:'MEDIUM', visualProfileId:prof(C.wv),        targets:site},
      {customId:'wv-hold',            prio:'LOW',  visualProfileId:prof(C.wv),        targets:site},
      {customId:'tornado-announce',   prio:'MEDIUM', visualProfileId:prof(C.tornado),   targets:site},
      {customId:'tornado-hold',       prio:'LOW',  visualProfileId:prof(C.tornado),   targets:site},
      {customId:'lightning-announce', prio:'MEDIUM', visualProfileId:prof(C.lightning), targets:hangar},
      {customId:'lightning-hold',     prio:'LOW',  visualProfileId:prof(C.lightning), targets:hangar},
      {customId:'allclear',           prio:'HIGH', visualProfileId:prof(C.allclear),  targets:site},
      {customId:'lightning-allclear', prio:'HIGH', visualProfileId:prof(C.allclear),  targets:hangar},
      {customId:'lobby-allclear',     prio:'HIGH', visualProfileId:prof(C.allclear),  targets:lobby},
      {customId:'walk-test',          prio:'LOW',  visualProfileId:prof(C.allclear),  targets:site},
    ];
    BUTTONS=[
      {btn:7, name:'Fire',                play:'fire-announce',      fileId:aud(A.fire),      repeat:0},
      {btn:12,name:'WV',                  play:'wv-announce',        fileId:aud(A.wv),        repeat:2},
      {btn:12,name:'WV',                  play:'wv-hold',            fileId:sil60,            repeat:0},
      {btn:8, name:'Tornado',             play:'tornado-announce',   fileId:aud(A.tornado),   repeat:2},
      {btn:8, name:'Tornado',             play:'tornado-hold',       fileId:sil60,            repeat:0},
      {btn:9, name:'Lightning',           play:'lightning-announce', fileId:aud(A.lightning), repeat:2},
      {btn:9, name:'Lightning',           play:'lightning-hold',     fileId:sil60,            repeat:0},
      {btn:6, name:'Building All Clear',  stop:'fire-announce'},
      {btn:6, name:'Building All Clear',  stop:'wv-hold'},
      {btn:6, name:'Building All Clear',  stop:'wv-announce'},
      {btn:6, name:'Building All Clear',  stop:'tornado-hold'},
      {btn:6, name:'Building All Clear',  stop:'tornado-announce'},
      {btn:6, name:'Building All Clear',  stop:'lightning-hold'},
      {btn:6, name:'Building All Clear',  stop:'lightning-announce'},
      {btn:6, name:'Building All Clear',  stop:'walk-test'},
      {btn:6, name:'Building All Clear',  play:'allclear',           fileId:clr,              repeat:1},
      {btn:10,name:'Lightning All Clear', stop:'lightning-hold'},
      {btn:10,name:'Lightning All Clear', stop:'lightning-announce'},
      {btn:10,name:'Lightning All Clear', play:'lightning-allclear', fileId:lclr,              repeat:1},
      {btn:5, name:'Lobby All Clear',     play:'lobby-allclear',     fileId:clr,              repeat:1},
      {btn:3, name:'Test',                play:'walk-test',          fileIds:[tst,sil30],     repeat:testRepeat},
    ];
    console.log('%cBuilt 11 sessions + button map from names. Review, then: amp.provision() -> amp.rules()','color:#0a0;font-weight:bold');
    console.table(SESSIONS.map(s=>({customId:s.customId,prio:s.prio,visualProfileId:s.visualProfileId,targets:String(s.targets)})));
    const unresolved = SESSIONS.some(s=>s.visualProfileId==null||!s.targets.length||s.targets.some(t=>t==null)) || BUTTONS.some(b=>('fileId'in b&&b.fileId==null)||(b.fileIds&&b.fileIds.some(x=>x==null)));
    if(unresolved) console.warn('⚠ Some names did NOT match (undefined/null above). Fix the name in the build() call and re-run before provision().');
    return {SESSIONS,BUTTONS};
  },
  async fire(customId,fileId,repeat=1){const r=await api('POST',`audioSessions/custom/${customId}/playAudioFiles`,{fileIds:[String(fileId)],repeat});console.log(`fire ${customId} -> ${r.status}`);return r.status;},
  async stop(customId){const r=await api('POST',`audioSessions/custom/${customId}/stopAudioFiles`,{});console.log(`stop ${customId} -> ${r.status}`);return r.status;},
  async create(spec){const r=await api('POST','audioSessions',{visualProfileEnabled:'TRUE',type:'HTTP',...spec});console.log(`create ${spec.customId} -> ${r.status}`);return r;},
  async remove(customId){const r=await api('DELETE',`audioSessions/custom/${customId}`);console.log(`remove ${customId} -> ${r.status}`);return r.status;},
  async provision(){
    if(!SESSIONS.length){console.warn('Fill in the SESSIONS array first (use discover() to get IDs).');return;}
    for(const s of SESSIONS)await amp.create(s);
    console.log('✅ provisioned',SESSIONS.length,'sessions');
  },
};
if(typeof window!=='undefined')window.amp=amp;
if(typeof module!=='undefined')module.exports={md5,digestFetch,api,amp,get AMP_BASE(){return AMP_BASE;}};
