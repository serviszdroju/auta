import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendEmailVerification, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js";

const firebaseConfig={apiKey:"AIzaSyDLp49Ln3VX_IE2SlVjwfAexgHb2H6JZV4",authDomain:"szz-auta.firebaseapp.com",projectId:"szz-auta",storageBucket:"szz-auta.firebasestorage.app",messagingSenderId:"533024293369",appId:"1:533024293369:web:17bc6285fc6c850132bd28",measurementId:"G-X0X2GSJ9E6"};
const firebaseApp=initializeApp(firebaseConfig);
const auth=getAuth(firebaseApp),db=getFirestore(firebaseApp),storage=getStorage(firebaseApp);
const stateRef=doc(db,"app","state");
let unsubscribeState=null;
let currentProfile=null;
const KEY='szz-fleet-v1';
const APP_BASE=location.origin+location.pathname.replace(/[^/]*$/,'');
const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const iso=d=>new Date(d).toISOString().slice(0,10); const today=()=>iso(new Date());
const uid=()=>crypto.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
const fmtDate=v=>v?new Intl.DateTimeFormat('cs-CZ').format(new Date(v+'T12:00:00')):'—';
const fmtDateTime=v=>v?new Intl.DateTimeFormat('cs-CZ',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—';
const escapeHtml=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function addDays(n){const d=new Date();d.setDate(d.getDate()+n);return iso(d)}
const seed={vehicles:[
{id:uid(),plate:'5AZ 2147',czTollFrom:addDays(-30),czTollTo:addDays(335),skTollFrom:'',skTollTo:'',insuranceFrom:addDays(-120),insuranceTo:addDays(245),documents:{},name:'Škoda Octavia',type:'Osobní',mileage:146200,stk:addDays(110),serviceDate:addDays(42),status:'free',driver:'',returnAt:'',note:''},
{id:uid(),plate:'8BK 5521',czTollFrom:addDays(-20),czTollTo:addDays(345),skTollFrom:addDays(-10),skTollTo:addDays(355),insuranceFrom:addDays(-90),insuranceTo:addDays(275),documents:{},name:'Ford Transit',type:'Dodávka',mileage:218540,stk:addDays(21),serviceDate:addDays(75),status:'used',driver:'Petr Novák',returnAt:new Date(Date.now()+8*3600000).toISOString(),note:''},
{id:uid(),plate:'2BM 9034',czTollFrom:'',czTollTo:'',skTollFrom:'',skTollTo:'',insuranceFrom:addDays(-200),insuranceTo:addDays(165),documents:{},name:'Renault Master',type:'Dodávka',mileage:189100,stk:addDays(180),serviceDate:addDays(-3),status:'service',driver:'',returnAt:'',note:'Objednáno do servisu'}
],reservations:[],issues:[],history:[]};
let data=structuredClone(seed),filter='all',editingId=null,modalMode='',cloudReady=false;
async function save(){if(!auth.currentUser)throw new Error('Nejste přihlášen.');await setDoc(stateRef,{vehicles:data.vehicles,reservations:data.reservations,issues:data.issues,history:data.history,updatedAt:serverTimestamp(),updatedBy:auth.currentUser.email},{merge:false});renderAll()}
function vehicle(id){return data.vehicles.find(v=>v.id===id)}
function daysTo(v){if(!v)return 9999;return Math.ceil((new Date(v+'T12:00:00')-new Date())/86400000)}
function statusLabel(s){return({free:'Volné',used:'Právě používáno',reserved:'Rezervované',service:'Mimo provoz'})[s]||s}
function showToast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}
function canEditVehicleData(){return currentProfile?.approved===true&&(currentProfile?.role==='admin'||currentProfile?.canEditVehicles===true)}
function renderAll(){renderStats();renderAlerts();renderVehicles();renderVehiclesAll();renderReservations();renderIssues();renderHistory();applyVehicleEditUi();if(currentProfile?.role==='admin'){renderPendingUsers();renderUserPermissions()}}
function renderStats(){const counts={all:data.vehicles.length,free:0,used:0,reserved:0,service:0};data.vehicles.forEach(v=>counts[v.status]++);$('#stats').innerHTML=[['all','Celkem vozidel'],['free','Volná'],['used','Používaná'],['service','Mimo provoz']].map(([k,l])=>`<article class="stat"><strong>${counts[k]||0}</strong><span>${l}</span></article>`).join('')}
function renderAlerts(){const alerts=[];data.vehicles.forEach(v=>{const s=daysTo(v.stk),srv=daysTo(v.serviceDate);if(s<0)alerts.push(`${v.plate}: STK je po termínu`);else if(s<=30)alerts.push(`${v.plate}: STK za ${s} dní`);const cz=daysTo(v.czTollTo),sk=daysTo(v.skTollTo),ins=daysTo(v.insuranceTo);if(v.czTollTo&&cz<=30)alerts.push(`${v.plate}: česká známka ${cz<0?'je po termínu':`končí za ${cz} dní`}`);if(v.skTollTo&&sk<=30)alerts.push(`${v.plate}: slovenská známka ${sk<0?'je po termínu':`končí za ${sk} dní`}`);if(v.insuranceTo&&ins<=30)alerts.push(`${v.plate}: pojištění ${ins<0?'je po termínu':`končí za ${ins} dní`}`);if(srv<0)alerts.push(`${v.plate}: servis je po termínu`);else if(srv<=14)alerts.push(`${v.plate}: servis za ${srv} dní`)});$('#alertsPanel').innerHTML=alerts.length?`<strong>Upozornění:</strong> ${alerts.map(escapeHtml).join(' · ')}`:''}
function renderVehicles(){const q=$('#vehicleSearch').value.trim().toLowerCase();const items=data.vehicles.filter(v=>(filter==='all'||v.status===filter)&&[v.plate,v.name,v.driver].join(' ').toLowerCase().includes(q));$('#vehicleList').innerHTML=items.length?items.map(v=>{const main=v.status==='free'?`<button class="main-action" onclick="openTake('${v.id}')">Převzít</button>`:v.status==='used'?`<button class="main-action" onclick="openReturn('${v.id}')">Vrátit</button>`:`<button class="main-action" onclick="openReservation('${v.id}')">Rezervovat</button>`;return `<article class="vehicle-card"><div class="vehicle-top"><span class="status-dot status-${v.status}"></span><div class="vehicle-title"><h3>${escapeHtml(v.name)}</h3><div class="plate">${escapeHtml(v.plate)}</div></div><span class="badge">${escapeHtml(v.type)}</span></div><div class="vehicle-state"><strong>${statusLabel(v.status)}</strong><span class="muted">${v.driver?escapeHtml(v.driver):escapeHtml(v.note||'Vozidlo je k dispozici')}</span></div><div class="info-grid"><div>Stav km<strong>${Number(v.mileage).toLocaleString('cs-CZ')} km</strong></div><div>STK do<strong>${fmtDate(v.stk)}</strong></div><div>ČR známka<strong>${v.czTollTo?fmtDate(v.czTollTo):'Není evidována'}</strong></div><div>Pojištění do<strong>${fmtDate(v.insuranceTo)}</strong></div><div>Vrácení<strong>${v.returnAt?fmtDateTime(v.returnAt):'—'}</strong></div></div><div class="card-actions">${main}<button onclick="openVehicle('${v.id}')">${canEditVehicleData()?'Upravit':'Detail'}</button><button class="qr-button" onclick="openQr('${v.id}')">QR kód vozidla</button></div></article>`}).join(''):`<div class="empty">Žádné vozidlo neodpovídá zvolenému filtru.</div>`}
function vehicleCard(v){const main=v.status==='free'?`<button class="main-action" onclick="openTake('${v.id}')">Převzít</button>`:v.status==='used'?`<button class="main-action" onclick="openReturn('${v.id}')">Vrátit</button>`:`<button class="main-action" onclick="openReservation('${v.id}')">Rezervovat</button>`;return `<article class="vehicle-card"><div class="vehicle-top"><span class="status-dot status-${v.status}"></span><div class="vehicle-title"><h3>${escapeHtml(v.name)}</h3><div class="plate">${escapeHtml(v.plate)}</div></div><span class="badge">${escapeHtml(v.type)}</span></div><div class="vehicle-state"><strong>${statusLabel(v.status)}</strong><span class="muted">${v.driver?escapeHtml(v.driver):escapeHtml(v.note||'Vozidlo je k dispozici')}</span></div><div class="info-grid"><div>Stav km<strong>${Number(v.mileage).toLocaleString('cs-CZ')} km</strong></div><div>STK do<strong>${fmtDate(v.stk)}</strong></div><div>VIN<strong>${escapeHtml(v.vin||'—')}</strong></div><div>Pojištění do<strong>${fmtDate(v.insuranceTo)}</strong></div><div>Palivo<strong>${escapeHtml(v.fuel||'—')}</strong></div><div>Vrácení<strong>${v.returnAt?fmtDateTime(v.returnAt):'—'}</strong></div></div><div class="card-actions">${main}<button onclick="openVehicle('${v.id}')">${canEditVehicleData()?'Upravit':'Detail'}</button><button class="qr-button" onclick="openQr('${v.id}')">QR kód vozidla</button></div></article>`}
function renderVehiclesAll(){const target=$('#vehicleListAll');if(!target)return;const q=($('#vehicleSearchAll')?.value||'').trim().toLowerCase();const items=data.vehicles.filter(v=>[v.plate,v.vin,v.name,v.driver,v.fuel].join(' ').toLowerCase().includes(q));target.innerHTML=items.length?items.map(vehicleCard).join(''):`<div class="empty">Žádné vozidlo nebylo nalezeno.</div>`}
function renderHistory(){const target=$('#historyList');if(!target)return;const rows=[...data.history].sort((a,b)=>new Date(b.at)-new Date(a.at));target.innerHTML=rows.length?rows.map(h=>{const v=vehicle(h.vehicleId);const title=h.type==='take'?'Převzetí vozidla':'Vrácení vozidla';return `<article class="list-item"><span class="history-icon">${h.type==='take'?'→':'←'}</span><div class="grow"><h3>${title}: ${escapeHtml(v?.name||'Neznámé vozidlo')} · ${escapeHtml(v?.plate||'')}</h3><div class="list-meta"><span>${fmtDateTime(h.at)}</span><span>${escapeHtml(h.driver||'')}</span><span>${Number(h.mileage||0).toLocaleString('cs-CZ')} km</span></div>${h.purpose?`<p class="muted" style="margin:8px 0 0">${escapeHtml(h.purpose)}</p>`:''}</div></article>`}).join(''):`<div class="empty">Zatím není uložená žádná historie.</div>`}
function renderReservations(){const sorted=[...data.reservations].sort((a,b)=>new Date(a.from)-new Date(b.from));$('#reservationList').innerHTML=sorted.length?sorted.map(r=>{const v=vehicle(r.vehicleId);return `<article class="list-item"><span class="status-dot status-reserved"></span><div class="grow"><h3>${escapeHtml(v?.name||'Neznámé vozidlo')} · ${escapeHtml(v?.plate||'')}</h3><div class="list-meta"><span>${fmtDateTime(r.from)} – ${fmtDateTime(r.to)}</span><span>${escapeHtml(r.driver)}</span><span>${escapeHtml(r.purpose||'Bez účelu')}</span></div></div><button class="secondary" onclick="deleteReservation('${r.id}')">Zrušit</button></article>`}).join(''):`<div class="empty">Zatím nejsou naplánované žádné rezervace.</div>`}
function renderIssues(){const open=data.issues.filter(i=>i.state!=='closed');$('#issueList').innerHTML=open.length?open.map(i=>{const v=vehicle(i.vehicleId);return `<article class="list-item"><span class="severity severity-${i.severity}">${({low:'Drobná',medium:'Důležitá',high:'Závažná'})[i.severity]}</span><div class="grow"><h3>${escapeHtml(i.title)}</h3><div class="list-meta"><span>${escapeHtml(v?.name||'')} · ${escapeHtml(v?.plate||'')}</span><span>Nahlásil: ${escapeHtml(i.reporter)}</span><span>${fmtDate(i.date)}</span></div><p class="muted" style="margin:8px 0 0">${escapeHtml(i.description||'')}</p></div><button class="secondary" onclick="closeIssue('${i.id}')">Vyřešeno</button></article>`}).join(''):`<div class="empty">Nejsou evidované žádné otevřené závady.</div>`}
function openModal(mode,title,eyebrow,body,submit='Uložit'){modalMode=mode;$('#modalTitle').textContent=title;$('#modalEyebrow').textContent=eyebrow;$('#modalBody').innerHTML=body;$('#modalSubmit').textContent=submit;$('#modal').showModal()}

