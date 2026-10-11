const $=id=>document.getElementById(id);
const scene=$('scene'),moonShadow=$('moonShadow'),phaseName=$('phaseName'),illumination=$('illumination'),weatherLabel=$('weatherLabel'),locationLabel=$('locationLabel');
const countrySelect=$('countrySelect'),locationSelect=$('locationSelect');
let roomView=true,catalog=null,currentWeather=null;

function lunarData(date=new Date()){
  const synodic=29.530588853;
  const epoch=Date.UTC(2000,0,6,18,14,0);
  let age=((date.getTime()-epoch)/86400000)%synodic;if(age<0)age+=synodic;
  const angle=age/synodic*2*Math.PI;
  const lit=(1-Math.cos(angle))/2;
  const waxing=age<synodic/2;
  let name;
  if(age<1||age>synodic-1)name='New Moon';
  else if(age<6.4)name='Waxing Crescent';
  else if(age<8.4)name='First Quarter';
  else if(age<13.8)name='Waxing Gibbous';
  else if(age<15.8)name='Full Moon';
  else if(age<21.2)name='Waning Gibbous';
  else if(age<23.2)name='Last Quarter';
  else name='Waning Crescent';
  return{age,lit,waxing,name};
}
function renderMoon(){
  const m=lunarData(),pct=Math.round(m.lit*100);
  phaseName.textContent=m.name;illumination.textContent=pct+'%';
  $('panelPhase').textContent=m.name;$('panelIllum').textContent=pct+'%';$('panelAge').textContent=m.age.toFixed(1)+' days';
  const k=Math.cos(m.age/29.530588853*2*Math.PI);
  const side=m.waxing?'right':'left';
  const dark=1-m.lit;
  let gradient;
  if(pct<=2)gradient='rgba(3,5,8,.96)';
  else if(pct>=98)gradient='rgba(0,0,0,0)';
  else if(m.waxing) gradient=`linear-gradient(90deg,rgba(2,4,7,${Math.min(.98,dark*1.45)}) 0%,rgba(2,4,7,${Math.min(.92,dark)}) ${Math.max(5,50-m.lit*35)}%,rgba(0,0,0,0) ${Math.min(95,52+m.lit*42)}%)`;
  else gradient=`linear-gradient(270deg,rgba(2,4,7,${Math.min(.98,dark*1.45)}) 0%,rgba(2,4,7,${Math.min(.92,dark)}) ${Math.max(5,50-m.lit*35)}%,rgba(0,0,0,0) ${Math.min(95,52+m.lit*42)}%)`;
  moonShadow.style.background=gradient;
}
function weatherKind(data){
  const code=Number(data?.weather_code??0),rain=Math.max(0,Number(data?.precipitation_mm||0),Number(data?.rain_mm||0)+Number(data?.showers_mm||0));
  if(code>=95)return['stormy','Storm'];
  if(rain>.05||[51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code))return['rainy','Rain'];
  if([1,2,3,45,48].includes(code))return['cloudy',code===1?'Partly cloudy':'Cloudy'];
  return['clear','Clear'];
}
function applyWeather(data){
  currentWeather=data;
  scene.classList.remove('clear','cloudy','rainy','stormy');
  const [kind,label]=weatherKind(data);scene.classList.add(kind);
  weatherLabel.textContent=label;$('panelWeather').textContent=label;
}
function labelFor(loc){return loc.city&&loc.city!==loc.name?`${loc.name} · ${loc.city}`:loc.name}
async function loadCatalog(){
  try{catalog=await fetch('https://raw.githubusercontent.com/bennessism/window/main/weather/catalog.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json()})}
  catch{catalog={default:{country:'my',location:'selangor'},countries:{my:{name:'Malaysia',locations:[{id:'selangor',name:'Selangor',city:'Shah Alam',lat:3.0738,lon:101.5183}]}}}}
  countrySelect.innerHTML='';
  Object.entries(catalog.countries).forEach(([id,c])=>countrySelect.add(new Option(c.name,id)));
  countrySelect.value=localStorage.getItem('themoonCountry')||catalog.default.country||Object.keys(catalog.countries)[0];
  if(!catalog.countries[countrySelect.value])countrySelect.value=Object.keys(catalog.countries)[0];
  populateLocations();
}
function populateLocations(){
  const c=catalog.countries[countrySelect.value];locationSelect.innerHTML='';
  c.locations.forEach(l=>locationSelect.add(new Option(labelFor(l),l.id)));
  const saved=localStorage.getItem('themoonLocation')||catalog.default.location;
  if(c.locations.some(l=>l.id===saved))locationSelect.value=saved;
}
function selectedLocation(){const c=catalog.countries[countrySelect.value];return c.locations.find(l=>l.id===locationSelect.value)||c.locations[0]}
async function loadWeather(){
  const loc=selectedLocation();locationLabel.textContent=labelFor(loc);
  try{
    const p=await fetch(`https://raw.githubusercontent.com/bennessism/window/main/weather/data/${countrySelect.value}.json`,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json()});
    applyWeather(p.locations?.[loc.id]||{weather_code:0});
  }catch{applyWeather({weather_code:0});weatherLabel.textContent='Weather unavailable';$('panelWeather').textContent='Unavailable'}
}
function setRoomView(next){
  roomView=next;scene.classList.toggle('observatory-mode',roomView);scene.classList.toggle('telescope-mode',!roomView);
  $('viewLabel').textContent=roomView?'Lunar Monitoring Dome':'Telescope View';
  $('tapHint').textContent='← Back to dome';
  $('sceneToggle').setAttribute('aria-label','Back to dome');
}
function panelToggle(panel,show){panel.classList.toggle('show',show);panel.setAttribute('aria-hidden',String(!show))}
$('sceneToggle').addEventListener('click',()=>setRoomView(true));
$('telescopeBtn').addEventListener('click',()=>{closeWorkstation();panelToggle($('infoPanel'),false);panelToggle($('locationPanel'),false);setRoomView(false)});
$('workstationBtn').addEventListener('click',openWorkstation);
$('infoBtn').addEventListener('click',()=>panelToggle($('infoPanel'),!$('infoPanel').classList.contains('show')));
$('infoClose').addEventListener('click',()=>panelToggle($('infoPanel'),false));
$('locationBtn').addEventListener('click',()=>panelToggle($('locationPanel'),true));
$('locationClose').addEventListener('click',()=>panelToggle($('locationPanel'),false));
countrySelect.addEventListener('change',populateLocations);
$('applyLocation').addEventListener('click',()=>{const loc=selectedLocation();localStorage.setItem('themoonCountry',countrySelect.value);localStorage.setItem('themoonLocation',loc.id);panelToggle($('locationPanel'),false);loadWeather()});
renderMoon();loadCatalog().then(loadWeather);
setInterval(renderMoon,10*60*1000);

/* One-year-at-a-time NASA SVS workstation archive. */
const reportYear=$('reportYear'),reportMonth=$('reportMonth'),reportDay=$('reportDay'),reportHour=$('reportHour');
const reportPanel=$('workstationPanel');
const MONTHS=Array.from({length:12},(_,i)=>new Date(Date.UTC(2020,i,1)).toLocaleString('en',{month:'long',timeZone:'UTC'}));
let archiveYear=null,archiveRecords=null,archiveRequest=0,archiveManifest=null;
const pad=n=>String(n).padStart(2,'0');
const readable=n=>Number(n).toLocaleString('en-US');
function fillSelect(el,values,selected){
  el.replaceChildren();
  values.forEach(([value,label])=>el.add(new Option(label,String(value))));
  if(selected!==undefined)el.value=String(selected);
}
function syncDays(){
  const count=new Date(Date.UTC(Number(reportYear.value),Number(reportMonth.value)+1,0)).getUTCDate();
  const previous=Number(reportDay.value)||1;
  fillSelect(reportDay,Array.from({length:count},(_,i)=>[i+1,String(i+1)]),Math.min(previous,count));
}
function setReportDate(date){
  const y=date.getUTCFullYear();
  if(Array.from(reportYear.options).some(o=>o.value===String(y)))reportYear.value=String(y);
  reportMonth.value=String(date.getUTCMonth());syncDays();
  reportDay.value=String(date.getUTCDate());reportHour.value=String(date.getUTCHours());
}
function reportPhaseName(row,prior,next){
  const age=Number(row.age),illum=Number(row.phase);
  const waxing=next&&prior?Number(next.phase)>=Number(prior.phase):age<14.77;
  if(illum<=1.5)return 'New Moon';
  if(illum>=98.5)return 'Full Moon';
  if(Math.abs(illum-50)<=2)return waxing?'First Quarter':'Last Quarter';
  return (waxing?'Waxing ':'Waning ')+(illum<50?'Crescent':'Gibbous');
}
function reportIndex(year,month,day,hour){
  return Math.round((Date.UTC(year,month,day,hour)-Date.UTC(year,0,1))/3600000);
}
function selectedReportIndex(){return reportIndex(Number(reportYear.value),Number(reportMonth.value),Number(reportDay.value),Number(reportHour.value))}
function renderReport(){
  if(archiveYear!==Number(reportYear.value)||!archiveRecords)return;
  const records=archiveRecords,index=selectedReportIndex(),row=records[index];
  if(!row){
    $('reportContent').hidden=true;$('reportStatus').textContent='No NASA hourly record for this selection.';return;
  }
  const prev=records[Math.max(0,index-1)],next=records[Math.min(records.length-1,index+1)];
  $('reportContent').hidden=false;
  $('reportStatus').textContent='NASA hourly record · '+row.time;
  $('reportDate').textContent=MONTHS[Number(reportMonth.value)]+' '+reportDay.value+', '+reportYear.value+' · '+pad(reportHour.value)+':00 UTC';
  $('reportPhase').textContent=reportPhaseName(row,prev,next);
  $('reportIllum').textContent=Number(row.phase).toFixed(1)+'%';
  $('reportAge').textContent=Number(row.age).toFixed(2)+' days';
  $('reportDistance').textContent=readable(Math.round(Number(row.distance)))+' km';
  $('reportDiameter').textContent=Number(row.diameter).toFixed(1)+' arcsec';
  const month=Number(reportMonth.value),year=Number(reportYear.value);
  const first=reportIndex(year,month,1,0);
  const end=reportIndex(year,month+1,1,0);
  const monthRows=records.slice(first,end).filter(r=>Number.isFinite(Number(r.phase)));
  if(monthRows.length){
    const min=Math.min(...monthRows.map(r=>Number(r.phase)));
    const max=Math.max(...monthRows.map(r=>Number(r.phase)));
    $('reportMonthSummary').textContent=`${monthRows.length} hourly observations · illumination ranged from ${min.toFixed(1)}% to ${max.toFixed(1)}% during ${MONTHS[month]} ${year}.`;
  }
}
async function loadReportYear(){
  const year=Number(reportYear.value),request=++archiveRequest;
  $('reportStatus').textContent='Loading NASA '+year+' lunar archive…';
  $('reportContent').hidden=true;
  if(archiveYear===year&&archiveRecords){renderReport();return}
  try{
    const response=await fetch('data/moon/'+year+'.json');
    if(!response.ok)throw Error('Year file unavailable ('+response.status+')');
    const records=await response.json();
    const expected=(new Date(Date.UTC(year+1,0,1))-new Date(Date.UTC(year,0,1)))/3600000;
    if(!Array.isArray(records)||records.length<expected||!records[0]?.time||!Number.isFinite(Number(records[0]?.phase)))throw Error('Invalid or incomplete annual archive');
    if(request!==archiveRequest)return;
    archiveYear=year;archiveRecords=records;renderReport();
  }catch(err){
    if(request!==archiveRequest)return;
    archiveYear=null;archiveRecords=null;
    $('reportStatus').textContent='NASA archive for '+year+' could not be loaded: '+err.message+'.';
  }
}
async function initializeReport(){
  fillSelect(reportMonth,MONTHS.map((name,i)=>[i,name]));
  fillSelect(reportHour,Array.from({length:24},(_,i)=>[i,pad(i)+':00']));
  let years=Array.from({length:8},(_,i)=>2019+i);
  try{
    const response=await fetch('data/moon/manifest.json');
    if(response.ok){
      const manifest=await response.json();
      const available=Object.keys(manifest).map(Number).filter(Number.isInteger).sort((a,b)=>a-b);
      if(available.length){years=available;archiveManifest=manifest}
    }
  }catch{}
  fillSelect(reportYear,years.map(y=>[y,String(y)]),String(new Date().getFullYear()));
  if(!reportYear.value||!years.includes(Number(reportYear.value)))reportYear.value=String(years.at(-1));
  setReportDate(new Date());
}
function openWorkstation(){
  setRoomView(true);
  panelToggle($('infoPanel'),false);panelToggle($('locationPanel'),false);
  panelToggle(reportPanel,true);
  loadReportYear();
  reportYear.focus();
}
function closeWorkstation(){panelToggle(reportPanel,false)}
$('workstationClose').addEventListener('click',closeWorkstation);
$('reportToday').addEventListener('click',()=>{setReportDate(new Date());loadReportYear()});
reportYear.addEventListener('change',()=>{syncDays();loadReportYear()});
reportMonth.addEventListener('change',()=>{syncDays();renderReport()});
reportDay.addEventListener('change',renderReport);
reportHour.addEventListener('change',renderReport);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&reportPanel.classList.contains('show'))closeWorkstation()});
initializeReport();
