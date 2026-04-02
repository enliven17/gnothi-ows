/**
 * Resolution API - HTTP endpoints for automated market resolution
 *
 * Provides REST API for the frontend to schedule and monitor automated resolutions.
 */

import express from 'express';
import type { ResolutionQueue } from '../resolution/ResolutionQueue.js';
import { AutoResolver } from '../resolution/AutoResolver.js';
import { getOracle, recordOracle } from '../resolution/OracleRegistry.js';
import type { LoopMarketScheduler } from '../resolution/LoopMarketScheduler.js';

export interface ScheduleResolutionRequest {
  contractAddress: string;
  endDate: string; // ISO string
  marketTitle: string;
}

export interface ScheduleResolutionResponse {
  success: boolean;
  jobId?: string;
  message: string;
}

export interface QueueStatusResponse {
  success: boolean;
  jobs: Array<{
    id: string;
    contractAddress: string;
    endDate: string;
    marketTitle: string;
    status: string;
    createdAt: string;
    executedAt?: string;
    errorMessage?: string;
  }>;
  totalJobs: number;
}

export class ResolutionAPI {
  private app: express.Application;
  private resolutionQueue: ResolutionQueue;
  private autoResolver: AutoResolver;
  private loopScheduler: LoopMarketScheduler | null = null;

  constructor(resolutionQueue: ResolutionQueue, loopScheduler?: LoopMarketScheduler) {
    this.app = express();
    this.resolutionQueue = resolutionQueue;
    this.autoResolver = new AutoResolver();
    this.loopScheduler = loopScheduler ?? null;

    // Middleware
    this.app.use(express.json());

    // CORS for frontend communication
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Routes
    this.setupRoutes();

    console.log(`[ResolutionAPI] API endpoints initialized`);
  }

