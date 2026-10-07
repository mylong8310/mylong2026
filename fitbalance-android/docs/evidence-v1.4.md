# FitBalance v1.4 Evidence Layer

This document records the evidence used by the local disease-food rule engine and the muscle recovery readiness model.

## Food × disease rules

### Gout / hyperuricemia

**American College of Rheumatology, 2020 Guideline for the Management of Gout**

- Source: https://rheumatology.org/Portals/0/Files/Gout-Guideline-Final-2020.pdf
- App scope: red/yellow/green classification for higher-purine foods, alcohol/high-fructose cautions, and lower-purine alternatives.
- Important limitation: food classification supports self-management but does not replace urate-lowering therapy or individualized treatment.

ACR patient education updated in 2025 also identifies red meat, shellfish, organ meats, alcohol (especially beer), and high-fructose drinks as important dietary exposures:
https://rheumatology.org/patients/gout

### Diabetes

**American Diabetes Association, Standards of Care in Diabetes—2026**

- Source hub: https://diabetesjournals.org/care/issue/49/Supplement_1
- App scope: carbohydrate awareness, portion context, preference for nonstarchy vegetables, whole fruits, legumes, whole grains, nuts/seeds and minimally processed foods.
- Important limitation: ADA does not endorse one fixed macronutrient distribution for everyone. App colors are guidance, not an insulin dosing rule.

### Hypertension

**2024 ESC Guidelines for the Management of Elevated Blood Pressure and Hypertension**

- Source: https://www.escardio.org/guidelines/clinical-practice-guidelines/all-esc-practice-guidelines/elevated-blood-pressure-and-hypertension/
- App scope: emphasize lower-sodium preparation, minimally processed foods, and conservative warnings when the same food is commonly consumed in salty/processed forms.
- Important limitation: the app cannot know actual sodium without recipe/package data, so generic foods are not automatically marked red.

### Cardiovascular disease

**American Heart Association, 2021 Dietary Guidance to Improve Cardiovascular Health**

- Source: https://professional.heart.org/en/science-news/2021-dietary-guidance-to-improve-cardiovascular-health
- Key pattern elements used by the app: fruits/vegetables, whole grains, healthy protein sources, plant oils, minimally processed foods, less added sugar and salt, and limited/preferably avoided alcohol.
- DOI: 10.1161/CIR.0000000000001031

## Muscle recovery / readiness model

The app deliberately calls this a **training readiness estimate**, not a biological measurement.

### Resistance exercise and muscle protein synthesis

**Characterisation of the Muscle Protein Synthetic Response to Resistance Exercise in Healthy Adults: A Systematic Review and Exploratory Meta-Analysis**

- PubMed: https://pubmed.ncbi.nlm.nih.gov/38716482/
- Key finding used: a single resistance-exercise bout can sustain measurable elevation in muscle protein synthesis from soon after exercise up to approximately 48 hours, with substantial heterogeneity by age and loading parameters.
- App implication: the model does not use a universal fixed "48 h recovered" rule.

### Exercise-induced muscle damage time course

**Appropriateness of indirect markers of muscle damage following lower limbs eccentric-biased exercises: A systematic review with meta-analysis**

- PubMed: https://pubmed.ncbi.nlm.nih.gov/35834532/
- App implication: recovery indicators have different time courses; no single marker can prove complete recovery.

**Contraction induced muscle injury: towards personalized training and recovery programs**

- PubMed: https://pubmed.ncbi.nlm.nih.gov/25352440/
- Review summary: soreness often rises during the first 24 h and may peak around 24–72 h, then subside over subsequent days.
- App implication: soreness is a modifier, not the sole recovery metric.

**Acute effects of exercise-induced muscle damage on sprint and change of direction performance: systematic review and meta-analysis**

- PubMed: https://pubmed.ncbi.nlm.nih.gov/38952917/
- Finding: performance impairment and common damage markers may remain altered up to 72 h after damaging resistance/plyometric protocols.
- App implication: high-load/high-RPE sessions use a slower readiness curve.

## Model used in v1.4

Inputs:

- elapsed hours since session
- session RPE (1–10)
- session duration
- current soreness (0–5)
- sleep duration

The app uses a monotonic exponential readiness curve whose time constant is adjusted by those inputs.

This mathematical curve is a **product heuristic informed by the evidence above**, not a validated clinical model and not a direct measurement of muscle repair.

It must not be presented as:

- injury diagnosis
- CK/biomarker estimate
- guarantee of performance
- proof that a muscle is safe to train

The app should encourage conservative judgment when soreness is high, function is impaired, or pain is sharp/localized.
