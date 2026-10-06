async function getJson(path){const r=await fetch(path+'?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error(path);return r.json()}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function uniqueRecords(lines){
  const map=new Map();
  for(const line of lines.split(/\r?\n/)){if(!line.trim())continue;try{const j=JSON.parse(line);if((j.match||0)<75)continue;const key=j.identity_key||j.id;if(!key)continue;const old=map.get(key);if(!old||String(j.first_seen||'')<String(old.first_seen||''))map.set(key,j)}catch{}}
  return [...map.values()].sort((a,b)=>String(b.first_seen||'').localeCompare(String(a.first_seen||''))||((b.match||0)-(a.match||0)));
}
function thresholdRows(records){
  return [75,80,90].map(n=>records.filter(j=>(j.match||0)>=n).length)
}
function renderVisitors(d){
  const s=d.summary||{};
  document.getElementById('vTotal').textContent=s.totalVisits??0;
  document.getElementById('vToday').textContent=s.todayVisits??0;
  document.getElementById('v30').textContent=s.last30DaysVisits??0;
  document.getElementById('vUnique').textContent=s.todayUniqueVisitors??0;
  const status=document.getElementById('visitorStatus');
  status.textContent=d.connected?'Collector connected':'Collector not connected';
  status.className='history-status '+(d.connected?'published':'gap');
  document.getElementById('visitorBody').innerHTML=(d.daily||[]).map(x=>'<tr><td>'+esc(x.date)+'</td><td>'+esc(x.visits??0)+'</td><td>'+esc(x.uniqueVisitors??0)+'</td><td>'+esc(x.pageViews??0)+'</td><td>'+esc(x.topCountry||'—')+'</td><td>'+esc(x.topReferrer||'—')+'</td></tr>').join('')||'<tr><td colspan="6" class="empty">No visitor data recorded yet.</td></tr>';
}
function renderUnique(records){
  document.getElementById('uniqueCount').textContent=records.length+' unique qualifying opportunities';
  document.getElementById('uniqueBody').innerHTML=records.map(j=>'<tr><td>'+esc(j.first_seen||'—')+'</td><td>'+esc(j.title||j.id)+'</td><td>'+esc(j.company||'—')+'</td><td>'+esc(j.country||'—')+'</td><td>'+esc(j.match||0)+'%</td><td>'+esc(j.status||'—')+'</td></tr>').join('')||'<tr><td colspan="6" class="empty">No qualifying opportunities found.</td></tr>';
}
function renderDays(data){
  const rows=(data.reports||[]).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  document.getElementById('dayBody').innerHTML=rows.map(r=>'<tr><td>'+esc(r.date)+'</td><td>'+esc(r.reportStatus||'—')+'</td><td>'+esc(r.reportType||'—')+'</td><td>'+esc(r.activeJobs??0)+'</td><td>'+esc(r.freshJobs??0)+'</td><td>'+esc(r.previouslyListed??0)+'</td><td>'+esc(r.closingWithin7Days??0)+'</td><td>'+esc(r.newGatePassing??0)+'</td><td>'+esc(r.provisionalFindings??0)+'</td></tr>').join('')||'<tr><td colspan="9" class="empty">No publication history available.</td></tr>';
}
function renderCountries(records){
  const countries=[...new Set(records.map(j=>j.country||'Other Europe'))].sort((a,b)=>a.localeCompare(b));
  document.getElementById('countryBody').innerHTML=countries.map(c=>{
    const rs=records.filter(j=>(j.country||'Other Europe')===c), t=thresholdRows(rs);
    const active=rs.filter(j=>j.status==='active').length, fresh=rs.filter(j=>j.fresh).length;
    return '<tr><td>'+esc(c)+'</td><td>'+t[0]+'</td><td>'+t[1]+'</td><td>'+t[2]+'</td><td>'+active+'</td><td>'+fresh+'</td></tr>';
  }).join('')||'<tr><td colspan="6" class="empty">No country data available.</td></tr>';
}
async function load(){
  try{
    const [visitor,reports,state]=await Promise.all([
      getJson('./data/visitor-stats.json'),
      getJson('./data/reports.json'),
      fetch('./state/vacancies.jsonl?v='+Date.now(),{cache:'no-store'}).then(r=>r.text())
    ]);
    const records=uniqueRecords(state);
    renderVisitors(visitor);renderUnique(records);renderDays(reports);renderCountries(records);
  }catch(e){
    document.getElementById('uniqueBody').innerHTML='<tr><td colspan="6" class="empty">Statistics data could not be loaded.</td></tr>';
    document.getElementById('dayBody').innerHTML='<tr><td colspan="9" class="empty">Statistics data could not be loaded.</td></tr>';
    document.getElementById('countryBody').innerHTML='<tr><td colspan="6" class="empty">Statistics data could not be loaded.</td></tr>';
  }
}
load();setInterval(load,3600000);