function cameraField(currentMileage){return `<div class="camera-box"><label for="fOdometerPhoto">Vyfotit tachometr</label><input id="fOdometerPhoto" type="file" accept="image/*" capture="environment"><img id="odometerPreview" class="camera-preview" alt="Náhled fotografie tachometru"><div class="ocr-row"><button type="button" class="secondary" id="readOdometerBtn">Přečíst kilometry z fotografie</button><span id="ocrStatus" class="ocr-status">Fotografie se nikam neodesílá mimo OCR službu v prohlížeči.</span></div><p class="ocr-tip">Vyfoť pouze displej tachometru, rovně a bez odlesku. Rozpoznanou hodnotu vždy před uložením zkontroluj.</p></div>`}
function setupOcr(currentMileage){const input=$('#fOdometerPhoto'),preview=$('#odometerPreview'),btn=$('#readOdometerBtn'),status=$('#ocrStatus');if(!input||!btn)return;input.onchange=()=>{const f=input.files?.[0];if(!f)return;preview.src=URL.createObjectURL(f);preview.style.display='block';status.textContent='Fotografie je připravena.'};btn.onclick=async()=>{const f=input.files?.[0];if(!f){showToast('Nejdříve vyfoť tachometr.');return}if(!window.Tesseract){showToast('OCR knihovna se nenačetla. Zkontroluj internet.');return}btn.classList.add('ocr-working');status.textContent='Rozpoznávám čísla z fotografie…';try{const result=await Tesseract.recognize(f,'eng',{logger:m=>{if(m.status==='recognizing text')status.textContent=`Rozpoznávám… ${Math.round((m.progress||0)*100)} %`}});const raw=result.data.text||'';const values=(raw.match(/\d[\d .]{2,8}\d|\d{3,7}/g)||[]).map(x=>Number(x.replace(/\D/g,''))).filter(n=>Number.isFinite(n)&&n>=0&&n<2000000);const plausible=values.filter(n=>n>=Number(currentMileage||0));const picked=(plausible.length?plausible:values).sort((a,b)=>b-a)[0];if(!picked)throw new Error('Číslo se nepodařilo najít.');$('#fMileage').value=picked;status.textContent=`Rozpoznáno: ${picked.toLocaleString('cs-CZ')} km. Zkontroluj hodnotu.`;showToast('Kilometry byly doplněny z fotografie.')}catch(e){status.textContent='Rozpoznání se nepodařilo. Zkus ostřejší fotografii nebo hodnotu napiš ručně.';showToast('Tachometr se nepodařilo přečíst.')}finally{btn.classList.remove('ocr-working')}}}
window.openQr=id=>{const v=vehicle(id);const url=APP_BASE+'?vehicle='+encodeURIComponent(id);openModal('qr','QR kód vozidla',`${v.name} · ${v.plate}`,`<div class="qr-wrap"><div id="qrCode"></div><strong>Naskenováním se otevře toto vozidlo</strong><div class="qr-url">${escapeHtml(url)}</div><button type="button" class="primary" id="downloadQrBtn">Stáhnout QR kód</button></div>`,'Zavřít');$('#modalSubmit').type='button';setTimeout(()=>{const el=$('#qrCode');if(window.QRCode){new QRCode(el,{text:url,width:260,height:260,correctLevel:QRCode.CorrectLevel.H});$('#downloadQrBtn').onclick=()=>{const img=el.querySelector('img')||el.querySelector('canvas');const href=img.tagName==='CANVAS'?img.toDataURL('image/png'):img.src;const a=document.createElement('a');a.href=href;a.download=`QR-${v.plate.replace(/\s/g,'-')}.png`;a.click()}}else el.textContent='QR knihovna se nenačetla.'},50)};

