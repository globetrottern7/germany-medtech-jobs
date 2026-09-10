import json
import os
import re
import sys
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JOBS_PATH = os.path.join(REPO_ROOT, "data", "jobs.json")
REPORTS_PATH = os.path.join(REPO_ROOT, "data", "reports.json")
STATUS_PATH = os.path.join(REPO_ROOT, "data", "research-status.json")
BERLIN = ZoneInfo("Europe/Berlin")
NOW = datetime.now(BERLIN)
TODAY = NOW.strftime("%Y-%m-%d")

# Broad-recall research plan. The model is instructed to search these families in parallel,
# then a strict adjudication pass removes false positives.
SEARCH_LAYERS = {
    "employer_careers": ["official employer career sites", "company ATS pages"],
    "ats_discovery": ["Workday", "Greenhouse", "Lever", "SmartRecruiters", "SAP SuccessFactors", "Personio", "Workable", "Recruitee", "Teamtailor", "Softgarden", "Prescreen", "university ATS"],
    "german_titles": ["Entwicklungsingenieur", "Embedded Softwareentwickler", "Firmwareentwickler", "Softwareentwickler Medizintechnik", "Applikationsingenieur", "Prüfingenieur", "Systemingenieur", "Versuchsingenieur", "Forschungsingenieur", "Wissenschaftlicher Mitarbeiter", "Doktorand", "Signalverarbeitung", "Biosignalverarbeitung", "Messtechnik", "Elektronikentwicklung", "Geräteentwicklung"],
    "entry_level_terms": ["Absolvent", "Berufseinsteiger", "Junior", "Graduate", "Trainee", "Nachwuchsingenieur", "Young Professional"],
    "skill_adjacency": ["ECG/EKG", "EEG", "EMG", "electrophysiology", "arrhythmia", "biosignal", "time-series", "feature extraction", "DSP", "C/C++", "MCU", "RTOS", "ARM", "STM32", "sensor interfacing", "medical device", "Medizinprodukte", "IEC 60601", "IEC 62304", "MDR", "V&V"],
    "research_ecosystem": ["universities", "university hospitals", "Fraunhofer", "Helmholtz", "Max Planck", "Leibniz", "DLR", "research institutes"],
    "hidden_titles": ["Development Engineer Sensors", "Research Engineer Wearable Systems", "Software Engineer Physiological Monitoring", "Algorithm Engineer", "Test Engineer Medical Devices", "Embedded Developer Measurement Systems"],
    "regional_and_general": ["Federal Employment Agency", "Make it in Germany", "specialist job boards", "regional portals"],
}

TARGET_EMPLOYERS = ["Roche Diagnostics", "GE HealthCare", "Siemens Healthineers", "Johnson & Johnson", "Medtronic", "Boston Scientific", "BIOTRONIK", "Dräger", "Abbott", "B. Braun", "Stryker", "Carl Zeiss Meditec", "Fresenius Medical Care"]

def write_status(status, message, **extra):
    with open(STATUS_PATH, "w", encoding="utf-8") as f:
        json.dump({"status": status, "message": message, "updatedAt": NOW.isoformat(), **extra}, f, ensure_ascii=False, indent=2)

def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def save_json(path, payload):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")

def norm(value):
    value = (value or "").lower().replace("&", " and ")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", value)).strip()

def key_for(job):
    return "|".join(norm(job.get(k, "")) for k in ("company", "title", "location"))

def fingerprint(job):
    text = "|".join([job.get("company", ""), job.get("title", ""), job.get("location", ""), " ".join(job.get("category", []))])
    return re.sub(r"[^a-z0-9]+", "", text.lower())[:180]

def slug(value):
    return re.sub(r"[^a-z0-9]+", "-", norm(value)).strip("-")[:90]

