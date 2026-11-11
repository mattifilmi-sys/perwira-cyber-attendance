import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";
import "./style.css";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const app = document.querySelector("#app");
let currentUser = null;
let talks = [];
let audience = [];
let activeQrTalk = null;

const logo = "/nadi-cybersecurity-logo.jpg";
const esc = (v="") => String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateMY = d => d ? new Date(`${d}T00:00:00`).toLocaleDateString("ms-MY") : "-";
const fmtStamp = d => d ? new Date(d).toLocaleString("ms-MY") : "-";
const idCode = n => `PC${String(n).padStart(3,"0")}`;

function authScreen(message="") {
  app.innerHTML = `<div class="authpage"><div class="authcard">
    <img class="authlogo" src="${logo}" alt="NADI Cybersecurity">
    <div class="eyebrow">PERWIRA CYBER ATTENDANCE PORTAL</div>
    <h1>Admin Login</h1><p class="sub">Log masuk untuk menguruskan talk dan rekod kehadiran.</p>
    <div id="authMessage" class="notice ${message ? "error" : "hidden"}">${esc(message)}</div>
    <form id="loginForm">
      <div class="field"><label>Alamat e-mel</label><input name="email" type="email" required autocomplete="username" placeholder="admin@organisasi.com"></div>
      <div class="field"><label>Kata laluan</label><input name="password" type="password" required autocomplete="current-password" placeholder="Masukkan kata laluan"></div>
      <button class="primary" type="submit">Log Masuk</button>
    </form>
    <p class="sub" style="font-size:11px;margin-top:18px">Akses terhad kepada pentadbir yang telah didaftarkan.</p>
  </div></div>`;
  document.querySelector("#loginForm").addEventListener("submit", login);
}

async function login(e) {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  const button = e.currentTarget.querySelector("button");
  button.disabled = true; button.innerHTML = '<span class="spinner"></span> Sedang log masuk...';
  const { error } = await supabase.auth.signInWithPassword({
    email: form.get("email"), password: form.get("password")
  });
  if (error) { authScreen("Log masuk gagal: " + error.message); return; }
  await route();
}