  /**
   * Setup Express routes
   */
  private setupRoutes(): void {
    // Health check endpoints
    this.app.get('/health', (req, res) => {
      res.json({
        success: true,
        message: 'Bridge Resolution Service is running',
        timestamp: new Date().toISOString()
      });
    });

    this.app.get('/api/health', (req, res) => {
      res.json({
        success: true,
        message: 'Bridge Resolution Service is running',
        timestamp: new Date().toISOString()
      });
    });

    // Schedule a new resolution
    this.app.post('/resolution/schedule', (req, res) => {
      this.handleScheduleResolution(req, res);
    });

    // Get queue status
    this.app.get('/resolution/queue', (req, res) => {
      this.handleGetQueue(req, res);
    });

    // Get specific job status
    this.app.get('/resolution/job/:id', (req, res) => {
      this.handleGetJob(req, res);
    });

    // Cancel a specific job (DELETE)
    this.app.delete('/resolution/job/:id', (req, res) => {
      this.handleCancelJob(req, res);
    });

    // Immediately execute resolve() on a market (bypasses scheduling, works for past-due)
    this.app.post('/resolution/execute', (req, res) => {
      this.handleExecuteNow(req, res);
    });

    // Oracle registry - get GenLayer tx hash for a market contract
    this.app.get('/oracle/tx/:contractAddress', async (req, res) => {
      const { contractAddress } = req.params;
      const record = await getOracle(contractAddress);
      if (!record) {
        res.status(404).json({ success: false, message: 'No oracle deployment found for this market' });
        return;
      }
      res.json({ success: true, ...record });
    });

    // Oracle registry - manually register an oracle deployment (dev/recovery use)
    this.app.post('/oracle/register', async (req, res) => {
      const { contractAddress, txHash, oracleAddress } = req.body as {
        contractAddress?: string;
        txHash?: string;
        oracleAddress?: string;
      };
      if (!contractAddress || !txHash) {
        res.status(400).json({ success: false, message: 'contractAddress and txHash are required' });
        return;
      }
      await recordOracle(contractAddress, txHash, oracleAddress ?? '');
      res.json({ success: true, message: `Registered oracle for ${contractAddress}` });
    });

    // Loop market status
    this.app.get('/loop/status', (req, res) => {
      if (!this.loopScheduler) {
        res.json({ enabled: false, markets: [] });
        return;
      }
      res.json({ enabled: true, markets: this.loopScheduler.getStatus() });
    });

    // Catch-all for unknown routes
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.path}`
      });
    });

    // Error handling middleware
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error(`[ResolutionAPI] Error:`, err);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    });
  }

  /**
   * POST /resolution/schedule
   * Schedule a new market resolution
   */
  private handleScheduleResolution(req: express.Request, res: express.Response): void {
    try {
      const { contractAddress, endDate, marketTitle }: ScheduleResolutionRequest = req.body;

      // Basic validation
      if (!contractAddress || typeof contractAddress !== 'string') {
        res.status(400).json({
          success: false,
          message: 'contractAddress is required and must be a string'
        });
        return;
      }

      if (!endDate || typeof endDate !== 'string') {
        res.status(400).json({
          success: false,
          message: 'endDate is required and must be an ISO date string'
        });
        return;
      }

      if (!marketTitle || typeof marketTitle !== 'string') {
        res.status(400).json({
          success: false,
          message: 'marketTitle is required and must be a string'
        });
        return;
      }

      // Validate contract address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
        res.status(400).json({
          success: false,
          message: 'contractAddress must be a valid Ethereum address'
        });
        return;
      }

      // Parse and validate end date
      const endDateTime = new Date(endDate);
      if (isNaN(endDateTime.getTime())) {
        res.status(400).json({
          success: false,
          message: 'endDate must be a valid ISO date string'
        });
        return;
      }

      // If end date is in the past, execute immediately instead of scheduling
      const now = new Date();
      if (endDateTime <= now) {
        console.log(`[ResolutionAPI] Past-due market, executing immediately: ${marketTitle}`);
        this.autoResolver.resolveMarket(contractAddress, marketTitle)
          .then(() => res.json({ success: true, jobId: 'immediate', message: 'Resolution executed immediately (past-due)' }))
          .catch(e => res.status(500).json({ success: false, message: e.message }));
        return;
      }

      // Add job to queue
      const jobId = this.resolutionQueue.addJob(contractAddress, endDateTime, marketTitle);

      const response: ScheduleResolutionResponse = {
        success: true,
        jobId,
        message: `Resolution scheduled for ${endDateTime.toISOString()}`
      };

      res.json(response);

    } catch (error: any) {
      console.error(`[API] Schedule error:`, error.message);

      res.status(500).json({
        success: false,
        message: 'Failed to schedule resolution',
        error: error.message
      });
    }
  }

  /**
   * GET /resolution/queue
   * Get all jobs in the queue
   */
  private handleGetQueue(req: express.Request, res: express.Response): void {
    try {
      const jobs = this.resolutionQueue.getAllJobs();

      const response: QueueStatusResponse = {
        success: true,
        jobs: jobs.map(job => ({
          id: job.id,
          contractAddress: job.contractAddress,
          endDate: job.endDate.toISOString(),
          marketTitle: job.marketTitle,
          status: job.status,
          createdAt: job.createdAt.toISOString(),
          executedAt: job.executedAt?.toISOString(),
          errorMessage: job.errorMessage
        })),
        totalJobs: jobs.length
      };

      res.json(response);

    } catch (error: any) {
      console.error(`[ResolutionAPI] Queue status error:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to get queue status',
        error: error.message
      });
    }
  }

  /**
   * GET /resolution/job/:id
   * Get specific job details
   */
  private handleGetJob(req: express.Request, res: express.Response): void {
    try {
      const { id } = req.params;
      const job = this.resolutionQueue.getJob(id);

      if (!job) {
        res.status(404).json({
          success: false,
          message: `Job not found: ${id}`
        });
        return;
      }

      res.json({
        success: true,
        job: {
          id: job.id,
          contractAddress: job.contractAddress,
          endDate: job.endDate.toISOString(),
          marketTitle: job.marketTitle,
          status: job.status,
          createdAt: job.createdAt.toISOString(),
          executedAt: job.executedAt?.toISOString(),
          errorMessage: job.errorMessage
        }
      });

    } catch (error: any) {
      console.error(`[ResolutionAPI] Get job error:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to get job details',
        error: error.message
      });
    }
  }

  /**
   * DELETE /resolution/job/:id
   * Cancel a specific job
   */
  private handleCancelJob(req: express.Request, res: express.Response): void {
    try {
      const { id } = req.params;
      const removed = this.resolutionQueue.removeJob(id);

      if (!removed) {
        res.status(404).json({
          success: false,
          message: `Job not found or already completed: ${id}`
        });
        return;
      }

      res.json({
        success: true,
        message: `Job cancelled: ${id}`
      });


    } catch (error: any) {
      console.error(`[ResolutionAPI] Cancel job error:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel job',
        error: error.message
      });
    }
  }

  /**
   * POST /resolution/execute
   * Immediately call resolve() on a market contract (no scheduling, works for past-due markets)
   */
  private async handleExecuteNow(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { contractAddress, marketTitle } = req.body;

      if (!contractAddress || !/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
        res.status(400).json({ success: false, message: 'contractAddress must be a valid Ethereum address' });
        return;
      }

      console.log(`[ResolutionAPI] Immediate execute requested: ${contractAddress}`);
      await this.autoResolver.resolveMarket(contractAddress, marketTitle || contractAddress);

      res.json({ success: true, message: `resolve() called on ${contractAddress}` });
    } catch (error: any) {
      console.error(`[ResolutionAPI] Execute error:`, error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Get the Express app instance
   */
  public getApp(): express.Application {
    return this.app;
  }
}