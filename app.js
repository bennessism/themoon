const $=id=>document.getElementById(id);
const scene=$('scene'),moonShadow=$('moonShadow'),phaseName=$('phaseName'),illumination=$('illumination'),weatherLabel=$('weatherLabel'),locationLabel=$('locationLabel');
const countrySelect=$('countrySelect'),locationSelect=$('locationSelect');
let roomView=false,catalog=null,currentWeather=null;

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
  $('viewLabel').textContent=roomView?'Lunar observatory':'Telescope view';
  $('tapHint').textContent=roomView?'Tap for telescope':'Tap for observatory';
  $('sceneToggle').setAttribute('aria-label',roomView?'Switch to telescope view':'Switch to observatory room view');
}
function panelToggle(panel,show){panel.classList.toggle('show',show);panel.setAttribute('aria-hidden',String(!show))}
$('sceneToggle').addEventListener('click',()=>setRoomView(!roomView));
$('infoBtn').addEventListener('click',()=>panelToggle($('infoPanel'),!$('infoPanel').classList.contains('show')));
$('infoClose').addEventListener('click',()=>panelToggle($('infoPanel'),false));
$('locationBtn').addEventListener('click',()=>panelToggle($('locationPanel'),true));
$('locationClose').addEventListener('click',()=>panelToggle($('locationPanel'),false));
countrySelect.addEventListener('change',populateLocations);
$('applyLocation').addEventListener('click',()=>{const loc=selectedLocation();localStorage.setItem('themoonCountry',countrySelect.value);localStorage.setItem('themoonLocation',loc.id);panelToggle($('locationPanel'),false);loadWeather()});
renderMoon();loadCatalog().then(loadWeather);
setInterval(renderMoon,10*60*1000);