async function uploadDocument(file,vehicleId,key){if(!file)return null;if(file.size>10*1024*1024)throw new Error('Soubor je příliš velký. Maximum je 10 MB.');const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');const path=`vehicles/${vehicleId}/${key}/${Date.now()}-${safe}`;const r=storageRef(storage,path);await uploadBytes(r,file,{contentType:file.type});return {name:file.name,type:file.type,url:await getDownloadURL(r),path}}
function docLine(v,key,label){const d=v?.documents?.[key];return `<div class="doc-line"><span>${label}</span>${d?`<a href="${d.url}" target="_blank" rel="noopener">Otevřít / stáhnout</a>`:'<em>Nenahráno</em>'}</div>`}
function fileField(label,id){return `<div class="field full"><label>${label}</label><input id="${id}" type="file" accept="image/*,.pdf"></div>`}
function field(label,id,type='text',value='',extra='',full=''){return `<div class="field ${full}"><label for="${id}">${label}</label><input id="${id}" type="${type}" value="${escapeHtml(value)}" ${extra}></div>`}
window.openVehicle=id=>{const v=id?vehicle(id):null;if(!canEditVehicleData()){if(!v){showToast('K přidávání vozidel nemáte oprávnění.');return}editingId=id;openModal('vehicle-readonly','Detail vozidla',`${v.name} · ${v.plate}`,`<div class="form-grid readonly-detail"><div class="detail-row"><span>SPZ</span><strong>${escapeHtml(v.plate)}</strong></div><div class="detail-row"><span>Značka a model</span><strong>${escapeHtml(v.name)}</strong></div><div class="detail-row"><span>VIN</span><strong>${escapeHtml(v.vin||'—')}</strong></div><div class="detail-row"><span>Rok výroby</span><strong>${escapeHtml(v.year||'—')}</strong></div><div class="detail-row"><span>Palivo</span><strong>${escapeHtml(v.fuel||'—')}</strong></div><div class="detail-row"><span>Aktuální stav</span><strong>${Number(v.mileage||0).toLocaleString('cs-CZ')} km</strong></div><div class="detail-row"><span>STK do</span><strong>${fmtDate(v.stk)}</strong></div><div class="detail-row"><span>Servis do</span><strong>${fmtDate(v.serviceDate)}</strong></div><div class="detail-row"><span>Česká známka do</span><strong>${fmtDate(v.czTollTo)}</strong></div><div class="detail-row"><span>Slovenská známka do</span><strong>${fmtDate(v.skTollTo)}</strong></div><div class="detail-row"><span>Pojištění do</span><strong>${fmtDate(v.insuranceTo)}</strong></div><div class="full document-list">${docLine(v,'greenCard','Zelená karta')}${docLine(v,'techLarge','Velký technický průkaz')}${docLine(v,'techSmall','Malý technický průkaz')}</div><div class="detail-row full"><span>Poznámka</span><strong>${escapeHtml(v.note||'—')}</strong></div></div>`,'Zavřít');$('#modalSubmit').type='button';return}editingId=id||null;$('#modalSubmit').type='submit';openModal('vehicle',v?'Upravit vozidlo':'Přidat vozidlo','Vozový park',`<div class="form-grid">${field('SPZ','fPlate','text',v?.plate||'','required')}${field('Značka a model','fName','text',v?.name||'','required')}
<div class="field"><label>Typ</label><select id="fType"><option ${v?.type==='Osobní'?'selected':''}>Osobní</option><option ${v?.type==='Dodávka'?'selected':''}>Dodávka</option></select></div>${field('Aktuální stav km','fMileage','number',v?.mileage||0,'min="0" required')}${field('STK do','fStk','date',v?.stk||'')}${field('Servis do','fService','date',v?.serviceDate||'')}
<div class="section-title full">Dálniční známky</div>${field('Česká známka od','fCzFrom','date',v?.czTollFrom||'')}${field('Česká známka do','fCzTo','date',v?.czTollTo||'')}${field('Slovenská známka od','fSkFrom','date',v?.skTollFrom||'')}${field('Slovenská známka do','fSkTo','date',v?.skTollTo||'')}
<div class="section-title full">Pojištění</div>${field('Pojištění od','fInsuranceFrom','date',v?.insuranceFrom||'')}${field('Pojištění do','fInsuranceTo','date',v?.insuranceTo||'')}
<div class="section-title full">Dokumenty</div><div class="full document-list">${docLine(v,'greenCard','Zelená karta')}${docLine(v,'techLarge','Velký technický průkaz')}${docLine(v,'techSmall','Malý technický průkaz')}</div>${fileField('Nahrát zelenou kartu','fGreenCard')}${fileField('Nahrát velký technický průkaz','fTechLarge')}${fileField('Nahrát malý technický průkaz','fTechSmall')}
<div class="field"><label>Stav</label><select id="fStatus"><option value="free" ${v?.status==='free'?'selected':''}>Volné</option><option value="reserved" ${v?.status==='reserved'?'selected':''}>Rezervované</option><option value="used" ${v?.status==='used'?'selected':''}>Používané</option><option value="service" ${v?.status==='service'?'selected':''}>Mimo provoz</option></select></div>${field('Poznámka','fNote','text',v?.note||'','','full')}</div>`) };
window.openTake=id=>{editingId=id;const v=vehicle(id);openModal('take','Převzít vozidlo',`${v.name} · ${v.plate}`,`<div class="form-grid">${field('Jméno řidiče','fDriver','text','','required')}${field('Stav kilometrů','fMileage','number',v.mileage,'min="0" required')}${field('Plánované vrácení','fReturn','datetime-local','','required')}${field('Účel použití','fPurpose','text','','placeholder="např. servis zákazníka"','full')}${cameraField(v.mileage)}</div>`,'Převzít');setupOcr(v.mileage)};
window.openReturn=id=>{editingId=id;const v=vehicle(id);openModal('return','Vrátit vozidlo',`${v.name} · ${v.plate}`,`<div class="form-grid">${field('Nový stav kilometrů','fMileage','number',v.mileage,'min="'+v.mileage+'" required')}
<div class="field"><label>Stav vozidla</label><select id="fCondition"><option value="ok">V pořádku</option><option value="issue">Nahlásit závadu</option></select></div>${field('Poznámka','fNote','text','','','full')}${cameraField(v.mileage)}</div>`,'Vrátit');setupOcr(v.mileage)};
window.openReservation=id=>{editingId=id||null;openModal('reservation','Nová rezervace','Plánování',`<div class="form-grid"><div class="field full"><label>Vozidlo</label><select id="fVehicle" required><option value="">Vyberte vozidlo</option>${data.vehicles.filter(v=>v.status!=='service').map(v=>`<option value="${v.id}" ${id===v.id?'selected':''}>${escapeHtml(v.name)} · ${escapeHtml(v.plate)}</option>`).join('')}</select></div>${field('Řidič','fDriver','text','','required')}${field('Účel','fPurpose','text','')}${field('Od','fFrom','datetime-local','','required')}${field('Do','fTo','datetime-local','','required')}</div>`,'Rezervovat')};
window.openIssue=()=>openModal('issue','Nahlásit závadu','Technický stav',`<div class="form-grid"><div class="field full"><label>Vozidlo</label><select id="fVehicle" required><option value="">Vyberte vozidlo</option>${data.vehicles.map(v=>`<option value="${v.id}">${escapeHtml(v.name)} · ${escapeHtml(v.plate)}</option>`).join('')}</select></div>${field('Název závady','fTitle','text','','required')}${field('Nahlásil','fReporter','text','','required')}<div class="field"><label>Závažnost</label><select id="fSeverity"><option value="low">Drobná</option><option value="medium">Důležitá</option><option value="high">Závažná – nepoužívat</option></select></div><div class="field full"><label>Popis</label><textarea id="fDescription"></textarea></div></div>`,'Nahlásit');
$('#modalForm').addEventListener('submit',async e=>{e.preventDefault();if(modalMode==='qr'||modalMode==='vehicle-readonly'){$('#modal').close();$('#modalSubmit').type='submit';return}try{if(modalMode==='vehicle'){if(!canEditVehicleData())throw new Error('K úpravě údajů vozidla nemáte oprávnění.');const current=editingId?vehicle(editingId):{};current.id=current.id||uid();const docs=current.documents||{};const green=await uploadDocument($('#fGreenCard').files?.[0],current.id,'greenCard');const large=await uploadDocument($('#fTechLarge').files?.[0],current.id,'techLarge');const small=await uploadDocument($('#fTechSmall').files?.[0],current.id,'techSmall');if(green)docs.greenCard=green;if(large)docs.techLarge=large;if(small)docs.techSmall=small;Object.assign(current,{id:current.id,plate:$('#fPlate').value.trim().toUpperCase(),name:$('#fName').value.trim(),vin:$('#fVin')?.value.trim().toUpperCase()||'',year:+($('#fYear')?.value||0)||'',fuel:$('#fFuel')?.value.trim()||'',type:$('#fType').value,mileage:+$('#fMileage').value,stk:$('#fStk').value,serviceDate:$('#fService').value,czTollFrom:$('#fCzFrom').value,czTollTo:$('#fCzTo').value,skTollFrom:$('#fSkFrom').value,skTollTo:$('#fSkTo').value,insuranceFrom:$('#fInsuranceFrom').value,insuranceTo:$('#fInsuranceTo').value,documents:docs,status:$('#fStatus').value,note:$('#fNote').value.trim(),driver:current.driver||'',returnAt:current.returnAt||''});if(!editingId)data.vehicles.push(current)}
if(modalMode==='take'){const v=vehicle(editingId);v.status='used';v.driver=$('#fDriver').value.trim();v.mileage=+$('#fMileage').value;v.returnAt=$('#fReturn').value?new Date($('#fReturn').value).toISOString():'';data.history.push({id:uid(),vehicleId:v.id,type:'take',at:new Date().toISOString(),driver:v.driver,mileage:v.mileage,purpose:$('#fPurpose').value.trim()})}
if(modalMode==='return'){const v=vehicle(editingId),driver=v.driver;v.mileage=+$('#fMileage').value;v.status='free';v.driver='';v.returnAt='';data.history.push({id:uid(),vehicleId:v.id,type:'return',at:new Date().toISOString(),driver,mileage:v.mileage,note:$('#fNote').value.trim()});if($('#fCondition').value==='issue'){data.issues.push({id:uid(),vehicleId:v.id,title:'Závada při vrácení',reporter:driver,date:today(),severity:'medium',description:$('#fNote').value.trim(),state:'open'})}}
if(modalMode==='reservation'){const from=$('#fFrom').value,to=$('#fTo').value;if(new Date(to)<=new Date(from))throw new Error('Čas vrácení musí být později než převzetí.');const vehicleId=$('#fVehicle').value;const collision=data.reservations.some(r=>r.vehicleId===vehicleId&&new Date(from)<new Date(r.to)&&new Date(to)>new Date(r.from));if(collision)throw new Error('Vozidlo je v tomto termínu už rezervované.');data.reservations.push({id:uid(),vehicleId,driver:$('#fDriver').value.trim(),purpose:$('#fPurpose').value.trim(),from:new Date(from).toISOString(),to:new Date(to).toISOString()})}
if(modalMode==='issue'){const sev=$('#fSeverity').value,v=vehicle($('#fVehicle').value);data.issues.push({id:uid(),vehicleId:v.id,title:$('#fTitle').value.trim(),reporter:$('#fReporter').value.trim(),date:today(),severity:sev,description:$('#fDescription').value.trim(),state:'open'});if(sev==='high'){v.status='service';v.note='Závažná závada'}}save();$('#modal').close();showToast('Změny byly uloženy.')}catch(err){showToast(err.message)}});
window.deleteReservation=id=>{if(confirm('Opravdu zrušit rezervaci?')){data.reservations=data.reservations.filter(r=>r.id!==id);save().then(()=>showToast('Rezervace byla zrušena.')).catch(e=>showToast(e.message))}};
window.closeIssue=id=>{const i=data.issues.find(x=>x.id===id);i.state='closed';i.closedAt=new Date().toISOString();save().then(()=>showToast('Závada byla označena jako vyřešená.')).catch(e=>showToast(e.message))};
$$('[data-close]').forEach(b=>b.onclick=()=>{$('#modal').close();$('#modalSubmit').type='submit'});$$('[data-open="vehicle"]').forEach(b=>b.onclick=()=>openVehicle());$$('[data-open="reservation"]').forEach(b=>b.onclick=()=>openReservation());$$('[data-open="issue"]').forEach(b=>b.onclick=openIssue);
$('#vehicleFilters').addEventListener('click',e=>{if(!e.target.dataset.filter)return;filter=e.target.dataset.filter;$$('#vehicleFilters button').forEach(b=>b.classList.toggle('active',b===e.target));renderVehicles()});$('#vehicleSearch').addEventListener('input',renderVehicles);$('#vehicleSearchAll')?.addEventListener('input',renderVehiclesAll);
function navigate(){const h=location.hash||'#prehled',map={'#prehled':'dashboard','#vozidla':'vehicles','#rezervace':'reservations','#zavady':'issues','#historie':'history','#sprava':'admin'},v=map[h]||'dashboard';$$('.view').forEach(x=>x.classList.toggle('active',x.id===v+'View'));$$('.main-nav a').forEach(a=>a.classList.toggle('active',a.dataset.view===v));$('#mainNav').classList.remove('open')}window.addEventListener('hashchange',navigate);navigate();
$('#mobileMenuBtn').onclick=()=>$('#mainNav').classList.toggle('open');
$('#exportBtn').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download=`szz-vozovy-park-${today()}.json`;a.click();URL.revokeObjectURL(a.href)};
$('#importInput').onchange=async e=>{try{const parsed=JSON.parse(await e.target.files[0].text());if(!parsed.vehicles)throw new Error();data=parsed;await save();showToast('Záloha byla načtena.')}catch{showToast('Soubor není platná záloha.')}e.target.value=''};
$('#resetBtn').onclick=()=>{if(confirm('Opravdu obnovit ukázková data?')){data=structuredClone(seed);save().then(()=>showToast('Ukázková data byla obnovena.')).catch(e=>showToast(e.message))}};