async function verifyAdmin(user) {
  const { data, error } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

function shell() {
  app.innerHTML = `<div class="app">
    <aside class="side">
      <div class="brand"><div class="logo"><img src="${logo}" alt="Logo NADI Cybersecurity"></div><div><b>NADI x CYBERSECURITY</b><small>PERWIRA CYBER PORTAL</small></div></div>
      <div class="navlabel">MENU UTAMA</div>
      <nav class="nav">
        <button class="active" data-view="dashboard"><span class="ico">▦</span> Dashboard</button>
        <button data-view="talks"><span class="ico">▤</span> Pengurusan Talk</button>
        <button data-view="audience"><span class="ico">♙</span> Rekod Audience</button>
      </nav>
      <div class="sidefoot">NADI x Cybersecurity · Attendance Portal v1.0</div>
    </aside>
    <main>
      <div class="top"><div><div class="eyebrow">PENGURUSAN KEHADIRAN</div><h1 id="pageTitle">Dashboard</h1><div class="sub">Portal berpusat untuk rekod audience Talk Perwira Cyber.</div></div><div class="admin">● ${esc(currentUser.email)} &nbsp; <button id="logoutBtn" class="linkbtn">Log Keluar</button></div></div>
      <div id="globalMessage" class="notice hidden"></div>
      <section id="dashboard" class="view show">
        <div class="cards">
          <div class="stat"><span class="symbol">▤</span><div class="label">Jumlah Talk</div><strong id="statTalks">0</strong><small>Rekod talk diwujudkan</small></div>
          <div class="stat"><span class="symbol">♙</span><div class="label">Jumlah Audience</div><strong id="statAudience">0</strong><small>Rekod kehadiran diterima</small></div>
          <div class="stat"><span class="symbol">◉</span><div class="label">Lokasi NADI</div><strong id="statSites">0</strong><small>Lokasi berbeza</small></div>
          <div class="stat"><span class="symbol">✓</span><div class="label">Talk Aktif</div><strong id="statActive">0</strong><small>QR pendaftaran dibuka</small></div>
        </div>
        <div class="panel"><div class="panelhead"><div><h2>Talk terkini</h2><p>Pantau talk dan jumlah audience yang mendaftar.</p></div><button class="primary" id="createTalkBtn">＋ Cipta Talk</button></div>
          <div class="tablewrap"><table><thead><tr><th>ID</th><th>Tajuk Talk</th><th>Pusat NADI</th><th>Tarikh</th><th>Audience</th><th>Status</th><th>Tindakan</th></tr></thead><tbody id="recentRows"></tbody></table></div>
        </div>
        <div class="panel"><div class="panelhead"><div><h2>Aliran penggunaan</h2><p>Empat langkah ringkas untuk merekodkan kehadiran.</p></div></div><div class="grid2">
          <div><b>01 · Admin cipta talk</b><p>Masukkan tajuk, lokasi, tarikh dan nama penyampai.</p></div><div><b>02 · Jana QR Code</b><p>Setiap talk mempunyai pautan kehadiran unik.</p></div>
          <div><b>03 · Audience scan</b><p>Audience isi nama penuh dan alamat e-mel.</p></div><div><b>04 · Eksport rekod</b><p>Tapis rekod dan muat turun CSV.</p></div>
        </div></div>
      </section>
      <section id="talks" class="view"><div class="panel">
        <div class="panelhead"><div><h2>Pengurusan Talk</h2><p>Cipta dan urus rekod talk Perwira Cyber.</p></div><button class="primary" id="createTalkBtn2">＋ Cipta Talk Baharu</button></div>
        <div class="toolbar"><input id="talkSearch" placeholder="Cari tajuk atau Pusat NADI..."><select id="talkStatus"><option value="">Semua status</option><option value="active">Aktif</option><option value="closed">Ditutup</option></select></div>
        <div class="tablewrap"><table><thead><tr><th>ID</th><th>Tajuk Talk</th><th>Pusat NADI</th><th>Penyampai</th><th>Tarikh</th><th>Audience</th><th>Status</th><th>Tindakan</th></tr></thead><tbody id="talkRows"></tbody></table></div>
      </div></section>
      <section id="audience" class="view"><div class="panel">
        <div class="panelhead"><div><h2>Rekod Audience</h2><p>Semua pendaftaran audience daripada setiap talk.</p></div><button class="secondary" id="exportBtn">⇩ Eksport CSV</button></div>
        <div class="toolbar"><input id="audSearch" placeholder="Cari nama, e-mel atau Pusat NADI..."><select id="audTalk"><option value="">Semua talk</option></select></div>
        <div class="tablewrap"><table><thead><tr><th>Tarikh Daftar</th><th>Nama Penuh</th><th>No. Kad Pengenalan</th><th>E-mel</th><th>Tajuk Talk</th><th>Pusat NADI</th><th>ID Talk</th></tr></thead><tbody id="audRows"></tbody></table></div>
      </div></section>
    </main>
  </div>
  <div id="createModal" class="modalback"><div class="modal">
    <div class="modalhead"><h2>Cipta Talk Baharu</h2><button class="close" data-close="createModal">✕</button></div>
    <p class="sub">Lengkapkan maklumat talk untuk menjana pautan kehadiran unik.</p>
    <form id="talkForm">
      <div class="field"><label>Tajuk Talk *</label><input name="title" required maxlength="180" placeholder="Contoh: Keselamatan Siber Dalam Kehidupan Harian"></div>
      <div class="grid2"><div class="field"><label>Pusat NADI *</label><input name="site" required maxlength="140" placeholder="Nama Pusat NADI"></div><div class="field"><label>Tarikh Talk *</label><input name="date" type="date" required></div></div>
      <div class="field"><label>Nama Penyampai Perwira Cyber *</label><input name="speaker" required maxlength="140" placeholder="Nama penyampai"></div>
      <div class="field"><label>Status pendaftaran</label><select name="status"><option value="active">Aktif</option><option value="closed">Ditutup</option></select></div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px"><button type="button" class="outline" data-close="createModal">Batal</button><button class="primary" type="submit">Simpan & Jana QR</button></div>
    </form>
  </div></div>
  <div id="qrModal" class="modalback"><div class="modal">
    <div class="modalhead"><h2>QR Kehadiran Talk</h2><button class="close" data-close="qrModal">✕</button></div>
    <div id="qrDetails" class="sub"></div><div class="qrwrap" style="margin-top:18px">
      <div class="qrbox"><canvas id="qrCanvas"></canvas></div>
      <div><b>Pautan kehadiran</b><p id="qrLink" style="word-break:break-all;color:#52657a;font-size:12px"></p><div class="actions"><button class="secondary" id="copyQrLink">Salin pautan</button><button class="outline" id="downloadQr">Muat turun QR</button></div><div class="note">QR ini menggunakan URL laman web yang sedang dihoskan. Sebelum deploy ke domain awam, pautan akan menggunakan alamat hosting tersebut.</div></div>
    </div>
  </div></div>`;
  document.querySelectorAll(".nav button").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
  document.querySelector("#logoutBtn").addEventListener("click", async()=>{await supabase.auth.signOut();authScreen();});
  document.querySelector("#createTalkBtn").addEventListener("click",openCreate);
  document.querySelector("#createTalkBtn2").addEventListener("click",openCreate);
  document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.close)));
  document.querySelector("#talkForm").addEventListener("submit",createTalk);
  document.querySelector("#talkSearch").addEventListener("input",renderTalks);
  document.querySelector("#talkStatus").addEventListener("change",renderTalks);
  document.querySelector("#audSearch").addEventListener("input",renderAudience);
  document.querySelector("#audTalk").addEventListener("change",renderAudience);
  document.querySelector("#exportBtn").addEventListener("click",exportCSV);
  document.querySelector("#copyQrLink").addEventListener("click",copyQrLink);
  document.querySelector("#downloadQr").addEventListener("click",downloadQr);
}

