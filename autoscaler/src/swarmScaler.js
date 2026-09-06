const Docker = require('dockerode');
const http = require('http');

class SwarmScaler {
  constructor(options = {}) {
    this.socketPath = options.socketPath || '/var/run/docker.sock';
    this.docker = new Docker({ socketPath: this.socketPath });
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

  // Direct Docker Engine API Unix Socket HTTP Call
  updateServiceViaSocket(serviceId, versionIndex, updatedSpec) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(updatedSpec);
      const req = http.request({
        socketPath: this.socketPath,
        path: `/services/${serviceId}/update?version=${versionIndex}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body);
          } else {
            reject(new Error(`(HTTP code ${res.statusCode}) ${body}`));
          }
        });
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  async setServiceReplicas(serviceNamePattern, newReplicas) {
    const serviceSpec = await this.findServiceByName(serviceNamePattern);
    if (!serviceSpec) return false;

    try {
      const service = this.docker.getService(serviceSpec.ID);
      const info = await service.inspect();
      const version = info.Version.Index;
      const currentReplicas = info.Spec?.Mode?.Replicated?.Replicas || 1;

      if (currentReplicas === newReplicas) {
        return true;
      }

      console.log(`[SwarmScaler] 🚀 Scaling service '${info.Spec.Name}' from ${currentReplicas} to ${newReplicas} replicas (Version Index: ${version})`);

      const updatedSpec = { ...info.Spec };
      updatedSpec.Mode = {
        Replicated: { Replicas: parseInt(newReplicas, 10) }
      };

      // Direct Docker Engine API Socket Call
      await this.updateServiceViaSocket(info.ID, version, updatedSpec);
      console.log(`[SwarmScaler] ✅ Successfully scaled '${info.Spec.Name}' to ${newReplicas} replicas.`);
      return true;
    } catch (err) {
      console.error(`[SwarmScaler] ❌ Error updating service '${serviceNamePattern}':`, err.message);
      return false;
    }
  }

  // Evaluates API scaling
  async evaluateApiScaling({ rps, cpu, minReplicas = 2, maxReplicas = 15, highRpsPerNode = 30, highCpuPct = 30, lowRpsPerNode = 10, lowCpuPct = 10 }) {
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
      const cpuPerNode = cpu / currentReplicas;
      // High load triggers on RPS surge per node, or CPU surge when active traffic (RPS > 5) is present
      const isHighLoad = rpsPerNode > highRpsPerNode || (rps > 5 && cpuPerNode > highCpuPct);
      const isLowLoad = cpuPerNode < lowCpuPct && rpsPerNode < lowRpsPerNode;

      console.log(`[SwarmScaler - API Metrics] Total RPS: ${rps.toFixed(1)}, CPU/Node: ${cpuPerNode.toFixed(1)}% (Total CPU: ${cpu.toFixed(1)}%), Replicas: ${currentReplicas}, RPS/Node: ${rpsPerNode.toFixed(1)}`);

      if (isHighLoad) {
        this.cooldownTrackers.api.lowWatermarkTicks = 0;
        if (currentReplicas < maxReplicas) {
          const targetReplicas = Math.min(maxReplicas, currentReplicas + Math.max(2, Math.ceil(currentReplicas * 0.5)));
          console.log(`[SwarmScaler - High Load Detected] Triggering instant scale-up: ${currentReplicas} -> ${targetReplicas}`);
          await this.setServiceReplicas('api', targetReplicas);
        } else {
          console.log(`[SwarmScaler - API At Max Replicas] Already at ceiling (${maxReplicas}).`);
        }
      } else if (currentReplicas > minReplicas) {
        this.cooldownTrackers.api.lowWatermarkTicks += 1;
        const ticks = this.cooldownTrackers.api.lowWatermarkTicks;
        const required = this.cooldownTrackers.api.requiredTicksForScaleDown;

        console.log(`[SwarmScaler - Low Load / Normal State] Cooldown tick ${ticks}/${required} before scale-down...`);

        if (ticks >= required) {
          const targetReplicas = Math.max(minReplicas, Math.floor(currentReplicas / 2));
          console.log(`[SwarmScaler - Cooldown Complete] Scaling down API: ${currentReplicas} -> ${targetReplicas}`);
          await this.setServiceReplicas('api', targetReplicas);
          this.cooldownTrackers.api.lowWatermarkTicks = 0;
        }
      } else {
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
