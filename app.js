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
let currentNASARecord=null;
function illuminatedPhaseName(illum,age){
  const waxing=age<14.77;
  if(illum<1.5)return 'New Moon';
  if(illum>98.5)return 'Full Moon';
  if(Math.abs(illum-50)<1.5)return waxing?'First Quarter':'Last Quarter';
  return (waxing?'Waxing ':'Waning ')+(illum<50?'Crescent':'Gibbous');
}
/* Project the illuminated hemisphere onto a disk; a curved terminator, not a linear fade.
   Phase fraction is illuminated area of the lunar disk, 0 = new, 1 = full. */
function lunarShadowPath(fraction,waxing){
  const f=Math.max(0,Math.min(1,Number(fraction)));
  if(f>=.9999)return '';
  if(f<=.0001)return '<circle cx="50" cy="50" r="50" fill="#020408" fill-opacity=".98"/>';
  const outer=[],terminator=[];
  for(let i=0;i<=80;i++){
    const y=-1+2*i/80;
    const radius=Math.sqrt(Math.max(0,1-y*y));
    const darkSide=waxing?-1:1;
    const terminatorX=(waxing?1-2*f:2*f-1)*radius;
    outer.push((50+49*darkSide*radius).toFixed(2)+','+(50+49*y).toFixed(2));
    terminator.push((50+49*terminatorX).toFixed(2)+','+(50+49*y).toFixed(2));
  }
  return '<path d="M'+outer.join(' L')+' L'+terminator.reverse().join(' L')+' Z" fill="#020408" fill-opacity=".97"/>';
}
function setMoonShadow(target,fraction,waxing){
  target.style.background='none';
  target.innerHTML='<svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">'+lunarShadowPath(fraction,waxing)+'</svg>';
}
function renderMoon(){
  const m=lunarData(),record=currentNASARecord;
  const pct=record?Number(record.phase):m.lit*100;
  const age=record?Number(record.age):m.age;
  const waxing=age<14.77;
  const name=record?illuminatedPhaseName(pct,age):m.name;
  phaseName.textContent=name;
  illumination.textContent=Math.round(pct)+'%';
  $('topSummary').textContent=name+' · '+Math.round(pct)+'%';
  $('panelPhase').textContent=name;
  $('panelIllum').textContent=pct.toFixed(1)+'%';
  $('panelAge').textContent=age.toFixed(2)+' days';
  $('panelDistance').textContent=record?Math.round(Number(record.distance)).toLocaleString('en-US')+' km':'NASA data unavailable';
  setMoonShadow(moonShadow,pct/100,waxing);
}
async function loadCurrentNASA(){
  const now=new Date(),year=now.getUTCFullYear();
  if(archiveYear===year&&archiveRecords){
    const i=reportIndex(year,now.getUTCMonth(),now.getUTCDate(),now.getUTCHours());
    currentNASARecord=archiveRecords[i]||null;renderMoon();return;
  }
  try{
    const response=await fetch('data/moon/'+year+'.json');
    if(!response.ok)throw Error('NASA archive unavailable');
    const rows=await response.json();
    const expected=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/3600000;
    if(!Array.isArray(rows)||rows.length<expected)throw Error('Incomplete archive');
    const i=Math.floor((Date.now()-Date.UTC(year,0,1))/3600000);
    currentNASARecord=rows[i]||null;
    renderMoon();
  }catch{currentNASARecord=null;renderMoon()}
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
function panelToggle(panel,show){panel.classList.toggle('show',show);panel.setAttribute('aria-hidden',String(!show));if(panel.id==='infoPanel')$('infoBtn').setAttribute('aria-expanded',String(show))}
$('sceneToggle').addEventListener('click',()=>setRoomView(true));
$('telescopeBtn').addEventListener('click',()=>{closeWorkstation();panelToggle($('infoPanel'),false);panelToggle($('locationPanel'),false);setRoomView(false)});
$('workstationBtn').addEventListener('click',openWorkstation);
$('infoBtn').addEventListener('click',()=>{const opening=!$('infoPanel').classList.contains('show');panelToggle($('locationPanel'),false);panelToggle($('infoPanel'),opening)});
$('infoClose').addEventListener('click',()=>panelToggle($('infoPanel'),false));
$('locationBtn').addEventListener('click',()=>{panelToggle($('infoPanel'),false);panelToggle($('locationPanel'),!$('locationPanel').classList.contains('show'))});
$('locationClose').addEventListener('click',()=>panelToggle($('locationPanel'),false));
countrySelect.addEventListener('change',populateLocations);
$('applyLocation').addEventListener('click',()=>{const loc=selectedLocation();localStorage.setItem('themoonCountry',countrySelect.value);localStorage.setItem('themoonLocation',loc.id);panelToggle($('locationPanel'),false);loadWeather()});
$('infoChangeLocation').addEventListener('click',()=>{panelToggle($('infoPanel'),false);panelToggle($('locationPanel'),true)});
$('infoOpenWorkstation').addEventListener('click',openWorkstation);
renderMoon();loadCatalog().then(loadWeather);
setInterval(loadCurrentNASA,60*60*1000);

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
  updateReportVisualization(row,prev,next);
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
    updateMonthlyVisualization(year,month,records);
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

function illuminationStyle(illum,waxing){
  const amount=Math.max(0,Math.min(1,Number(illum)/100));
  // A circular disk projection: illuminated portion bounded by an elliptical terminator.
  const k=Math.abs(1-2*amount)*100;
  const brightSide=waxing?'right':'left';
  return {clip: amount<=.015?'inset(0 0 0 100%)':amount>=.985?'none':null,amount,k,brightSide};
}
function updateReportVisualization(row,prev,next){
  const name=reportPhaseName(row,prev,next),illum=Number(row.phase);
  const waxing=Number(row.age)<14.77;
  setMoonShadow($('reportOrbShadow'),illum/100,waxing);
  $('reportOrb').style.background='radial-gradient(circle at 38% 34%,#f2f1e8,#c7ccd0 65%,#808e99)';
  $('reportVisualPhase').textContent=name;
  $('reportVisualNote').textContent=illum.toFixed(1)+'% illuminated · '+(waxing?'waxing':'waning')+' · '+Number(row.age).toFixed(2)+' days since new Moon';
}
function updateMonthlyVisualization(year,month,records){
  const count=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  const daily=Array.from({length:count},(_,i)=>{
    const idx=reportIndex(year,month,i+1,12);
    return {day:i+1,row:records[idx],value:Number(records[idx]?.phase)};
  });
  const chart=$('reportChart');chart.replaceChildren();
  const maxWidth=680,height=112,plotBottom=98,plotTop=10;
  const pts=daily.filter(d=>Number.isFinite(d.value)).map((d,i)=>[(i/(count-1))*maxWidth,plotBottom-(d.value/100)*(plotBottom-plotTop)]);
  if(pts.length){
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
    svg.setAttribute('viewBox','0 0 680 112');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
    [0,50,100].forEach(v=>{const line=document.createElementNS(ns,'line');const y=plotBottom-v/100*(plotBottom-plotTop);line.setAttribute('x1','0');line.setAttribute('x2','680');line.setAttribute('y1',String(y));line.setAttribute('y2',String(y));line.setAttribute('stroke','#40536a');line.setAttribute('stroke-dasharray','3 8');svg.append(line)});
    const line=document.createElementNS(ns,'polyline');line.setAttribute('points',pts.map(p=>p.join(',')).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#bbd3eb');line.setAttribute('stroke-width','2.8');line.setAttribute('stroke-linejoin','round');line.setAttribute('vector-effect','non-scaling-stroke');svg.append(line);
    chart.append(svg);
  }
  const cal=$('reportCalendar');cal.replaceChildren();
  const dayOffset=(new Date(Date.UTC(year,month,1)).getUTCDay()+6)%7;
  for(let i=0;i<dayOffset;i++){const blank=document.createElement('span');blank.className='calendar-blank';cal.append(blank)}
  daily.forEach(d=>{
    const button=document.createElement('button');button.type='button';button.className='calendar-day';
    button.dataset.day=String(d.day);
    if(Number(reportDay.value)===d.day)button.classList.add('selected');
    const number=document.createElement('span');number.textContent=String(d.day);
    const disk=document.createElement('span');disk.className='calendar-phase';
    const value=Number.isFinite(d.value)?Math.max(0,Math.min(100,d.value)):0;
    const waxing=Number(d.row?.age)<14.77;
    disk.style.background=`linear-gradient(${waxing?'90deg':'270deg'},#b7c7d6 ${value}%,#182535 ${value}%)`;
    const percentage=document.createElement('small');percentage.textContent=Number.isFinite(d.value)?Math.round(d.value)+'%':'—';
    button.append(number,disk,percentage);
    button.setAttribute('aria-label',`${MONTHS[month]} ${d.day}: ${Number.isFinite(d.value)?d.value.toFixed(1)+'% illumination':'data unavailable'} at 12:00 UTC`);
    button.addEventListener('click',()=>{reportDay.value=String(d.day);reportHour.value='12';renderReport()});
    cal.append(button);
  });
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
loadCurrentNASA();
