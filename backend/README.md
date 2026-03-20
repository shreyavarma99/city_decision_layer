# Backend Architecture

This backend is the source of truth for safety intervention definitions.

## Layers

- `src/domain/interventions`
  Contains the intervention catalog and domain-level definitions such as placement rules and analysis hints.
- `src/application/interventions`
  Contains use-case logic for listing and retrieving interventions.
- `src/presentation/http`
  Contains Express controllers and routes that expose the catalog over HTTP.
- `src/config`
  Contains runtime configuration and environment parsing.

## API

- `GET /api/health`
  Health check endpoint.
- `GET /api/interventions`
  Returns all intervention definitions for the frontend planner.
- `GET /api/interventions/:interventionId`
  Returns a single intervention definition.

## Current Source Of Truth

The intervention catalog lives in `src/domain/interventions/interventionCatalog.js`.
The frontend should treat that API as authoritative for:

- Which interventions exist
- How they are labeled and described
- Which road classes they can be placed on
- Which future analysis modules should evaluate them