function showView(v) {
  document.querySelectorAll(".view").forEach(x=>x.classList.remove("show"));
  document.querySelector(`#${v}`).classList.add("show");
  document.querySelectorAll(".nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===v));
  document.querySelector("#pageTitle").textContent=({dashboard:"Dashboard",talks:"Pengurusan Talk",audience:"Rekod Audience"})[v];
}
function openCreate(){document.querySelector("#talkForm").reset();document.querySelector("#createModal").classList.add("open")}
function closeModal(id){document.getElementById(id).classList.remove("open")}
function message(text,type=""){const el=document.querySelector("#globalMessage");el.textContent=text;el.className="notice "+(type==="error"?"error":type==="success"?"successnote":"");}
function countByTalk(id){return audience.filter(a=>a.talk_id===id).length}
function statusLabel(s){return s==="active"?'<span class="pill">Aktif</span>':'<span class="pill mutedpill">Ditutup</span>'}

async function loadData(){
  const [tRes,aRes]=await Promise.all([
    supabase.from("talks").select("*").order("created_at",{ascending:false}),
    supabase.from("audience_attendance").select("id,talk_id,full_name,ic_number,email,created_at").order("created_at",{ascending:false})
  ]);
  if(tRes.error) throw tRes.error;
  if(aRes.error) throw aRes.error;
  talks=tRes.data||[]; audience=aRes.data||[];
  updateDashboard();renderTalks();renderAudience();
}
function updateDashboard(){
  document.querySelector("#statTalks").textContent=talks.length;
  document.querySelector("#statAudience").textContent=audience.length;
  document.querySelector("#statSites").textContent=new Set(talks.map(t=>t.nadi_center.toLowerCase())).size;
  document.querySelector("#statActive").textContent=talks.filter(t=>t.status==="active").length;
  document.querySelector("#recentRows").innerHTML=talks.slice(0,5).map(t=>`<tr><td><b>${esc(t.talk_code)}</b></td><td>${esc(t.title)}</td><td>${esc(t.nadi_center)}</td><td>${dateMY(t.talk_date)}</td><td><b>${countByTalk(t.id)}</b></td><td>${statusLabel(t.status)}</td><td><button class="linkbtn" data-qr="${t.id}">Lihat QR</button></td></tr>`).join("")||'<tr><td colspan="7" class="empty">Belum ada talk.</td></tr>';
  document.querySelectorAll("[data-qr]").forEach(b=>b.addEventListener("click",()=>showQR(b.dataset.qr)));
}
function renderTalks(){
  if(!document.querySelector("#talkRows"))return;
  const q=(document.querySelector("#talkSearch").value||"").toLowerCase(),s=document.querySelector("#talkStatus").value;
  const rows=talks.filter(t=>(!s||t.status===s)&&`${t.title} ${t.nadi_center} ${t.talk_code} ${t.speaker_name}`.toLowerCase().includes(q));
  document.querySelector("#talkRows").innerHTML=rows.map(t=>`<tr><td><b>${esc(t.talk_code)}</b></td><td>${esc(t.title)}</td><td>${esc(t.nadi_center)}</td><td>${esc(t.speaker_name)}</td><td>${dateMY(t.talk_date)}</td><td><b>${countByTalk(t.id)}</b></td><td>${statusLabel(t.status)}</td><td><div class="actions"><button class="linkbtn" data-qr="${t.id}">QR</button><button class="linkbtn" data-toggle="${t.id}">${t.status==="active"?"Tutup":"Buka"}</button></div></td></tr>`).join("")||'<tr><td colspan="8" class="empty">Tiada rekod dijumpai.</td></tr>';
  document.querySelectorAll("[data-qr]").forEach(b=>b.addEventListener("click",()=>showQR(b.dataset.qr)));
  document.querySelectorAll("[data-toggle]").forEach(b=>b.addEventListener("click",()=>toggleStatus(b.dataset.toggle)));
}
function renderAudience(){
  if(!document.querySelector("#audRows"))return;
  const sel=document.querySelector("#audTalk"),old=sel.value;
  sel.innerHTML='<option value="">Semua talk</option>'+talks.map(t=>`<option value="${t.id}">${esc(t.talk_code)} · ${esc(t.title)}</option>`).join("");
  sel.value=old;
  const q=(document.querySelector("#audSearch").value||"").toLowerCase(),id=sel.value;
  const rows=audience.filter(a=>{const t=talks.find(x=>x.id===a.talk_id)||{};return(!id||a.talk_id===id)&&`${a.full_name} ${a.ic_number||""} ${a.email} ${t.title||""} ${t.nadi_center||""}`.toLowerCase().includes(q)});
  document.querySelector("#audRows").innerHTML=rows.map(a=>{const t=talks.find(x=>x.id===a.talk_id)||{};return `<tr><td>${fmtStamp(a.created_at)}</td><td><b>${esc(a.full_name)}</b></td><td>${esc(a.ic_number||"-")}</td><td>${esc(a.email)}</td><td>${esc(t.title||"-")}</td><td>${esc(t.nadi_center||"-")}</td><td>${esc(t.talk_code||"-")}</td></tr>`}).join("")||'<tr><td colspan="7" class="empty">Tiada rekod audience.</td></tr>';
}
async function createTalk(e){
  e.preventDefault();const form=new FormData(e.currentTarget),btn=e.currentTarget.querySelector('button[type="submit"]');
  btn.disabled=true;btn.textContent="Menyimpan...";
  try{
    const {count,error:countErr}=await supabase.from("talks").select("*",{count:"exact",head:true});
    if(countErr)throw countErr;
    const code=idCode((count||0)+1);
    const row={talk_code:code,title:form.get("title").trim(),nadi_center:form.get("site").trim(),speaker_name:form.get("speaker").trim(),talk_date:form.get("date"),status:form.get("status"),created_by:currentUser.id};
    const {data,error}=await supabase.from("talks").insert(row).select().single();
    if(error)throw error;
    closeModal("createModal");await loadData();showQR(data.id);message(`Talk ${code} berjaya disimpan.`, "success");
  }catch(err){message("Tidak berjaya menyimpan talk: "+err.message,"error")}
  finally{btn.disabled=false;btn.textContent="Simpan & Jana QR"}
}
async function toggleStatus(id){
  const t=talks.find(x=>x.id===id);if(!t)return;
  const next=t.status==="active"?"closed":"active";
  const {error}=await supabase.from("talks").update({status:next,updated_at:new Date().toISOString()}).eq("id",id);
  if(error){message("Gagal mengubah status: "+error.message,"error");return}
  await loadData();message(`Pendaftaran talk ${t.talk_code} kini ${next==="active"?"dibuka":"ditutup"}.`,"success");
}
async function showQR(id){
  const t=talks.find(x=>x.id===id);if(!t)return;
  activeQrTalk=t;
  const url=new URL(window.location.href);url.search="";url.searchParams.set("checkin",id);url.hash="";
  document.querySelector("#qrDetails").innerHTML=`<b>${esc(t.title)}</b><br>${esc(t.nadi_center)} · ${dateMY(t.talk_date)} · ${esc(t.talk_code)}`;
  document.querySelector("#qrLink").textContent=url.toString();
  await QRCode.toCanvas(document.querySelector("#qrCanvas"),url.toString(),{width:210,margin:2,errorCorrectionLevel:"H"});
  document.querySelector("#qrModal").classList.add("open");
}
async function copyQrLink(){try{await navigator.clipboard.writeText(document.querySelector("#qrLink").textContent);message("Pautan QR berjaya disalin.","success")}catch{message("Tidak dapat menyalin pautan. Salin pautan yang dipaparkan secara manual.","error")}}
function downloadQr(){const a=document.createElement("a");a.download=`QR_${activeQrTalk?.talk_code||"PerwiraCyber"}.png`;a.href=document.querySelector("#qrCanvas").toDataURL("image/png");a.click()}
function exportCSV(){
  const rows=[["Tarikh Daftar","Nama Penuh","No. Kad Pengenalan","E-mel","Tajuk Talk","Pusat NADI","ID Talk"],...audience.map(a=>{const t=talks.find(x=>x.id===a.talk_id)||{};return[a.created_at,a.full_name,a.ic_number||"",a.email,t.title||"",t.nadi_center||"",t.talk_code||""]})];
  const csv=rows.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
  const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="Perwira_Cyber_Audience.csv";a.click();URL.revokeObjectURL(a.href);
}

async function publicCheckin(id){
  const {data:talk,error}=await supabase.from("talks").select("id,talk_code,title,nadi_center,talk_date,status").eq("id",id).maybeSingle();
  app.innerHTML=`<div class="publicpage"><div class="publiccard"><img class="publiclogo" src="${logo}" alt="NADI Cybersecurity"><div class="eyebrow">PERWIRA CYBER · BORANG KEHADIRAN</div><div id="publicBody"></div></div></div>`;
  const body=document.querySelector("#publicBody");
  if(error||!talk){body.innerHTML="<h1>Talk tidak ditemui</h1><p class='sub'>Pautan QR tidak sah atau talk tidak tersedia.</p>";return}
  if(talk.status!=="active"){body.innerHTML="<h1>Pendaftaran ditutup</h1><p class='sub'>Pendaftaran untuk talk ini telah ditutup. Terima kasih.</p>";return}
  body.innerHTML=`<h1>Borang Kehadiran Audience</h1><p class="sub">${esc(talk.title)}<br>${esc(talk.nadi_center)} · ${dateMY(talk.talk_date)} · ${esc(talk.talk_code)}</p>
    <form id="checkinForm"><div class="field"><label>Nama penuh *</label><input name="name" required maxlength="150" autocomplete="name" placeholder="Nama seperti dalam sijil"></div>
    <div class="field"><label>No. Kad Pengenalan *</label><input name="ic" type="text" required maxlength="14" inputmode="numeric" autocomplete="off" placeholder="Contoh: 900101-10-1234" pattern="[0-9]{6}-?[0-9]{2}-?[0-9]{4}" title="Masukkan 12 digit nombor IC, dengan atau tanpa tanda sempang"></div>
    <div class="field"><label>Alamat e-mel *</label><input name="email" type="email" required maxlength="254" autocomplete="email" placeholder="nama@email.com"></div>
    <button class="primary" type="submit">Hantar Kehadiran</button></form>
    <p class="sub" style="font-size:11px;margin-top:16px">Nama, nombor IC dan e-mel digunakan untuk rekod penyertaan Talk Perwira Cyber sahaja. Dengan menghantar borang ini, anda bersetuju maklumat diproses bagi tujuan tersebut.</p>`;
  document.querySelector("#checkinForm").addEventListener("submit",async e=>{
    e.preventDefault();const f=new FormData(e.currentTarget),button=e.currentTarget.querySelector("button");
    button.disabled=true;button.textContent="Menghantar...";
    const icNumber=f.get("ic").trim().replace(/-/g,"");
    const {error:insertError}=await supabase.from("audience_attendance").insert({talk_id:id,full_name:f.get("name").trim(),ic_number:icNumber,email:f.get("email").trim().toLowerCase()});
    if(insertError){
      const msg=insertError.code==="23505"?"E-mel ini sudah didaftarkan untuk talk ini.":insertError.message;
      const old=document.querySelector("#checkinError");if(old)old.remove();
      const el=document.createElement("div");el.id="checkinError";el.className="notice error";el.textContent="Pendaftaran tidak berjaya: "+msg;
      e.currentTarget.prepend(el);button.disabled=false;button.textContent="Hantar Kehadiran";return;
    }
    body.innerHTML="<div class='success'><div class='check'>✓</div><h1>Kehadiran direkodkan!</h1><p class='sub'>Terima kasih kerana menyertai Talk Perwira Cyber.</p></div>";
  });
}

async function route(){
  const checkin=new URLSearchParams(location.search).get("checkin");
  if(checkin){await publicCheckin(checkin);return}
  const {data:{session}}=await supabase.auth.getSession();
  if(!session){authScreen();return}
  currentUser=session.user;
  try{
    const ok=await verifyAdmin(currentUser);
    if(!ok){await supabase.auth.signOut();authScreen("Akaun ini belum diberikan akses Admin. Sila hubungi pentadbir sistem.");return}
    shell();await loadData();
  }catch(err){authScreen("Tidak dapat mengesahkan akses admin: "+err.message)}
}
supabase.auth.onAuthStateChange((_event,session)=>{
  if(!session&&!new URLSearchParams(location.search).has("checkin"))authScreen();
});
route();
