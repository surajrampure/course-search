# Shared course search

One search interface, modal, ranking engine, and pinned local embedding model for Math 124 and EECS 245. Each course owns its configuration, released-material importer, transcripts, index, and vectors. Search runs on the student's device.

The shared deployment target is `https://rampure.org/course-search/v1/`. Both sites load its modal script and styles, and open the same app with `?embedded=1&config=<course configuration URL>`. A deployment here updates both interfaces without rebuilding either course website. Changes that break the configuration, index schema, or embedding model need a new major directory, such as `/v2/`; retain `/v1/` until both courses migrate. Built app and worker filenames include content hashes to keep releases consistent; browsers may retain the entry page briefly under the host's normal cache policy.

## Build and verify

Node 22 or newer is required.

```sh
npm ci
npm test
npm run build
```

The GitHub Actions deployment builds the common app into `/v1/`. Enable GitHub Pages with **GitHub Actions** as the source. The model, ONNX runtime, fonts, and licenses are self-hosted; no model service or key is needed. The initial model/runtime download is about 45 MB and is cached thereafter.

## Course configuration

Store this in each course's `assets/course-search/config.json`:

```json
{
  "courseName": "Math 124",
  "websiteURL": "https://math124.org",
  "categories": ["Lectures", "Notes", "Homeworks", "Labs"],
  "dataBase": "./data/",
  "lecturePDFLabel": "Open worksheet",
  "queryShorthand": {},
  "footerLinks": [{"label": "Course notes", "url": "https://notes.math124.org"}]
}
```

EECS 245 additionally enables `Past exams`, preserves `absolute` as shorthand for `absolute loss`, and supplies cached recording thumbnails. New courses require adding their origin to `public/course-config.mjs` and the app's content security policy. Configuration and data must share an origin; the course host must allow cross-origin asset reads. Frame messages check both the exact origin and window. Lecture players are contacted only when someone opens a recording link.

Courses may also enable `Other videos`. Each curated video is a title-only record with a direct watch URL; the category appears only when included in the course configuration.

## Course index build

Course importers produce `search-index.json` with `{records, metadata}`. Records use the existing categories `Notes`, `Homeworks`, `Labs`, `Past exams`, `Lecture PDFs`, and `Lecture recordings`. They carry `id`, `title`, `section`, `text`, `url`, `concepts`, and `releaseAt`; recording passages additionally carry authentic `start`, `end`, `recordingUrl`, `recordingId`, and `lectureDate`.

Run from this checkout:

```sh
npm run embed
```

This first splits long passages to the pinned tokenizer's full 256-token limit, including the exact embedding input. It then computes normalized 384-dimensional vectors with mean pooling and the pinned quantized MiniLM model. Unchanged embedding inputs reuse existing vectors. Copy `public/data/` to the course's `assets/course-search/data/`, alongside its config. Course websites rebuild their own indexes on deployment; authenticated captions are imported separately and cached before building. Future or unpublished material must be excluded by the importer, never merely hidden by the UI.

Real-data checks can be enabled with `MATH124_DATA` and `EECS245_DATA`, each pointing to a directory containing `index.json` and `vectors.f32`. Tests cover model-based retrieval, course aliases, query cancellation, category filtering, recording moments, and the configurable interface. Synthetic fixtures live only in tests.

Math 124's initial snapshot contains lectures 1–10, worksheets 6–10, 14 published notes, homeworks 1–4, and labs 1–5. Lab 5 is a homework work session and links to the schedule. Caption passages come from the authenticated player's visible timestamped transcript; before/after-class chatter is trimmed using reviewed ranges. Transcript text may contain provider errors. Raw capture and credentials are not deployed.

Search combines BM25-style keyword scores with semantic matches using reciprocal-rank fusion. Explicit requests such as `HW 4 problem 3`, `lecture 9 projection`, `lab 4 activity 2`, `note 2.7`, and `practice midterm 1 problem 3` constrain both retrieval paths before ranking. Requests without topic words open the indexed sections directly; missing resources return no results. Course-specific shorthand applies to the remaining topic.