function firebaseErrorMessage(code){return ({
  'auth/invalid-credential':'Nesprávný e-mail nebo heslo.',
  'auth/email-already-in-use':'Tento e-mail je už zaregistrovaný.',
  'auth/weak-password':'Heslo musí mít alespoň 6 znaků.',
  'auth/invalid-email':'Zadejte platný e-mail.',
  'auth/too-many-requests':'Příliš mnoho pokusů. Zkuste to později.',
  'auth/user-disabled':'Tento účet je zakázaný.',
  'auth/network-request-failed':'Nepodařilo se připojit k internetu.'
})[code]||'Operace se nepodařila.'}
function setAuthMessage(message,ok=false){const el=$('#loginError');el.textContent=message;el.classList.toggle('success',ok)}
$$('[data-auth-tab]').forEach(btn=>btn.addEventListener('click',()=>{
  $$('[data-auth-tab]').forEach(x=>x.classList.toggle('active',x===btn));
  $('#loginForm').classList.toggle('hidden',btn.dataset.authTab!=='login');
  $('#registerForm').classList.toggle('hidden',btn.dataset.authTab!=='register');
  setAuthMessage('');
}));
$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();setAuthMessage('');try{await signInWithEmailAndPassword(auth,$('#loginEmail').value.trim(),$('#loginPassword').value)}catch(err){setAuthMessage(firebaseErrorMessage(err.code))}});
$('#registerForm').addEventListener('submit',async e=>{
  e.preventDefault();setAuthMessage('');
  const name=$('#registerName').value.trim(),email=$('#registerEmail').value.trim().toLowerCase(),password=$('#registerPassword').value;
  if(password!==$('#registerPassword2').value){setAuthMessage('Hesla se neshodují.');return}
  try{
    const cred=await createUserWithEmailAndPassword(auth,email,password);
    await updateProfile(cred.user,{displayName:name});
    await setDoc(doc(db,'users',cred.user.uid),{name,email,approved:false,role:'pending',canEditVehicles:false,createdAt:serverTimestamp()});
    await sendEmailVerification(cred.user);
    await signOut(auth);
    $('#registerForm').reset();
    $('[data-auth-tab="login"]').click();
    setAuthMessage('Registrace byla odeslána. Potvrďte e-mail a vyčkejte na schválení správcem.',true);
  }catch(err){setAuthMessage(firebaseErrorMessage(err.code))}
});
$('#logoutBtn').onclick=()=>signOut(auth);
async function ensureProfile(user){
  const userRef=doc(db,'users',user.uid),adminRef=doc(db,'config','admin');
  let profileSnap=await getDoc(userRef);
  const adminSnap=await getDoc(adminRef);
  if(!adminSnap.exists()){
    await setDoc(adminRef,{uid:user.uid,email:user.email,createdAt:serverTimestamp()});
    await setDoc(userRef,{name:user.displayName||user.email,email:user.email,approved:true,role:'admin',canEditVehicles:true,createdAt:serverTimestamp()},{merge:true});
    profileSnap=await getDoc(userRef);
  }else if(!profileSnap.exists()){
    await setDoc(userRef,{name:user.displayName||user.email,email:user.email,approved:false,role:'pending',canEditVehicles:false,createdAt:serverTimestamp()});
    profileSnap=await getDoc(userRef);
  }
  return profileSnap.data();
}
function applyRoleUi(){
  const admin=currentProfile?.role==='admin'&&currentProfile?.approved;
  $$('.admin-only').forEach(el=>el.classList.toggle('hidden',!admin));
  applyVehicleEditUi();
  if(!admin&&location.hash==='#sprava')location.hash='#prehled';
}
function applyVehicleEditUi(){
  const allowed=canEditVehicleData();
  $$('.vehicle-edit-only').forEach(el=>el.classList.toggle('hidden',!allowed));
}
async function renderPendingUsers(){
  const target=$('#pendingUsers');if(!target||currentProfile?.role!=='admin')return;
  try{
    const snap=await getDocs(collection(db,'users'));
    const pending=snap.docs.map(d=>({id:d.id,...d.data()})).filter(u=>!u.approved&&u.role!=='admin');
    target.innerHTML=pending.length?pending.map(u=>`<div class="pending-user"><div><strong>${escapeHtml(u.name||'Bez jména')}</strong><span>${escapeHtml(u.email||'')}</span></div><button class="primary" onclick="approveUser('${u.id}')">Schválit</button></div>`).join(''):'<div class="muted">Žádná registrace nečeká na schválení.</div>';
  }catch{target.innerHTML='<div class="login-error">Registrace se nepodařilo načíst.</div>'}
}
window.approveUser=async uid=>{
  if(currentProfile?.role!=='admin')return;
  try{await updateDoc(doc(db,'users',uid),{approved:true,role:'technician',canEditVehicles:false,approvedAt:serverTimestamp(),approvedBy:auth.currentUser.uid});await renderPendingUsers();await renderUserPermissions();showToast('Uživatel byl schválen.')}catch(e){showToast(e.message)}
};