def call_openai(existing_jobs, existing_reports):
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY GitHub secret is not configured.")
    candidate = {
        "education": "M.Sc. Biomedical Engineering, Hochschule Furtwangen University, Germany; B.E. Biomedical Engineering",
        "experience": "0 years professional experience; fresh graduate",
        "skills": ["C/C++", "Python", "MATLAB", "LabVIEW", "Arduino", "embedded systems", "biosignal preprocessing", "feature extraction", "physiological signal analysis", "real-time waveform generation", "sensor interfacing", "reference-based validation", "algorithm testing", "result analysis", "technical documentation", "medical devices"],
        "projects": ["ECG simulator with real-time physiological signal generation, Arduino UNO R4 Minima, C/C++, LabVIEW and validation against a clinical reference monitor", "Thoracoabdominal breathing analysis using VICON Nexus multi-sensor motion capture data", "MATLAB physiological cardiovascular modelling", "EEG/EMG preprocessing and time/frequency-domain feature extraction"],
        "languages": ["English C1", "German B1"]
    }
    system = """
You are a high-recall, high-precision Germany-wide MedTech job intelligence engine for a fresh M.Sc. Biomedical Engineering graduate.
Use live web search. Your objective is to minimize false negatives without relaxing the final eligibility gate.

RESEARCH IN 3 PASSES:
PASS 1 — DISCOVERY: search broadly across employer career pages, ATS platforms, universities/university hospitals, research institutes, Federal Employment Agency, specialist/general boards and regional portals. Use German + English synonyms and hidden-title searches. Search the target employers and adjacent employers.
PASS 2 — ADJACENCY: deliberately hunt roles whose titles do not say Biomedical Engineering: embedded/firmware, DSP/algorithm, sensors, measurement systems, electrophysiology, hearing/audiology DSP, physiological monitoring, medical imaging, regulated device development, test/verification, research engineering and PhD/Wissenschaftlicher Mitarbeiter roles.
PASS 3 — ADJUDICATION: verify the exact live vacancy, application URL, experience requirement, graduate eligibility, location, language, employment type and deadline. Treat ambiguous evidence as excluded.

STRICT ELIGIBILITY:
- Candidate has exactly 0 years professional experience and has graduated.
- Exclude internships, working-student roles, thesis-only roles restricted to enrolled students, and roles requiring professional experience.
- If ANY credible current source explicitly states 1+ years, 2+ years, 3+ years or "Berufserfahren", exclude unless the employer's own current vacancy explicitly accepts fresh graduates/0 years.
- Current/open status must be demonstrated by a live current source. Never rely on stale cached snippets.
- Research/PhD roles are eligible when a completed M.Sc. is accepted and the technical fit is strong.
- German B1: flag roles that explicitly require stronger German.
- Never invent salary, deadline, URL, experience, status or eligibility.
- FRESH means exact vacancy fingerprint has never appeared in any prior report. A repost, changed date, duplicate board copy or URL change is not automatically Fresh.

SOURCE PRIORITY: official employer/ATS and official university/research portals > Federal Employment Agency > specialist boards > general boards/search snippets.

SEARCH FAMILIES TO COVER:
1. Biomedical Engineering Absolvent/Junior/Graduate
2. Entwicklungsingenieur / Embedded Softwareentwickler / Firmwareentwickler / Softwareentwickler Medizintechnik
3. DSP / Signalverarbeitung / Biosignalverarbeitung / Messtechnik
4. ECG/EKG, EEG, EMG, electrophysiology, arrhythmia
5. Medical imaging / imaging hardware/software / reconstruction / measurement
6. Embedded C/C++, MCU, ARM, RTOS, sensor interfacing
7. Medical devices / Medizinprodukte / IEC 60601 / IEC 62304 / MDR / V&V
8. Physiological monitoring / wearables / hearing-audio DSP / digital health algorithms
9. Research assistant / Wissenschaftlicher Mitarbeiter / Doktorand / PhD
10. Hidden titles: Development Engineer Sensors, Research Engineer Wearable Systems, Algorithm Engineer, Test Engineer Medical Devices, Embedded Developer Measurement Systems
11. Target employers: Roche Diagnostics, GE HealthCare, Siemens Healthineers, Johnson & Johnson, Medtronic, Boston Scientific, BIOTRONIK, Dräger, Abbott, B. Braun, Stryker, Carl Zeiss Meditec, Fresenius Medical Care, plus other credible German employers.
12. University/research ecosystem: university hospitals, Fraunhofer, Helmholtz, Max Planck, Leibniz, DLR and German universities.

For every proposed active vacancy, provide evidence that explicitly supports current OPEN status and the experience/graduate eligibility decision. If evidence conflicts, exclude it.
"""
    user = {
        "todayGermany": TODAY,
        "candidate": candidate,
        "existingJobs": existing_jobs,
        "existingReports": existing_reports,
        "researchLayers": SEARCH_LAYERS,
        "targetEmployers": TARGET_EMPLOYERS,
        "task": "Perform a fresh Germany-wide recall-first search now. Return qualifying active vacancies, conservative status updates, source-coverage metrics, discovered-but-excluded opportunities, and missed-opportunity hypotheses. Do not include candidate PII."
    }
    schema = {"type":"object","additionalProperties":False,"properties":{
        "jobs":{"type":"array","items":{"type":"object","additionalProperties":False,"properties":{
            "existingId":{"type":"string"},"title":{"type":"string"},"company":{"type":"string"},"location":{"type":"string"},"category":{"type":"array","items":{"type":"string"}},"match":{"type":"integer"},"deadline":{"type":"string"},"url":{"type":"string"},"fit":{"type":"array","items":{"type":"string"}},"gaps":{"type":"array","items":{"type":"string"}},"experienceYears":{"type":"integer"},"openVerified":{"type":"boolean"},"sourceType":{"type":"string"},"sourceLayers":{"type":"array","items":{"type":"string"}},"evidence":{"type":"string"},"confidence":{"type":"integer"}
        },"required":["existingId","title","company","location","category","match","deadline","url","fit","gaps","experienceYears","openVerified","sourceType","sourceLayers","evidence","confidence"]}},
        "statusUpdates":{"type":"array","items":{"type":"object","additionalProperties":False,"properties":{"existingId":{"type":"string"},"status":{"type":"string","enum":["active","closed","excluded"]},"reason":{"type":"string"},"url":{"type":"string"}},"required":["existingId","status","reason","url"]}},
        "coverage":{"type":"object","additionalProperties":False,"properties":{"sourcesSearched":{"type":"array","items":{"type":"string"}},"layersCompleted":{"type":"array","items":{"type":"string"}},"candidateUniverseCount":{"type":"integer"},"excludedCount":{"type":"integer"},"falseNegativeHunts":{"type":"array","items":{"type":"string"}},"newSearchIdeas":{"type":"array","items":{"type":"string"}}},"required":["sourcesSearched","layersCompleted","candidateUniverseCount","excludedCount","falseNegativeHunts","newSearchIdeas"]}
    },"required":["jobs","statusUpdates","coverage"]}
    body = {"model":"gpt-5.6-luna","tools":[{"type":"web_search"}],"input":[{"role":"system","content":system},{"role":"user","content":json.dumps(user,ensure_ascii=False)}],"text":{"format":{"type":"json_schema","name":"medtech_research","strict":True,"schema":schema},"verbosity":"low"}}
    req = urllib.request.Request("https://api.openai.com/v1/responses",data=json.dumps(body).encode("utf-8"),headers={"Authorization":f"Bearer {api_key}","Content-Type":"application/json"},method="POST")
    with urllib.request.urlopen(req, timeout=900) as response:
        result=json.loads(response.read().decode("utf-8"))
    text=result.get("output_text")
    if not text:
        for item in result.get("output",[]):
            for content in item.get("content",[]):
                if content.get("type")=="output_text": text=content.get("text"); break
            if text: break
    if not text: raise RuntimeError("OpenAI returned no structured research output.")
    return json.loads(text)

