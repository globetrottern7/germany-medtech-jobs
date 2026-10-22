#!/usr/bin/env node
const fs=require("fs"),path=require("path");
const read=p=>JSON.parse(fs.readFileSync(path.join(process.cwd(),p),"utf8"));
const fail=m=>{console.error("PUBLICATION_VALIDATION_FAILED:",m);process.exitCode=1;};
const same=(a,b)=>JSON.stringify([...(a||[])].sort())===JSON.stringify([...(b||[])].sort());
const jobs=read("data/jobs.json"),reports=read("data/reports.json").reports,history=read("data/daily-history.json").entries,config=read("state/config.json");
if(!Array.isArray(jobs.jobs)||!Array.isArray(reports)||!Array.isArray(history)){fail("Core data arrays missing/malformed.");process.exit();}
const latest=history[history.length-1];if(!latest?.date){fail("History has no latest date.");process.exit();}
const dailyPath=`data/daily/${latest.date}.json`;if(!fs.existsSync(path.join(process.cwd(),dailyPath))){fail(`Latest history date ${latest.date} has no dated report.`);process.exit();}
const daily=read(dailyPath),report=reports.find(r=>r.date===latest.date),normal=String(daily.reportType||"").startsWith("normal daily");
if(latest.reportStatus==="PUBLISHED"&&!report)fail(`PUBLISHED date ${latest.date} absent from reports.json.`);
if(normal&&!report)fail(`Normal daily report ${latest.date} missing from reports.json.`);
if(report&&normal){
 for(const k of ["activeJobs","freshJobs","previouslyListed","closingWithin7Days","newGatePassing","provisionalFindings"])if(daily[k]!==undefined&&report[k]!==undefined&&daily[k]!==report[k])fail(`${latest.date}: ${k} differs between daily report and index.`);
 for(const k of ["jobIds","freshJobIds","excludedJobIds","provisionalFindingIds"])if(!same(daily[k],report[k]))fail(`${latest.date}: ${k} differs between daily report and index.`);
 if(daily.sourceCoverage?.grade!==report.sourceCoverage?.grade)fail("Source coverage grade differs between daily report and index.");
 if((daily.sourceCoverage?.sourceExecutionLedger||[]).length!==report.sourceCoverage?.sourceExecutionLedgerEntries)fail("Source ledger length differs between daily report and index summary.");
 if(latest.sourceCoverageGrade!==daily.sourceCoverage?.grade)fail("History coverage grade differs from daily report.");
}
if(normal){
 const ids=daily.jobIds||[],active=new Map(jobs.jobs.filter(j=>j.status==="active").map(j=>[j.id,j]));
 const missing=ids.filter(id=>!active.has(id));if(missing.length)fail(`Published IDs not active in jobs.json: ${missing.join(", ")}`);
 if(ids.length!==daily.activeJobs)fail("activeJobs count != jobIds length.");
 if((daily.freshJobIds||[]).some(id=>!ids.includes(id)))fail("freshJobIds contains non-published ID.");
 if((daily.freshJobIds||[]).length!==daily.freshJobs)fail("freshJobs count != fresh IDs length.");
 if((daily.previouslyListed||0)+(daily.freshJobs||0)!==daily.activeJobs)fail("fresh + previouslyListed != activeJobs.");
 if((daily.provisionalFindingIds||[]).length!==daily.provisionalFindings)fail("provisionalFindings count != provisionalFindingIds length.");
 for(const id of ids){const j=active.get(id);if(!j?.url||!/^https?:\/\//i.test(j.url))fail(`Published role ${id} lacks URL evidence.`);const v=j?.lastVerified||j?.last_verified;if(!v||new Date(v)<new Date(daily.date+"T00:00:00Z")-72*60*60*1000)fail(`Published role ${id} lacks verification within 72 hours.`);}
 const expired=jobs.jobs.filter(j=>j.status==="active"&&j.deadline&&new Date(j.deadline+"T23:59:59Z")<new Date(daily.date+"T00:00:00Z")).map(j=>j.id);if(expired.length)fail(`Active jobs have deadlines before report date: ${expired.join(", ")}`);
 const ledger=daily.sourceCoverage?.sourceExecutionLedger,allowed=new Set(config.coveragePolicy?.sourceStatusValues||[]);
 if(!Array.isArray(ledger)||!ledger.length)fail("sourceCoverage has no per-source execution ledger.");
 else{
  for(const e of ledger){if(!e.source||!allowed.has(e.status))fail(`Invalid/missing source status for ${e.source||"(unnamed)"}.`);if(e.status==="indexed_search_attempted"&&(!e.method||!e.query))fail(`Indexed source ${e.source} lacks method/query.`);if(e.status==="not_searched"&&e.lastAttempted)fail(`not_searched source ${e.source} has lastAttempted timestamp.`);}
  for(const s of config.weeklySourceBaseline||[])if(!ledger.some(e=>String(e.source).toLowerCase()===String(s).toLowerCase()))fail(`Weekly baseline source ${s} has no ledger entry.`);
  const c={official_page_checked:0,indexed_search_attempted:0,unavailable_or_blocked:0,not_searched:0};for(const e of ledger)c[e.status]++;
  if(daily.sourceCoverage.configuredSourceCount!==ledger.length)fail("configuredSourceCount != ledger length.");
  if(daily.sourceCoverage.notSearchedCount!==c.not_searched)fail("notSearchedCount != ledger.");
  if(JSON.stringify(daily.sourceCoverage.statusCounts)!==JSON.stringify(c))fail("source status counts != ledger.");
  if(c.not_searched>0&&daily.sourceCoverage.grade==="FULL")fail("FULL coverage claimed while sources remain not_searched.");
  if(c.not_searched>0&&daily.sourceCoverage.fullCoverageClaim!==false)fail("fullCoverageClaim must be false while sources remain not_searched.");
 }
 if(daily.closingWithin7DaysPublished!==undefined&&daily.closingWithin7DaysProvisional!==undefined&&daily.closingWithin7Days!==daily.closingWithin7DaysPublished+daily.closingWithin7DaysProvisional)fail("closingWithin7Days split does not reconcile.");
}
for(const r of reports){if(r.activeJobs!==(r.jobIds||[]).length)fail(`${r.date}: activeJobs != jobIds length.`);if((r.freshJobIds||[]).some(id=>!(r.jobIds||[]).includes(id)))fail(`${r.date}: fresh IDs outside job IDs.`);if(r.freshJobs!==(r.freshJobIds||[]).length)fail(`${r.date}: freshJobs != fresh IDs length.`);if((r.previouslyListed||0)+(r.freshJobs||0)!==r.activeJobs)fail(`${r.date}: fresh + previouslyListed != activeJobs.`);}
console.log(`Publication validation passed for latest date ${latest.date}. Active jobs: ${jobs.jobs.filter(j=>j.status==="active").length}. Coverage: ${daily.sourceCoverage?.grade||"MISSING"}; ledger entries: ${daily.sourceCoverage?.sourceExecutionLedger?.length||0}.`);
