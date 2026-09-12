import json
import os
import re
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JOBS_PATH = os.path.join(ROOT, "data", "jobs.json")
REPORTS_PATH = os.path.join(ROOT, "data", "reports.json")
STATUS_PATH = os.path.join(ROOT, "data", "research-status.json")
BERLIN = ZoneInfo("Europe/Berlin")
NOW = datetime.now(BERLIN)
TODAY = NOW.strftime("%Y-%m-%d")

COUNTRY_TIERS = [
    ["Germany", "Netherlands", "Belgium", "France", "Switzerland", "Ireland"],
    ["Denmark", "Sweden", "Austria", "Italy", "Spain"],
    ["Poland", "Czechia", "Portugal", "Finland", "Norway", "Luxembourg", "United Kingdom", "other European MedTech markets"],
]
SEARCH_LAYERS = {
    "europe_employer_careers": ["official employer career sites", "official ATS pages", "European MedTech companies"],
    "ats_discovery": ["Workday", "Greenhouse", "Lever", "SmartRecruiters", "SAP SuccessFactors", "Personio", "Teamtailor", "Recruitee", "university ATS"],
    "english_titles": ["Biomedical Engineer", "Graduate Engineer", "Junior Engineer", "Graduate Program", "Young Graduate", "Early Career", "R&D Engineer", "Development Engineer", "Embedded Software Engineer", "Firmware Engineer", "Algorithm Engineer", "DSP Engineer", "Clinical Application Specialist", "Validation Engineer", "Test Engineer", "Research Engineer", "Manufacturing Engineer"],
    "german_titles": ["Entwicklungsingenieur", "Embedded Softwareentwickler", "Firmwareentwickler", "Softwareentwickler Medizintechnik", "Applikationsingenieur", "Prüfingenieur", "Systemingenieur", "Forschungsingenieur", "Wissenschaftlicher Mitarbeiter", "Doktorand", "Signalverarbeitung", "Biosignalverarbeitung", "Messtechnik"],
    "graduate_terms": ["Graduate", "Junior", "Trainee", "Young Professional", "Young Graduate", "Early Career", "Recent Graduate", "Absolvent", "Berufseinsteiger", "0 years", "no experience", "entry level"],
    "skill_adjacency": ["ECG", "EKG", "EEG", "EMG", "electrophysiology", "biosignal", "physiological monitoring", "DSP", "signal processing", "feature extraction", "C/C++", "embedded", "firmware", "real-time", "sensor interfacing", "medical device", "medical imaging", "wearables", "hearing DSP", "V&V", "IEC 62304", "MDR"],
    "research_ecosystem": ["universities", "university hospitals", "Fraunhofer", "Helmholtz", "Max Planck", "Leibniz", "research institutes", "PhD Biomedical Engineering"],
    "hidden_titles": ["Development Engineer Sensors", "Research Engineer Wearable Systems", "Software Engineer Physiological Monitoring", "Algorithm Engineer", "Test Engineer Medical Devices", "Embedded Developer Measurement Systems", "Clinical Application Specialist", "Manufacturing Engineer Biomedical", "Systems Engineer Medical Devices"],
    "regional_and_general": ["national employment services", "European specialist job boards", "regional career portals"],
}
TARGET_EMPLOYERS = [
    "Roche Diagnostics", "GE HealthCare", "Siemens Healthineers", "Johnson & Johnson", "Medtronic", "Boston Scientific", "BIOTRONIK", "Dräger", "Abbott", "B. Braun", "Stryker", "Carl Zeiss Meditec", "Fresenius Medical Care", "Philips", "Terumo", "Ottobock", "Getinge", "Smith+Nephew", "Sanmina", "Topcon Healthcare", "Applied Medical", "Arthrex", "Xeltis"
]
CANDIDATE = {
    "education": "M.Sc. Biomedical Engineering, Hochschule Furtwangen University, Germany; B.E. Biomedical Engineering",
    "experience": "0 years professional experience; fresh graduate",
    "skills": ["C/C++", "Python", "MATLAB", "LabVIEW", "Arduino", "embedded systems", "biosignal preprocessing", "feature extraction", "physiological signal analysis", "real-time waveform generation", "sensor interfacing", "reference-based validation", "algorithm testing", "medical devices"],
    "projects": ["ECG simulator with real-time physiological signal generation and clinical reference-monitor validation", "VICON Nexus thoracoabdominal breathing analysis", "MATLAB physiological cardiovascular modelling", "EEG/EMG preprocessing and time/frequency-domain feature extraction"],
    "languages": ["English C1", "German B1"]
}

