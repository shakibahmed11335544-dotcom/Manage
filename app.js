const DB_KEY = 'hisab:pro:v1';
let state = { txns: [], view: 'home' };

const uid = () => Math.random().toString(36).slice(2,9);
const fmt = n => new Intl.NumberFormat(undefined, {minimumFractionDigits:0, maximumFractionDigits:2}).format(n);
const today = () => new Date().toISOString().slice(0,10);
const parseAmount = s => Number(String(s).replace(/[^\d.-]/g,'')) || 0;

function $(sel, root=document){ return root.querySelector(sel); }
function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

function load(){
  try{ const raw = localStorage.getItem(DB_KEY); if(raw) state.txns = JSON.parse(raw); }catch(e){ console.error(e); }
  render();
}
function save(){ localStorage.setItem(DB_KEY, JSON.stringify(state.txns)); }

function totals(){
  let income=0, expense=0;
  state.txns.forEach(t => { if(t.type==='in') income+=t.amount; else expense+=t.amount; });
  return { income, expense, balance: income - expense };
}

function setView(v){
  state.view = v;
  $all('.page').forEach(p => p.style.display = p.id === v ? 'block' : 'none');
  $all('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view===v));
  if(v==='home') render();
  if(v==='transactions') renderList();
  if(v==='settings') renderSettings();
}

function render(){
  const {income, expense, balance} = totals();
  $('#bal-val').textContent = fmt(balance);
  $('#inc-val').textContent = fmt(income);
  $('#exp-val').textContent = fmt(expense);
  renderList();
}

function renderList(){
  const wrap = $('#txn-wrap');
  wrap.innerHTML = '';
  const list = state.txns.slice().sort((a,b)=> new Date(b.date) - new Date(a.date));
  if(list.length===0){ wrap.innerHTML = '<div class="card"><div class="footer-note">কোনো ট্রানজেকশন নেই — নিচের + বাটন চাপুন।</div></div>'; return; }
  list.forEach(t => {
    const el = document.createElement('div'); el.className='txn card';
    el.innerHTML = `
      <div class="icon">${t.type==='in'?'+':'-'}</div>
      <div class="meta">
        <div class="title">${escapeHtml(t.name|| (t.type==='in'?'Income':'Expense'))}</div>
        <div class="sub">${escapeHtml(t.category||'General')} • ${t.date}</div>
      </div>
      <div class="amt ${t.type==='in'?'pos':'neg'}">${t.type==='in'?'+':'-'} ${fmt(t.amount)}</div>
    `;
    el.addEventListener('click', ()=> openEdit(t.id));
    wrap.appendChild(el);
  });
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// bottom sheet modal
function openAdd(){
  $('#sheet').classList.add('open'); $('#sheet-form').reset(); $('#txn-id').value = '';
  $('#txn-date').value = today();
  $('#submit-sheet').textContent = 'Add';
}
function openEdit(id){
  const t = state.txns.find(x=>x.id===id); if(!t) return;
  $('#sheet').classList.add('open');
  $('#txn-id').value = t.id;
  $('#txn-type').value = t.type;
  $('#txn-date').value = t.date;
  $('#txn-amount').value = t.amount;
  $('#txn-name').value = t.name;
  $('#txn-cat').value = t.category;
  $('#txn-note').value = t.notes;
  $('#submit-sheet').textContent = 'Update';
}
function closeSheet(){ $('#sheet').classList.remove('open'); }

$('#fab').addEventListener('click', openAdd);
$('#sheet-close').addEventListener('click', closeSheet);
$('#sheet').addEventListener('click', (e)=> { if(e.target.id==='sheet') closeSheet(); });

$('#sheet-form').addEventListener('submit', (e)=>{
  e.preventDefault();
  const id = $('#txn-id').value || uid();
  const t = {
    id, type: $('#txn-type').value, date: $('#txn-date').value, amount: parseAmount($('#txn-amount').value),
    name: $('#txn-name').value.trim(), category: $('#txn-cat').value.trim(), notes: $('#txn-note').value.trim()
  };
  const i = state.txns.findIndex(x=>x.id===id);
  if(i>=0) state.txns[i]=t; else state.txns.push(t);
  save(); render(); closeSheet();
});

$('#delete-txn').addEventListener('click', ()=>{
  const id = $('#txn-id').value; if(!id) return closeSheet();
  state.txns = state.txns.filter(x=>x.id!==id); save(); render(); closeSheet();
});

// nav
$all('.nav-item').forEach(n => n.addEventListener('click', ()=> setView(n.dataset.view)));

// export CSV/JSON
$('#export-json').addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(state.txns, null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `hisab-pro-${Date.now()}.json`; a.click(); URL.revokeObjectURL(a.href);
});
$('#export-csv').addEventListener('click', ()=>{
  const rows = [['id','type','date','amount','name','category','notes']];
  state.txns.forEach(t => rows.push([t.id,t.type,t.date,t.amount,`"${(t.name||'').replace(/"/g,'""')}"`,`"${(t.category||'').replace(/"/g,'""')}"`,`"${(t.notes||'').replace(/"/g,'""')}"`]));
  const csv = rows.map(r=> r.join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `hisab-pro-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(a.href);
});

// import
$('#import-file').addEventListener('change', (e)=>{
  const f = e.target.files?.[0]; if(!f) return;
  const r = new FileReader(); r.onload = ()=>{ try{ const data = JSON.parse(r.result); if(Array.isArray(data)){ state.txns = data.map(x=>({...x, id: x.id||uid()})); save(); render(); alert('Import successful'); } else alert('Invalid file'); }catch(err){ alert('Invalid JSON'); }}; r.readAsText(f);
});

// settings
function toggleTheme(){
  document.body.classList.toggle('light');
  const on = document.body.classList.contains('light'); localStorage.setItem('hisab:light', on? '1':'0');
}
$('#theme-toggle').addEventListener('click', toggleTheme);
if(localStorage.getItem('hisab:light') === '1') document.body.classList.add('light');

function renderSettings(){
  $('#settings-wrap').innerHTML = '';
  const el = document.createElement('div'); el.className='settings';
  el.innerHTML = `
    <div class="toggle"><div>Auto theme</div><div><button id="theme-toggle" class="small-btn">Toggle</button></div></div>
    <div class="toggle"><div>Export JSON</div><div><button id="export-json" class="small-btn">Export</button></div></div>
    <div class="toggle"><div>Export CSV</div><div><button id="export-csv" class="small-btn">Export</button></div></div>
    <div class="toggle"><div>Import JSON</div><div><input id="import-file" type="file" accept="application/json"></div></div>
    <div class="toggle"><div>Clear all data</div><div><button id="clear-data" class="small-btn">Clear</button></div></div>
  `;
  $('#settings-wrap').appendChild(el);
  document.getElementById('clear-data').addEventListener('click', ()=>{ if(confirm('Are you sure?')){ state.txns=[]; save(); render(); alert('Cleared'); }});
  document.getElementById('export-json').addEventListener('click', ()=> $('#export-json').click());
  document.getElementById('export-csv').addEventListener('click', ()=> $('#export-csv').click());
}

// init PWA service worker
if('serviceWorker' in navigator){ window.addEventListener('load', ()=> navigator.serviceWorker.register('./sw.js').catch(()=>{})); }

load(); setView('home');