def main():
    write_status("running","Recall-first multi-layer Germany-wide research is running.",layers=list(SEARCH_LAYERS))
    try:
        jobs_data=load_json(JOBS_PATH); reports_data=load_json(REPORTS_PATH)
        existing_jobs=jobs_data.get("jobs",[]); existing_reports=reports_data.get("reports",[])
        result=call_openai(existing_jobs,existing_reports)
        existing_by_id={j.get("id"):j for j in existing_jobs}; existing_by_key={key_for(j):j for j in existing_jobs}; seen_keys=set(existing_by_key)
        today_ids=[]; fresh_ids=[]; active_count=0; fresh_count=0
        for item in result.get("jobs",[]):
            if not item.get("openVerified") or item.get("experienceYears")!=0 or not item.get("url") or not item.get("title") or not item.get("company"): continue
            existing_id=item.get("existingId",""); key=key_for(item); old=existing_by_id.get(existing_id) if existing_id else existing_by_key.get(key); is_fresh=old is None and key not in seen_keys
            job_id=old["id"] if old else f"{slug(item['company'])}-{slug(item['title'])}-{TODAY}"
            job={"id":job_id,"title":item["title"],"company":item["company"],"location":item["location"],"category":item["category"],"match":max(0,min(100,int(item["match"]))),"fresh":is_fresh,"status":"active","deadline":item.get("deadline") or None,"url":item["url"],"fit":item["fit"],"gaps":item["gaps"] or None,"opportunityConfidence":max(0,min(100,int(item.get("confidence",70)))),"sourceType":item.get("sourceType","unknown"),"sourceLayers":item.get("sourceLayers",[]),"verificationEvidence":item.get("evidence","")}
            if old: existing_jobs[existing_jobs.index(old)]=job
            else: existing_jobs.append(job)
            seen_keys.add(key); today_ids.append(job_id); active_count+=1
            if is_fresh: fresh_ids.append(job_id); fresh_count+=1
        for update in result.get("statusUpdates",[]):
            old=existing_by_id.get(update.get("existingId"))
            if old and update.get("status") in {"closed","excluded"}:
                old["status"]=update["status"]; old["reason"]=update.get("reason","")
                if update.get("url"): old["url"]=update["url"]
        closing=0
        for jid in today_ids:
            job=next((x for x in existing_jobs if x["id"]==jid),None)
            if job and job.get("deadline"):
                try:
                    d=datetime.strptime(job["deadline"],"%Y-%m-%d").date()
                    if 0 <= (d-NOW.date()).days <= 7: closing+=1
                except ValueError: pass
        coverage=result.get("coverage",{})
        report={"date":TODAY,"activeJobs":active_count,"freshJobs":fresh_count,"previouslyListed":active_count-fresh_count,"closingWithin7Days":closing,"jobIds":today_ids,"freshJobIds":fresh_ids,"excludedJobIds":[j["id"] for j in existing_jobs if j.get("status")=="excluded"],"researchLayers":coverage.get("layersCompleted",[]),"sourcesSearched":coverage.get("sourcesSearched",[]),"candidateUniverseCount":coverage.get("candidateUniverseCount",0),"excludedCount":coverage.get("excludedCount",0),"falseNegativeHunts":coverage.get("falseNegativeHunts",[]),"newSearchIdeas":coverage.get("newSearchIdeas",[])}
        existing_reports=[r for r in existing_reports if r.get("date")!=TODAY]; existing_reports.append(report); existing_reports.sort(key=lambda x:x.get("date",""))
        jobs_data["lastUpdated"]=TODAY; jobs_data["jobs"]=existing_jobs; jobs_data["researchMethodology"]={"version":"2.0","mode":"recall-first / strict-adjudication","layers":SEARCH_LAYERS}
        reports_data["reports"]=existing_reports
        save_json(JOBS_PATH,jobs_data); save_json(REPORTS_PATH,reports_data)
        write_status("complete",f"Research complete: {active_count} active qualifying vacancies, {fresh_count} fresh.",activeJobs=active_count,freshJobs=fresh_count,reportDate=TODAY,coverage=coverage)
        print(json.dumps({"activeJobs":active_count,"freshJobs":fresh_count,"reportDate":TODAY,"coverage":coverage}))
    except Exception as exc:
        write_status("error",str(exc)); print(str(exc),file=sys.stderr); raise

if __name__=="__main__": main()
