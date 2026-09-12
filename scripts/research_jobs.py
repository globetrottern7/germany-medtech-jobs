import json
import os
import re
import time
import random
import urllib.request
import urllib.error
from datetime import datetime
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JOBS_PATH = os.path.join(ROOT, "data", "jobs.json")
REPORTS_PATH = os.path.join(ROOT, "data", "reports.json")
STATUS_PATH = os.path.join(ROOT, "data", "research-status.json")
BERLIN = ZoneInfo("Europe/Berlin")
NOW = datetime.now(BERLIN)
TODAY = NOW.strftime("%Y-%m-%d")
METHODOLOGY_VERSION = "5.0-Europe-compact-history"

COUNTRY_TIERS = [
    ["Germany", "Netherlands", "Belgium", "France", "Switzerland", "Ireland"],
    ["Denmark", "Sweden", "Austria", "Italy", "Spain"],
    ["Poland", "Czechia", "Portugal", "Finland", "Norway", "Luxembourg", "United Kingdom", "other European MedTech markets"],
]

SEARCH_LAYERS = {
    "official_careers_and_ats": ["official employer career sites", "official ATS pages", "European MedTech companies"],
    "ats_discovery": ["Workday", "Greenhouse", "Lever", "SmartRecruiters", "SAP SuccessFactors", "Personio", "Teamtailor", "Recruitee", "university ATS"],
    "english_titles": ["Biomedical Engineer", "Graduate Engineer", "Junior Engineer", "Graduate Program", "Young Graduate", "Early Career", "R&D Engineer", "Development Engineer", "Embedded Software Engineer", "Firmware Engineer", "Algorithm Engineer", "DSP Engineer", "Clinical Application Specialist", "Validation Engineer", "Test Engineer", "Research Engineer", "Manufacturing Engineer"],
    "local_language_titles": ["Entwicklungsingenieur", "Embedded Softwareentwickler", "Firmwareentwickler", "Softwareentwickler Medizintechnik", "Applikationsingenieur", "Prüfingenieur", "Systemingenieur", "Forschungsingenieur", "Wissenschaftlicher Mitarbeiter", "Doktorand", "Signalverarbeitung", "Biosignalverarbeitung", "Messtechnik"],
    "graduate_terms": ["Graduate", "Junior", "Trainee", "Young Professional", "Young Graduate", "Early Career", "Recent Graduate", "Absolvent", "Berufseinsteiger", "0 years", "no experience", "entry level"],
    "skill_adjacency": ["ECG", "EKG", "EEG", "EMG", "electrophysiology", "biosignal", "physiological monitoring", "DSP", "signal processing", "feature extraction", "C/C++", "embedded", "firmware", "real-time", "sensor interfacing", "medical device", "medical imaging", "wearables", "hearing DSP", "V&V", "IEC 62304", "MDR"],
    "research_ecosystem": ["universities", "university hospitals", "Fraunhofer", "Helmholtz", "Max Planck", "Leibniz", "research institutes", "PhD Biomedical Engineering"],
    "hidden_titles": ["Development Engineer Sensors", "Research Engineer Wearable Systems", "Software Engineer Physiological Monitoring", "Algorithm Engineer", "Test Engineer Medical Devices", "Embedded Developer Measurement Systems", "Clinical Application Specialist", "Manufacturing Engineer Biomedical", "Systems Engineer Medical Devices"],
    "regional_sources": ["national employment services", "European specialist job boards", "regional career portals"],
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
    save(STATUS_PATH, {"status": state, "message": message, "updatedAt": NOW.isoformat(), "methodologyVersion": METHODOLOGY_VERSION, **extra})


def compact_history(existing_jobs, existing_reports):
    """Build a compact historical identity set instead of sending full data files."""
    fingerprints = []
    for job in existing_jobs:
        fingerprints.append({
            "id": str(job.get("id", "")),
            "company": str(job.get("company", "")),
            "title": str(job.get("title", "")),
            "location": str(job.get("location", "")),
            "country": str(job.get("country", "")),
            "url": str(job.get("url", "")),
        })
    report_history = []
    for report in existing_reports[-30:]:
        report_history.append({
            "date": report.get("date"),
            "jobIds": report.get("jobIds", []),
            "freshJobIds": report.get("freshJobIds", []),
            "excludedJobIds": report.get("excludedJobIds", []),
        })
    return fingerprints, report_history


def build_schema():
    return {
        "type": "object", "additionalProperties": False,
        "properties": {
            "jobs": {"type": "array", "items": {"type": "object", "additionalProperties": False, "properties": {
                "existingId": {"type": "string"}, "title": {"type": "string"}, "company": {"type": "string"}, "location": {"type": "string"}, "country": {"type": "string"},
                "category": {"type": "array", "items": {"type": "string"}}, "match": {"type": "integer"}, "deadline": {"type": "string"}, "url": {"type": "string"},
                "fit": {"type": "array", "items": {"type": "string"}}, "gaps": {"type": "array", "items": {"type": "string"}}, "experienceYears": {"type": "integer"},
                "openVerified": {"type": "boolean"}, "sourceType": {"type": "string"}, "sourceLayers": {"type": "array", "items": {"type": "string"}},
                "evidence": {"type": "string"}, "confidence": {"type": "integer"}, "workAuthorization": {"type": "string"}
            }, "required": ["existingId", "title", "company", "location", "country", "category", "match", "deadline", "url", "fit", "gaps", "experienceYears", "openVerified", "sourceType", "sourceLayers", "evidence", "confidence", "workAuthorization"]}},
            "statusUpdates": {"type": "array", "items": {"type": "object", "additionalProperties": False, "properties": {
                "existingId": {"type": "string"}, "status": {"type": "string", "enum": ["active", "closed", "excluded"]}, "reason": {"type": "string"}, "url": {"type": "string"}
            }, "required": ["existingId", "status", "reason", "url"]}},
            "excludedCandidates": {"type": "array", "items": {"type": "object", "additionalProperties": False, "properties": {
                "title": {"type": "string"}, "company": {"type": "string"}, "location": {"type": "string"}, "country": {"type": "string"}, "reason": {"type": "string"}, "source": {"type": "string"}
            }, "required": ["title", "company", "location", "country", "reason", "source"]}},
            "coverage": {"type": "object", "additionalProperties": False, "properties": {
                "countriesSearched": {"type": "array", "items": {"type": "string"}}, "sourcesSearched": {"type": "array", "items": {"type": "string"}}, "layersCompleted": {"type": "array", "items": {"type": "string"}},
                "candidateUniverseCount": {"type": "integer"}, "excludedCount": {"type": "integer"}, "falseNegativeHunts": {"type": "array", "items": {"type": "string"}}, "newSearchIdeas": {"type": "array", "items": {"type": "string"}}
            }, "required": ["countriesSearched", "sourcesSearched", "layersCompleted", "candidateUniverseCount", "excludedCount", "falseNegativeHunts", "newSearchIdeas"]}
        },
        "required": ["jobs", "statusUpdates", "excludedCandidates", "coverage"]
    }


def call_openai(existing_jobs, existing_reports):
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY GitHub secret is not configured.")

    historical_fingerprints, report_history = compact_history(existing_jobs, existing_reports)

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

FRESHNESS: use the historical vacancy fingerprints supplied in the user payload. A vacancy is FRESH only if its exact vacancy fingerprint (company + title + location) has never appeared previously. Reposts, duplicate board copies, changed dates or different URLs for the same vacancy are not fresh. Return existingId when matching a historical record. The local post-processing script also rechecks freshness.

FALSE-NEGATIVE HUNT: deliberately search for Graduate, Young Graduate, Early Career, Recent Graduate, Young Professional, Clinical Application Specialist, Manufacturing Engineer, Development Engineer, R&D Engineer, Embedded, Algorithm, DSP, Sensor, Physiological Monitoring and Biomedical Engineering in every priority country. Do not assume that a role must contain MedTech or Biomedical Engineer in its title.

OUTPUT DISCIPLINE: return only evidence-backed qualifying jobs in jobs. Put discovered-but-excluded roles in excludedCandidates. Keep evidence concise but specific enough to explain why the role is open and fresher-eligible.
"""

    user = {
        "today": TODAY,
        "countryTiers": COUNTRY_TIERS,
        "searchLayers": SEARCH_LAYERS,
        "targetEmployers": TARGET_EMPLOYERS,
        "candidate": CANDIDATE,
        "historicalVacancyFingerprints": historical_fingerprints,
        "recentReportAudit": report_history,
        "task": "Run a fresh Europe-wide search now. Return all qualifying active vacancies, including strong non-Germany graduate opportunities. Also return discovered-but-excluded opportunities and reasons so false negatives can be diagnosed. Search every country tier rather than stopping early."
    }

    body = {
        "model": "gpt-5.6-luna",
        "tools": [{"type": "web_search"}],
        "input": [{"role": "system", "content": system}, {"role": "user", "content": json.dumps(user, ensure_ascii=False, separators=(",", ":"))}],
        "text": {"format": {"type": "json_schema", "name": "europe_medtech_research", "strict": True, "schema": build_schema()}, "verbosity": "low"}
    }
    data = json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    headers = {"Authorization": "Bearer " + api_key, "Content-Type": "application/json", "User-Agent": "europe-medtech-jobs-research/5.0"}

    max_attempts = 6
    retryable = {408, 409, 429, 500, 502, 503, 504}
    result = None

    for attempt in range(1, max_attempts + 1):
        req = urllib.request.Request("https://api.openai.com/v1/responses", data=data, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=900) as response:
                result = json.loads(response.read().decode("utf-8"))
            break
        except urllib.error.HTTPError as exc:
            if exc.code not in retryable or attempt == max_attempts:
                error_body = ""
                try:
                    error_body = exc.read().decode("utf-8", errors="replace")[:1000]
                except Exception:
                    pass
                raise RuntimeError(f"OpenAI API HTTP {exc.code}: {error_body}") from exc
            retry_after = exc.headers.get("Retry-After")
            try:
                wait = float(retry_after) if retry_after else min(120.0, 8.0 * (2 ** (attempt - 1)))
            except (TypeError, ValueError):
                wait = min(120.0, 8.0 * (2 ** (attempt - 1)))
            wait = min(120.0, max(5.0, wait)) + random.uniform(0, 2)
            set_status("retrying", f"OpenAI transient HTTP {exc.code}; retry {attempt}/{max_attempts} in {wait:.0f}s.", retryAttempt=attempt, requestBytes=len(data))
            time.sleep(wait)
        except (urllib.error.URLError, TimeoutError) as exc:
            if attempt == max_attempts:
                raise RuntimeError(f"OpenAI network request failed after {max_attempts} attempts: {exc}") from exc
            wait = min(120.0, 8.0 * (2 ** (attempt - 1))) + random.uniform(0, 2)
            set_status("retrying", f"OpenAI network error; retry {attempt}/{max_attempts} in {wait:.0f}s.", retryAttempt=attempt, requestBytes=len(data))
            time.sleep(wait)

    if result is None:
        raise RuntimeError("OpenAI research request exhausted all retries without a response.")

    text = result.get("output_text")
    if not text:
        for item in result.get("output", []):
            for content in item.get("content", []):
                if content.get("type") == "output_text":
                    text = content.get("text")
                    break
            if text:
                break
    if not text:
        raise RuntimeError("OpenAI returned no structured research output.")
    return json.loads(text)


def main():
    set_status("running", "Europe-wide recall-first research is running.", countryTiers=COUNTRY_TIERS)
    try:
        jobs_data = load(JOBS_PATH)
        reports_data = load(REPORTS_PATH)
        jobs = jobs_data.get("jobs", [])
        reports = reports_data.get("reports", [])
        result = call_openai(jobs, reports)

        by_id = {j.get("id"): j for j in jobs if j.get("id")}
        by_key = {key(j): j for j in jobs}
        seen = set(by_key)
        today_ids = []
        fresh_ids = []

        for x in result.get("jobs", []):
            if not x.get("openVerified") or int(x.get("experienceYears", 99)) != 0 or not x.get("url") or not x.get("title") or not x.get("company"):
                continue
            k = key(x)
            old = by_id.get(x.get("existingId")) if x.get("existingId") else by_key.get(k)
            fresh = old is None and k not in seen
            jid = old.get("id") if old else f"{slug(x['company'])}-{slug(x['title'])}-{TODAY}"
            job = {
                "id": jid, "title": x["title"], "company": x["company"], "location": x["location"], "country": x["country"], "category": x["category"],
                "match": max(0, min(100, int(x["match"]))), "fresh": fresh, "status": "active", "deadline": x.get("deadline") or None, "url": x["url"],
                "fit": x["fit"], "gaps": x.get("gaps") or None, "opportunityConfidence": max(0, min(100, int(x.get("confidence", 70)))),
                "sourceType": x.get("sourceType", "unknown"), "sourceLayers": x.get("sourceLayers", []), "verificationEvidence": x.get("evidence", ""),
                "workAuthorization": x.get("workAuthorization", "unknown")
            }
            if old:
                jobs[jobs.index(old)] = job
            else:
                jobs.append(job)
            seen.add(k)
            by_key[k] = job
            by_id[jid] = job
            today_ids.append(jid)
            if fresh:
                fresh_ids.append(jid)

        for update in result.get("statusUpdates", []):
            old = by_id.get(update.get("existingId"))
            if old and update.get("status") in {"closed", "excluded"}:
                old["status"] = update["status"]
                old["reason"] = update.get("reason", "")

        coverage = result.get("coverage", {})
        excluded = result.get("excludedCandidates", [])
        active_ids = [j.get("id") for j in jobs if j.get("status") == "active"]
        report = {
            "date": TODAY,
            "activeJobs": len(active_ids),
            "freshJobs": len(fresh_ids),
            "previouslyListed": max(0, len(today_ids) - len(fresh_ids)),
            "closingWithin7Days": sum(1 for j in jobs if j.get("status") == "active" and j.get("deadline")),
            "jobIds": active_ids,
            "freshJobIds": fresh_ids,
            "excludedJobIds": [j.get("id") for j in jobs if j.get("status") == "excluded"],
            "coverage": coverage,
            "excludedCandidates": excluded,
            "methodologyVersion": METHODOLOGY_VERSION
        }
        reports = [r for r in reports if r.get("date") != TODAY]
        reports.append(report)
        reports = reports[-60:]

        jobs_data["lastUpdated"] = TODAY
        jobs_data["researchMethodology"] = {
            "version": METHODOLOGY_VERSION,
            "scope": "Europe-wide, Germany prioritized",
            "countries": COUNTRY_TIERS,
            "freshnessRule": "Exact company + title + location vacancy fingerprint; reposts and duplicate URLs are not fresh.",
            "eligibility": "0 years professional experience; completed degree; strict exclusion of experience-required roles unless employer explicitly accepts fresh graduates.",
            "verification": "Current live application source required; official employer/ATS or university/research sources prioritized.",
            "workAuthorization": "Country-specific assessment; German residence/post-study status does not automatically authorize employment elsewhere in Europe."
        }
        reports_data["reports"] = reports

        save(JOBS_PATH, jobs_data)
        save(REPORTS_PATH, reports_data)
        set_status("completed", f"Europe-wide research completed: {len(fresh_ids)} fresh qualifying jobs, {len(today_ids)} qualifying jobs reviewed.", coverage=coverage, freshJobIds=fresh_ids, jobIds=today_ids, excludedCount=len(excluded))
    except Exception as exc:
        set_status("error", str(exc))
        raise


if __name__ == "__main__":
    main()
