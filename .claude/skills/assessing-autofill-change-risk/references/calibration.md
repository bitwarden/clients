# Calibration log

One entry per run. Accepted ratings are logged directly. Corrected ratings are appended only after you confirm them at Checkpoint 3. Review open entries before changing this skill. A run of accepted entries is the signal that Checkpoint 2 can be dropped. When the same proposed change shows up on two or more PRs, take it to the team and update the factor, the minimum-requirement list or the escalation list in SKILL.md. Then mark the entries `applied`.

Format:

```
- YYYY-MM-DD #<pr> accepted rated=<requirement>
- YYYY-MM-DD #<pr> corrected rated=<requirement> corrected=<requirement> cause=<factor or rule> kind=<evidence|rule> reason=<one line> proposed=<change or none> status=<open|applied|dropped>
```
