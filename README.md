# Koeus — bacterial genome & protein explorer

Named after the Titan of intellect and inquiry. Explore bacterial genomes and
protein records on NCBI: pick a genus/species (or paste a protein accession),
browse genome assemblies (type-material first), and read any GenPept record as a
clean, citable card — with domain architecture, GO terms, amino-acid sequence,
AlphaFold 3D structure, gene neighborhood (synteny), ortholog scan, and
side-by-side comparison with % identity and a phylogenetic tree.

Focused on *Geobacillus* / *Parageobacillus* (its origin) but works for any
bacterial taxon. See [`PROJECT_SPEC1.md`](./PROJECT_SPEC1.md) for the original spec.

## Stack

- **Next.js (App Router) + TypeScript**, Tailwind CSS v4, deployable on Vercel.
- NCBI calls + GenPept parsing run **server-side** (API key stays off the client).
- GenPept parsing uses a **built-in TypeScript parser** (`lib/genpeptParser.ts`),
  so the app runs with **zero Python setup**. A BioPython parser
  (`scripts/parse_genpept.py`) is available as a local opt-in (see below) and the
  app falls back to the TS parser automatically if it fails.

## Setup

```bash
npm install
npm run dev        # http://localhost:3000 — that's it
```

Optional: add an NCBI API key for higher rate limits (10 req/sec vs 3). Create
`.env.local` (see `.env.example`) with:

```
NCBI_API_KEY=your_key_here
```

Get a key from your NCBI account settings.

### Optional: use BioPython instead of the built-in parser

```bash
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
```

Then in `.env.local`:

```
USE_PYTHON_PARSER=1
PYTHON_BIN=./.venv/bin/python
```

If the Python parser fails for any reason, results fall back to the TS parser.

## Run

```bash
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run build      # production build
```

## Verifying the parser (no network needed)

The parser has a built-in self-test against the `WP_051985049` flippase record
from the spec:

```bash
./.venv/bin/python scripts/parse_genpept.py --selftest
```

## API routes

| Route | Purpose |
| --- | --- |
| `GET /api/taxon?q=<name>` | Resolve a genus/species name → taxid + rank (NCBI Datasets taxonomy) |
| `GET /api/species?taxid=<id>` | Species under a genus, with assembly counts |
| `GET /api/genomes?taxid=<id>` | Assemblies for a taxon, type material first |
| `GET /api/protein-search?q=<name>&taxid=<id>` | esearch db=protein → UIDs; broadens to a wildcard when the exact term misses |
| `GET /api/protein-fetch?id=<uid>` | efetch GenPept → parsed JSON (`&raw=1` for the flat file) |

## Deployment

Deploys as a standard Next.js app — Vercel, Netlify, or any Node host. Parsing
uses the built-in TypeScript parser, so no Python runtime is required in
production. Set one environment variable:

```
NCBI_API_KEY=your_key_here
```

## Out of scope (v1)

Bulk FTP proteome download/parsing — single gene/protein lookup only for now.