async function renderUserPermissions(){
  const target=$('#vehicleEditors');if(!target||currentProfile?.role!=='admin')return;
  try{
    const snap=await getDocs(collection(db,'users'));
    const users=snap.docs.map(d=>({id:d.id,...d.data()})).filter(u=>u.approved&&u.role!=='admin');
    target.innerHTML=users.length?users.map(u=>`<div class="permission-user"><div><strong>${escapeHtml(u.name||'Bez jména')}</strong><span>${escapeHtml(u.email||'')}</span></div><label class="permission-toggle"><input type="checkbox" ${u.canEditVehicles?'checked':''} onchange="setVehicleEditPermission('${u.id}',this.checked)"><span>${u.canEditVehicles?'Povoleno':'Zakázáno'}</span></label></div>`).join(''):'<div class="muted">Zatím nejsou schválení žádní další uživatelé.</div>';
  }catch{target.innerHTML='<div class="login-error">Oprávnění se nepodařilo načíst.</div>'}
}
window.setVehicleEditPermission=async(uid,allowed)=>{
  if(currentProfile?.role!=='admin')return;
  try{await updateDoc(doc(db,'users',uid),{canEditVehicles:allowed,permissionsUpdatedAt:serverTimestamp(),permissionsUpdatedBy:auth.currentUser.uid});await renderUserPermissions();showToast(allowed?'Úpravy vozidel byly povoleny.':'Úpravy vozidel byly zakázány.')}catch(e){showToast(e.message);await renderUserPermissions()}
};