def save(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)

def norm(v):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", str(v or "").lower())).strip()

def key(job):
    return "|".join(norm(job.get(k, "")) for k in ("company", "title", "location"))

def slug(v):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", norm(v))).strip("-")[:80]

def set_status(state, message, **extra):
    save(STATUS_PATH, {"status": state, "message": message, "updatedAt": NOW.isoformat(), **extra})

def call_openai(existing_jobs, existing_reports):
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY GitHub secret is not configured.")
    system = """
You are a Europe-wide MedTech job intelligence engine for a fresh M.Sc. Biomedical Engineering graduate. Use live web search and maximize recall while keeping a strict final eligibility gate.

GEOGRAPHIC MANDATE: search all Europe. Search Germany first, then Netherlands, Belgium, France, Switzerland, Ireland; then Denmark, Sweden, Austria, Italy, Spain; then Poland, Czechia, Portugal, Finland, Norway, Luxembourg, UK and other European MedTech markets. Do not stop after finding enough German jobs. Explicitly hunt for non-Germany graduate and young-professional programmes.

DISCOVERY PASSES:
1. Official employer career/ATS pages.
2. Graduate/young-graduate/early-career programme searches.
3. Local-language and English title searches.
4. Hidden-title adjacency: embedded/firmware, DSP/algorithm, sensors, physiological monitoring, hearing/audiology DSP, medical imaging, clinical applications, validation/test, manufacturing engineering for medical devices, research/PhD.
5. Universities, university hospitals, research institutes and national employment services.
6. Specialist boards only for discovery, followed by source verification.

STRICT CANDIDATE GATE: 0 years professional experience and already graduated. Exclude roles requiring 1+ years, 2+ years, 3+ years or professional experience unless the employer's own current vacancy explicitly accepts fresh graduates/0 years. Exclude internships, working-student jobs and thesis-only roles restricted to enrolled students. PhD/research roles are eligible when a completed M.Sc. is accepted. Do not relax the gate because a role is a good technical match.

VERIFICATION: every returned active role must have a current live application source and evidence for current/open status and graduate/experience eligibility. Prefer official employer/ATS or university/research sources. Never invent URLs, deadlines, salaries, language requirements, work authorization or status.

WORK AUTHORIZATION: evaluate the job country separately. A German residence permit or German post-study status does not automatically authorize work in another European country. Record workAuthorization as confirmed, likely, unknown, or not-established-from-source. Do not reject solely because sponsorship is not advertised; flag the risk instead. For Germany, assess relevant German eligibility separately.

CV MATCH: score 0-100 based on technical fit, biomedical/medical-device relevance, education, experience eligibility, language and material requirements. Be conservative. A 90+ score means a genuinely strong application fit. Include fit reasons and gaps.

FRESHNESS: compare against all historical jobs/reports supplied. A vacancy is FRESH only if its exact vacancy fingerprint has never appeared previously. Reposts, duplicate board copies, changed dates or different URLs for the same vacancy are not fresh. Return existingId when matching a historical record.

FALSE-NEGATIVE HUNT: deliberately search for Graduate, Young Graduate, Early Career, Recent Graduate, Young Professional, Clinical Application Specialist, Manufacturing Engineer, Development Engineer, R&D Engineer, Embedded, Algorithm, DSP, Sensor, Physiological Monitoring and Biomedical Engineering in every priority country. Do not assume that a role must contain MedTech or Biomedical Engineer in its title.
"""
    user = {"today": TODAY, "countryTiers": COUNTRY_TIERS, "searchLayers": SEARCH_LAYERS, "targetEmployers": TARGET_EMPLOYERS, "candidate": CANDIDATE, "existingJobs": existing_jobs, "existingReports": existing_reports, "task": "Run a fresh Europe-wide search now. Return all qualifying active vacancies, including strong non-Germany graduate opportunities. Also return discovered-but-excluded opportunities and reasons so false negatives can be diagnosed."}
    schema = {"type":"object","additionalProperties":False,"properties":{
        "jobs":{"type":"array","items":{"type":"object","additionalProperties":False,"properties":{
            "existingId":{"type":"string"},"title":{"type":"string"},"company":{"type":"string"},"location":{"type":"string"},"country":{"type":"string"},"category":{"type":"array","items":{"type":"string"}},"match":{"type":"integer"},"deadline":{"type":"string"},"url":{"type":"string"},"fit":{"type":"array","items":{"type":"string"}},"gaps":{"type":"array","items":{"type":"string"}},"experienceYears":{"type":"integer"},"openVerified":{"type":"boolean"},"sourceType":{"type":"string"},"sourceLayers":{"type":"array","items":{"type":"string"}},"evidence":{"type":"string"},"confidence":{"type":"integer"},"workAuthorization":{"type":"string"}
        },"required":["existingId","title","company","location","country","category","match","deadline","url","fit","gaps","experienceYears","openVerified","sourceType","sourceLayers","evidence","confidence","workAuthorization"]}},
        "statusUpdates":{"type":"array","items":{"type":"object","additionalProperties":False,"properties":{"existingId":{"type":"string"},"status":{"type":"string","enum":["active","closed","excluded"]},"reason":{"type":"string"},"url":{"type":"string"}},"required":["existingId","status","reason","url"]}},
        "excludedCandidates":{"type":"array","items":{"type":"object","additionalProperties":False,"properties":{"title":{"type":"string"},"company":{"type":"string"},"location":{"type":"string"},"country":{"type":"string"},"reason":{"type":"string"},"source":{"type":"string"}},"required":["title","company","location","country","reason","source"]}},
        "coverage":{"type":"object","additionalProperties":False,"properties":{"countriesSearched":{"type":"array","items":{"type":"string"}},"sourcesSearched":{"type":"array","items":{"type":"string"}},"layersCompleted":{"type":"array","items":{"type":"string"}},"candidateUniverseCount":{"type":"integer"},"excludedCount":{"type":"integer"},"falseNegativeHunts":{"type":"array","items":{"type":"string"}},"newSearchIdeas":{"type":"array","items":{"type":"string"}}},"required":["countriesSearched","sourcesSearched","layersCompleted","candidateUniverseCount","excludedCount","falseNegativeHunts","newSearchIdeas"]}
    },"required":["jobs","statusUpdates","excludedCandidates","coverage"]}
    body = {"model":"gpt-5.6-luna","tools":[{"type":"web_search"}],"input":[{"role":"system","content":system},{"role":"user","content":json.dumps(user, ensure_ascii=False)}],"text":{"format":{"type":"json_schema","name":"europe_medtech_research","strict":True,"schema":schema},"verbosity":"low"}}
    req = urllib.request.Request("https://api.openai.com/v1/responses", data=json.dumps(body).encode("utf-8"), headers={"Authorization":"Bearer "+api_key,"Content-Type":"application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=900) as r:
        result = json.loads(r.read().decode("utf-8"))
    text = result.get("output_text")
    if not text:
        for item in result.get("output", []):
            for c in item.get("content", []):
                if c.get("type") == "output_text":
                    text = c.get("text")
                    break
            if text: break
    if not text:
        raise RuntimeError("OpenAI returned no structured research output.")
    return json.loads(text)

def main():
    set_status("running", "Europe-wide recall-first research is running.", countryTiers=COUNTRY_TIERS, methodologyVersion="4.0-Europe")
    try:
        jobs_data = load(JOBS_PATH); reports_data = load(REPORTS_PATH)
        jobs = jobs_data.get("jobs", []); reports = reports_data.get("reports", [])
        result = call_openai(jobs, reports)
        by_id = {j.get("id"): j for j in jobs if j.get("id")}; by_key = {key(j): j for j in jobs}; seen = set(by_key)
        today_ids=[]; fresh_ids=[]
        for x in result.get("jobs", []):
            if not x.get("openVerified") or int(x.get("experienceYears",99)) != 0 or not x.get("url") or not x.get("title") or not x.get("company"):
                continue
            old = by_id.get(x.get("existingId")) if x.get("existingId") else by_key.get(key(x)); k=key(x); fresh=old is None and k not in seen
            jid = old.get("id") if old else f"{slug(x['company'])}-{slug(x['title'])}-{TODAY}"
            job = {"id":jid,"title":x["title"],"company":x["company"],"location":x["location"],"country":x["country"],"category":x["category"],"match":max(0,min(100,int(x["match"]))),"fresh":fresh,"status":"active","deadline":x.get("deadline") or None,"url":x["url"],"fit":x["fit"],"gaps":x.get("gaps") or None,"opportunityConfidence":max(0,min(100,int(x.get("confidence",70)))),"sourceType":x.get("sourceType","unknown"),"sourceLayers":x.get("sourceLayers",[]),"verificationEvidence":x.get("evidence",""),"workAuthorization":x.get("workAuthorization","unknown")}
            if old: jobs[jobs.index(old)] = job
            else: jobs.append(job)
            seen.add(k); by_key[k]=job; by_id[jid]=job; today_ids.append(jid)
            if fresh: fresh_ids.append(jid)
        for u in result.get("statusUpdates", []):
            old=by_id.get(u.get("existingId"))
            if old and u.get("status") in {"closed","excluded"}:
                old["status"]=u["status"]; old["reason"]=u.get("reason","")
        coverage=result.get("coverage",{})
        report={"date":TODAY,"activeJobs":len(today_ids),"freshJobs":len(fresh_ids),"previouslyListed":len(today_ids)-len(fresh_ids),"closingWithin7Days":0,"jobIds":today_ids,"freshJobIds":fresh_ids,"excludedJobIds":[j.get("id") for j in jobs if j.get("status")=="excluded"],"researchLayers":coverage.get("layersCompleted",[]),"sourcesSearched":coverage.get("sourcesSearched",[]),"countriesSearched":coverage.get("countriesSearched",[]),"candidateUniverseCount":coverage.get("candidateUniverseCount",0),"excludedCount":coverage.get("excludedCount",0),"falseNegativeHunts":coverage.get("falseNegativeHunts",[]),"newSearchIdeas":coverage.get("newSearchIdeas",[]),"excludedCandidates":result.get("excludedCandidates",[]),"methodologyVersion":"4.0-Europe"}
        reports.append(report)
        jobs_data["jobs"]=jobs; jobs_data["researchMethodology"]={"version":"4.0-Europe","scope":"Europe-wide","defaultCountry":"all","priority":"Germany first","cvFilter":"90%+ available","workAuthorization":"country-specific assessment"}
        reports_data["reports"]=reports
        save(JOBS_PATH,jobs_data); save(REPORTS_PATH,reports_data)
        set_status("completed","Europe-wide research completed.",activeJobs=len(today_ids),freshJobs=len(fresh_ids),countriesSearched=coverage.get("countriesSearched",[]),methodologyVersion="4.0-Europe")
    except Exception as e:
        set_status("error",str(e),methodologyVersion="4.0-Europe")
        raise

if __name__ == "__main__":
    main()
