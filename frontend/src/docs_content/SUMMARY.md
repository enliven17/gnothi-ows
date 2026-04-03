# Gnothi Documentation Summary

## Multi-Agent Systems & Autonomous Economies (Track 04)

* [Overview](11-commons.md)
  * [Prediction Market Agent Swarm](11-commons.md#1-prediction-market-agent-swarm)
  * [Agent Identity & OWS Wallet](11-commons.md#2-agent-identity--ows-wallet)
  * [Cross-Chain AI Oracle](11-commons.md#3-cross-chain-ai-oracle)
  * [Agent Communication (XMTP)](11-commons.md#4-agent-communication-xmtp)
  * [Autonomous Group Treasury](11-commons.md#5-autonomous-group-treasury)
  * [Track 04 Compliance](11-commons.md#track-04-compliance-checklist)

## Introduction

* [Welcome](README.md)
* [What is Gnothi?](01-introduction.md)
  * [The Oracle Problem](01-introduction.md#the-oracle-problem)
  * [The Gnothi Solution](01-introduction.md#the-gnothi-solution)
  * [How It Works](01-introduction.md#how-it-works)
  * [Technology Stack](01-introduction.md#technology-stack)
  * [Key Innovations](01-introduction.md#key-innovations)

## Architecture

* [System Overview](02-architecture.md)
  * [Design Principles](02-architecture.md#system-design-principles)
  * [High-Level Architecture](02-architecture.md#high-level-architecture)
  * [Component Interaction Flow](02-architecture.md#component-interaction-flow)
  * [Data Flow Diagrams](02-architecture.md#data-flow-diagrams)
  * [Contract Relationships](02-architecture.md#contract-relationships)
  * [Security Model](02-architecture.md#security-model)

## Core Components

* [Smart Contracts](03-components.md#smart-contracts-evm)
  * [BetFactoryCOFI.sol](03-components.md#betfactorycofisol)
  * [BetCOFI.sol](03-components.md#betcofisol)
  * [SCEMScoring.sol](03-components.md#scemscoringsol)
* [Bridge Service](03-components.md#bridge-service-nodejs)
  * [EvmToGenLayer.ts](03-components.md#evmtogenlayerts)
  * [news_pm.py](03-components.md#news_pypy)
* [Frontend](03-components.md#frontend-components)
  * [AIConsole](03-components.md#aiconsole-component)
  * [CreateMarketModal](03-components.md#createmarketmodal)

## Market Flows

* [NEWS Market Complete Flow](04-news-flow.md)
  * [Phase 1: Market Creation](04-news-flow.md#phase-1-market-creation)
  * [Phase 2: Trading](04-news-flow.md#phase-2-trading)
  * [Phase 3: Market Close & Trigger](04-news-flow.md#phase-3-market-close--trigger)
  * [Phase 4: AI Consensus](04-news-flow.md#phase-4-ai-consensus-genlayer)
  * [Phase 5: Resolution & Payout](04-news-flow.md#phase-5-resolution--payout)
  * [Phase 6: Claiming](04-news-flow.md#phase-6-claiming)

## SCEM Mechanism

* [Mathematical Foundation](05-scem.md#mathematical-foundation)
  * [Quadratic Scoring Rule](05-scem.md#quadratic-scoring-rule)
  * [Score Calculation](05-scem.md#score-calculation)
* [Payout Algorithm](05-scem.md#payout-algorithm)
* [Worked Example](05-scem.md#worked-example)
* [Client-Side Preview](05-scem.md#client-side-preview-typescript)
* [Game-Theoretic Properties](05-scem.md#game-theoretic-properties)

## AI Console

* [Overview](06-ai-console.md#overview)
* [Architecture](06-ai-console.md#architecture)
* [Component Structure](06-ai-console.md#component-structure)
* [Hook Implementation](06-ai-console.md#hook-implementation)
* [CSS Styling](06-ai-console.md#css-styling)
* [Bridge Service API](06-ai-console.md#bridge-service-api)

## Deployment

* [Prerequisites](07-deployment.md#prerequisites)
* [Phase 1: Smart Contracts](07-deployment.md#phase-1-smart-contracts-deployment)
* [Phase 2: Bridge Service](07-deployment.md#phase-2-bridge-service-setup)
* [Phase 3: Frontend](07-deployment.md#phase-3-frontend-setup)
* [Phase 4: GenLayer Oracle](07-deployment.md#phase-4-genlayer-oracle-deployment)
* [Phase 5: End-to-End Testing](07-deployment.md#phase-5-end-to-end-testing)
* [Production Deployment](07-deployment.md#production-deployment)

## API Reference

* [Health & Status](08-api.md#health--status)
* [Oracle Endpoints](08-api.md#oracle-endpoints)
* [Resolution Queue](08-api.md#resolution-queue)
* [Event Endpoints](08-api.md#event-endpoints)
* [Admin Endpoints](08-api.md#admin-endpoints)
* [WebSocket Endpoints](08-api.md#websocket-endpoints)
* [SDK Usage](08-api.md#sdk-usage)

## Troubleshooting

* [Smart Contracts](09-troubleshooting.md#smart-contracts)
* [Bridge Service](09-troubleshooting.md#bridge-service)
* [GenLayer Oracle](09-troubleshooting.md#genlayer-oracle)
* [Frontend](09-troubleshooting.md#frontend)
* [Deployment](09-troubleshooting.md#deployment)
* [Performance Issues](09-troubleshooting.md#performance-issues)

## Visual Diagrams

* [System Overview](10-diagrams.md#1-complete-system-overview)
* [Market Lifecycle](10-diagrams.md#2-market-lifecycle-flow)
* [Cross-Chain Messages](10-diagrams.md#3-cross-chain-message-flow)
* [AI Consensus Process](10-diagrams.md#4-ai-consensus-process)
* [SCEM Payout](10-diagrams.md#5-scem-payout-distribution)
* [Component Hierarchy](10-diagrams.md#6-component-interaction-diagram)
* [Data Flow](10-diagrams.md#7-data-flow-diagrams)