async function startCloud(){if(unsubscribeState)unsubscribeState();const snap=await getDoc(stateRef);if(!snap.exists())await setDoc(stateRef,{vehicles:seed.vehicles,reservations:[],issues:[],history:[],updatedAt:serverTimestamp(),updatedBy:auth.currentUser.email});unsubscribeState=onSnapshot(stateRef,s=>{if(!s.exists())return;const x=s.data();data={vehicles:x.vehicles||[],reservations:x.reservations||[],issues:x.issues||[],history:x.history||[]};cloudReady=true;renderAll();openVehicleFromQr()},()=>showToast('Nepodařilo se načíst společná data.'))}
onAuthStateChanged(auth,async user=>{
  if(!user){
    $('#loginScreen').classList.remove('hidden');cloudReady=false;currentProfile=null;applyRoleUi();
    if(unsubscribeState){unsubscribeState();unsubscribeState=null}return;
  }
  try{
    currentProfile=await ensureProfile(user);
    const isAdmin=currentProfile.role==='admin'&&currentProfile.approved;
    if(!isAdmin&&!user.emailVerified){setAuthMessage('Nejdříve potvrďte e-mail pomocí odkazu, který jsme vám poslali.');await signOut(auth);return}
    if(!currentProfile.approved){setAuthMessage('E-mail je potvrzený. Registrace nyní čeká na schválení správcem.');await signOut(auth);return}
    $('#loginScreen').classList.add('hidden');
    $('#userName').textContent=currentProfile.name||user.displayName||user.email;
    applyRoleUi();await startCloud();
  }catch(e){setAuthMessage('Přihlášení se nepodařilo dokončit: '+e.message);await signOut(auth)}
});
$('#todayText').textContent=new Intl.DateTimeFormat('cs-CZ',{dateStyle:'full'}).format(new Date());
renderAll();
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
let qrOpened=false;function openVehicleFromQr(){if(qrOpened||!cloudReady)return;const id=new URLSearchParams(location.search).get('vehicle');if(id&&vehicle(id)){qrOpened=true;setTimeout(()=>{location.hash='#prehled';const v=vehicle(id);if(v.status==='used')openReturn(id);else openTake(id)},350)}}
