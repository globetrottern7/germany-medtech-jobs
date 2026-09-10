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


def write_status(status, message, **extra):
    payload = {
        "status": status,
        "message": message,
        "updatedAt": NOW.isoformat(),
        **extra,
    }
    with open(STATUS_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path, payload):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")


def norm(value):
    value = (value or "").lower().replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def key_for(job):
    return "|".join(norm(job.get(k, "")) for k in ("company", "title", "location"))


def slug(value):
    value = norm(value)
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")[:90]


def call_openai(existing_jobs, existing_reports):
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY GitHub secret is not configured.")

    candidate = {
        "education": "M.Sc. Biomedical Engineering, Hochschule Furtwangen University, Germany; B.E. Biomedical Engineering",
        "experience": "0 years professional experience; fresh graduate",
        "skills": [
            "C/C++", "Python", "MATLAB", "LabVIEW", "Arduino", "embedded systems",
            "biosignal preprocessing", "feature extraction", "physiological signal analysis",
            "real-time waveform generation", "sensor interfacing", "reference-based validation",
            "algorithm testing", "result analysis", "technical documentation", "medical devices"
        ],
        "projects": [
            "ECG simulator with real-time physiological signal generation, Arduino UNO R4 Minima, C/C++, LabVIEW and validation against a clinical reference monitor",
            "Thoracoabdominal breathing analysis using VICON Nexus multi-sensor motion capture data",
            "MATLAB physiological cardiovascular modelling",
            "EEG/EMG preprocessing and time/frequency-domain feature extraction"
        ],
        "languages": ["English C1", "German B1"]
    }

    system = """
You are the research engine for a Germany-wide MedTech job radar for a fresh M.Sc. Biomedical Engineering graduate.
You MUST use live web search before answering. Search broadly across Germany and prioritize official employer career pages, German university/research portals, and the German Federal Employment Agency. Job boards may be used only as secondary evidence.

STRICT ELIGIBILITY:
- Candidate has exactly 0 years professional experience and has graduated.
- Do NOT recommend internships, working-student roles, thesis-only roles restricted to enrolled students, or roles requiring several years of professional experience.
- If any credible current source explicitly states an experience requirement such as 1+ years, 2+ years, 3+ years, or "Berufserfahren", exclude it unless the employer's own current vacancy explicitly says 0 years/fresh graduates are accepted.
- Current/open status must be demonstrated by a live current source. Do not rely on stale cached snippets.
- Prefer embedded systems, biomedical signal processing, DSP, ECG/EEG/EMG, medical devices, medical imaging, regulated device development, digital health algorithms, and research/PhD roles.
- Research/PhD roles are eligible when the completed M.Sc. is accepted and the technical profile is a strong match.
- Be conservative. If current status or experience eligibility cannot be verified, exclude the vacancy.
- Do not invent salary, deadlines, URLs, experience, or application status.
- German B1 is the candidate's level. Flag jobs that explicitly require stronger German.
- A vacancy is FRESH only if the exact vacancy has never appeared in any prior report. Duplicate job-board copies, changed posting dates, or updated pages do not make it fresh.

RESEARCH METHOD:
Search multiple query families, including German and English variants for:
1) Biomedical Engineering Absolvent/Junior/Graduate
2) Embedded C/C++ medical device Medizintechnik
3) DSP signal processing biomedical medizinische Signale
4) ECG/EEG/EMG signal processing
5) medical imaging embedded/software signal processing
6) research assistant/PhD physiological signal processing
7) implant signal processing embedded
8) hearing/audiology DSP and embedded medical devices
9) digital health algorithms biomedical signals
10) regulated medical-device development for graduates
Also check the named target employers when relevant: Roche Diagnostics, GE HealthCare, Siemens Healthineers, Johnson & Johnson, Medtronic, Boston Scientific, BIOTRONIK, Dräger, Abbott, B. Braun, Stryker, Carl Zeiss Meditec, Fresenius Medical Care, plus other credible German medtech/healthtech employers and universities.

For every proposed active vacancy, verify the current source and include concise evidence for both OPEN status and experience eligibility. Never turn an ambiguous result into an active recommendation.
"""

    user = {
        "todayGermany": TODAY,
        "candidate": candidate,
        "existingJobs": existing_jobs,
        "existingReports": existing_reports,
        "task": "Perform a fresh Germany-wide search now. Return only vacancies that meet the strict active fresher criteria. Also return status updates for previously tracked vacancies when a current source clearly shows they are no longer active or no longer eligible.",
    }

    schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "jobs": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "existingId": {"type": "string"},
                        "title": {"type": "string"},
                        "company": {"type": "string"},
                        "location": {"type": "string"},
                        "category": {"type": "array", "items": {"type": "string"}},
                        "match": {"type": "integer"},
                        "deadline": {"type": "string"},
                        "url": {"type": "string"},
                        "fit": {"type": "array", "items": {"type": "string"}},
                        "gaps": {"type": "array", "items": {"type": "string"}},
                        "experienceYears": {"type": "integer"},
                        "openVerified": {"type": "boolean"},
                        "sourceType": {"type": "string"},
                        "evidence": {"type": "string"}
                    },
                    "required": ["existingId", "title", "company", "location", "category", "match", "deadline", "url", "fit", "gaps", "experienceYears", "openVerified", "sourceType", "evidence"]
                }
            },
            "statusUpdates": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "existingId": {"type": "string"},
                        "status": {"type": "string", "enum": ["active", "closed", "excluded"]},
                        "reason": {"type": "string"},
                        "url": {"type": "string"}
                    },
                    "required": ["existingId", "status", "reason", "url"]
                }
            }
        },
        "required": ["jobs", "statusUpdates"]
    }

    body = {
        "model": "gpt-5.6-luna",
        "tools": [{"type": "web_search"}],
        "input": [
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(user, ensure_ascii=False)}
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "medtech_research",
                "strict": True,
                "schema": schema
            },
            "verbosity": "low"
        }
    }

    req = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        },
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=900) as response:
        result = json.loads(response.read().decode("utf-8"))

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
    write_status("running", "Fresh Germany-wide job research is running.")
    try:
        jobs_data = load_json(JOBS_PATH)
        reports_data = load_json(REPORTS_PATH)
        existing_jobs = jobs_data.get("jobs", [])
        existing_reports = reports_data.get("reports", [])

        result = call_openai(existing_jobs, existing_reports)
        existing_by_id = {j.get("id"): j for j in existing_jobs}
        existing_by_key = {key_for(j): j for j in existing_jobs}
        seen_keys = set(existing_by_key)

        today_ids = []
        active_count = 0
        fresh_count = 0

        for item in result.get("jobs", []):
            if not item.get("openVerified") or item.get("experienceYears") != 0:
                continue
            if not item.get("url") or not item.get("title") or not item.get("company"):
                continue

            existing_id = item.get("existingId", "")
            key = key_for(item)
            old = existing_by_id.get(existing_id) if existing_id else existing_by_key.get(key)
            is_fresh = old is None and key not in seen_keys

            if old:
                job_id = old["id"]
            else:
                job_id = f"{slug(item['company'])}-{slug(item['title'])}-{TODAY}"

            job = {
                "id": job_id,
                "title": item["title"],
                "company": item["company"],
                "location": item["location"],
                "category": item["category"],
                "match": max(0, min(100, int(item["match"]))),
                "fresh": is_fresh,
                "status": "active",
                "deadline": item.get("deadline") or None,
                "url": item["url"],
                "fit": item["fit"],
                "gaps": item["gaps"] or None
            }

            if old:
                idx = existing_jobs.index(old)
                existing_jobs[idx] = job
            else:
                existing_jobs.append(job)

            seen_keys.add(key)
            today_ids.append(job_id)
            active_count += 1
            if is_fresh:
                fresh_count += 1

        for update in result.get("statusUpdates", []):
            existing_id = update.get("existingId")
            old = existing_by_id.get(existing_id)
            if not old:
                continue
            if update.get("status") in {"closed", "excluded"}:
                old["status"] = update["status"]
                old["reason"] = update.get("reason", "")
                if update.get("url"):
                    old["url"] = update["url"]

        closing = 0
        for jid in today_ids:
            job = existing_by_id.get(jid) or next((x for x in existing_jobs if x["id"] == jid), None)
            if job and job.get("deadline"):
                try:
                    d = datetime.strptime(job["deadline"], "%Y-%m-%d").date()
                    if 0 <= (d - NOW.date()).days <= 7:
                        closing += 1
                except ValueError:
                    pass

        report = {
            "date": TODAY,
            "activeJobs": active_count,
            "freshJobs": fresh_count,
            "previouslyListed": active_count - fresh_count,
            "closingWithin7Days": closing,
            "jobIds": today_ids,
            "excludedJobIds": [j["id"] for j in existing_jobs if j.get("status") == "excluded" and j.get("id", "").endswith(TODAY)]
        }

        existing_reports = [r for r in existing_reports if r.get("date") != TODAY]
        existing_reports.append(report)
        existing_reports.sort(key=lambda x: x.get("date", ""))

        jobs_data["lastUpdated"] = TODAY
        jobs_data["jobs"] = existing_jobs
        reports_data["reports"] = existing_reports
        save_json(JOBS_PATH, jobs_data)
        save_json(REPORTS_PATH, reports_data)
        write_status("complete", f"Research complete: {active_count} active qualifying vacancies, {fresh_count} fresh.", activeJobs=active_count, freshJobs=fresh_count, reportDate=TODAY)
        print(json.dumps({"activeJobs": active_count, "freshJobs": fresh_count, "reportDate": TODAY}))
    except Exception as exc:
        write_status("error", str(exc))
        print(str(exc), file=sys.stderr)
        raise


if __name__ == "__main__":
    main()
