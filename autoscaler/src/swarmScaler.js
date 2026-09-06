const Docker = require('dockerode');

class SwarmScaler {
  constructor(options = {}) {
    this.docker = new Docker({ socketPath: options.socketPath || '/var/run/docker.sock' });
    this.isScaling = false;

    // Cooldown tracking for anti-flapping
    this.cooldownTrackers = {
      api: { lowWatermarkTicks: 0, requiredTicksForScaleDown: options.cooldownTicks || 6 },
      worker: { lowWatermarkTicks: 0, requiredTicksForScaleDown: options.cooldownTicks || 6 }
    };
  }

  async findServiceByName(serviceNamePattern) {
    try {
      const services = await this.docker.listServices();
      const matched = services.find(s => s.Spec.Name.includes(serviceNamePattern));
      if (!matched) {
        console.log(`[SwarmScaler] Service matching '${serviceNamePattern}' not found in Docker Swarm.`);
        return null;
      }
      return matched;
    } catch (err) {
      console.error(`[SwarmScaler] Error listing Docker services:`, err.message);
      return null;
    }
  }

  async getServiceReplicas(serviceNamePattern) {
    const serviceSpec = await this.findServiceByName(serviceNamePattern);
    if (!serviceSpec) return 0;
    return serviceSpec.Spec.Mode.Replicated?.Replicas || 1;
  }

  async setServiceReplicas(serviceNamePattern, newReplicas) {
    const serviceSpec = await this.findServiceByName(serviceNamePattern);
    if (!serviceSpec) return false;

    const service = this.docker.getService(serviceSpec.ID);
    const currentVersion = serviceSpec.Version.Index;
    const currentReplicas = serviceSpec.Spec.Mode.Replicated?.Replicas || 1;

    if (currentReplicas === newReplicas) {
      return true;
    }

    console.log(`[SwarmScaler] 🚀 Scaling service '${serviceSpec.Spec.Name}' from ${currentReplicas} to ${newReplicas} replicas`);

    const updatedSpec = { ...serviceSpec.Spec };
    updatedSpec.Mode = {
      Replicated: { Replicas: newReplicas }
    };

    try {
      await service.update({ version: currentVersion }, updatedSpec);
      console.log(`[SwarmScaler] ✅ Successfully scaled '${serviceSpec.Spec.Name}' to ${newReplicas} replicas.`);
      return true;
    } catch (err) {
      console.error(`[SwarmScaler] ❌ Error updating service '${serviceSpec.Spec.Name}':`, err.message);
      return false;
    }
  }

  // Evaluates scaling decisions with Hysteresis & Cooldown logic
  async evaluateApiScaling({ rps, cpu, minReplicas = 2, maxReplicas = 15, highRpsPerNode = 250, highCpuPct = 70, lowRpsPerNode = 50, lowCpuPct = 30 }) {
    if (this.isScaling) {
      console.log(`[SwarmScaler] Scaling operation currently in progress. Skipping tick.`);
      return;
    }

    this.isScaling = true;
    try {
      const currentReplicas = await this.getServiceReplicas('api');
      if (currentReplicas === 0) {
        this.isScaling = false;
        return;
      }

      const rpsPerNode = rps / currentReplicas;
      const isHighLoad = cpu > highCpuPct || rpsPerNode > highRpsPerNode;
      const isLowLoad = cpu < lowCpuPct && rpsPerNode < lowRpsPerNode;

      console.log(`[SwarmScaler - API Metrics] Total RPS: ${rps.toFixed(1)}, Avg CPU: ${cpu.toFixed(1)}%, Replicas: ${currentReplicas}, RPS/Node: ${rpsPerNode.toFixed(1)}`);

      if (isHighLoad) {
        // Instant Scale-Up Policy
        this.cooldownTrackers.api.lowWatermarkTicks = 0; // Reset scale-down cooldown
        if (currentReplicas < maxReplicas) {
          const targetReplicas = Math.min(maxReplicas, currentReplicas + Math.max(2, Math.ceil(currentReplicas * 0.5)));
          console.log(`[SwarmScaler - High Load Detected] Triggering instant scale-up: ${currentReplicas} -> ${targetReplicas}`);
          await this.setServiceReplicas('api', targetReplicas);
        } else {
          console.log(`[SwarmScaler - API At Max Replicas] Already at ceiling (${maxReplicas}).`);
        }
      } else if (isLowLoad && currentReplicas > minReplicas) {
        // Cooldown Scale-Down Policy
        this.cooldownTrackers.api.lowWatermarkTicks += 1;
        const ticks = this.cooldownTrackers.api.lowWatermarkTicks;
        const required = this.cooldownTrackers.api.requiredTicksForScaleDown;

        console.log(`[SwarmScaler - Low Load Detected] Cooldown tick ${ticks}/${required} before scale-down...`);

        if (ticks >= required) {
          const targetReplicas = Math.max(minReplicas, Math.floor(currentReplicas / 2));
          console.log(`[SwarmScaler - Cooldown Complete] Scaling down API: ${currentReplicas} -> ${targetReplicas}`);
          await this.setServiceReplicas('api', targetReplicas);
          this.cooldownTrackers.api.lowWatermarkTicks = 0;
        }
      } else {
        // Load within normal stable window
        this.cooldownTrackers.api.lowWatermarkTicks = 0;
      }
    } finally {
      this.isScaling = false;
    }
  }

  // Evaluates Worker queue depth scaling
  async evaluateWorkerScaling({ queueDepth, minReplicas = 1, maxReplicas = 10, highQueueDepth = 500, lowQueueDepth = 50 }) {
    const currentReplicas = await this.getServiceReplicas('worker');
    if (currentReplicas === 0) return;

    console.log(`[SwarmScaler - Worker Metrics] Queue Depth: ${queueDepth}, Replicas: ${currentReplicas}`);

    if (queueDepth > highQueueDepth && currentReplicas < maxReplicas) {
      this.cooldownTrackers.worker.lowWatermarkTicks = 0;
      const targetReplicas = Math.min(maxReplicas, currentReplicas + 2);
      console.log(`[SwarmScaler - High Queue Depth] Scaling worker: ${currentReplicas} -> ${targetReplicas}`);
      await this.setServiceReplicas('worker', targetReplicas);
    } else if (queueDepth < lowQueueDepth && currentReplicas > minReplicas) {
      this.cooldownTrackers.worker.lowWatermarkTicks += 1;
      const ticks = this.cooldownTrackers.worker.lowWatermarkTicks;
      const required = this.cooldownTrackers.worker.requiredTicksForScaleDown;

      if (ticks >= required) {
        const targetReplicas = Math.max(minReplicas, currentReplicas - 1);
        console.log(`[SwarmScaler - Worker Cooldown Complete] Scaling down worker: ${currentReplicas} -> ${targetReplicas}`);
        await this.setServiceReplicas('worker', targetReplicas);
        this.cooldownTrackers.worker.lowWatermarkTicks = 0;
      }
    } else {
      this.cooldownTrackers.worker.lowWatermarkTicks = 0;
    }
  }
}

module.exports = SwarmScaler;
