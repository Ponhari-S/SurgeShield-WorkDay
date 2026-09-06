const axios = require('axios');

class PrometheusClient {
  constructor(prometheusUrl) {
    this.baseUrl = prometheusUrl || process.env.PROMETHEUS_URL || 'http://prometheus:9090';
  }

  async queryPromQL(query) {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/query`, {
        params: { query },
        timeout: 3000,
      });

      if (response.data && response.data.status === 'success') {
        const result = response.data.data.result;
        if (result && result.length > 0) {
          // Parse single scalar or first series value
          return parseFloat(result[0].value[1]) || 0;
        }
      }
      return 0;
    } catch (err) {
      console.error(`[PrometheusClient] Query error for (${query}):`, err.message);
      return 0;
    }
  }

  // Get total RPS for API service across Traefik or Express metrics
  async getApiRps() {
    // Tries Traefik metric first, falls back to direct http_requests_total
    const traefikQuery = 'sum(rate(traefik_service_requests_total{service=~".*api.*"}[30s]))';
    let rps = await this.queryPromQL(traefikQuery);
    if (rps === 0) {
      const appQuery = 'sum(rate(http_requests_total[30s]))';
      rps = await this.queryPromQL(appQuery);
    }
    return rps;
  }

  // Get average CPU percentage across API containers from cAdvisor or Node metrics
  async getApiCpuUsage() {
    const cadvisorQuery = 'avg(rate(container_cpu_usage_seconds_total{container_label_com_docker_swarm_service_name=~".*api.*"}[1m])) * 100';
    let cpu = await this.queryPromQL(cadvisorQuery);
    if (cpu === 0) {
      // Fallback metric if container label varies
      const fallbackQuery = 'avg(rate(container_cpu_usage_seconds_total{image=~".*api.*"}[1m])) * 100';
      cpu = await this.queryPromQL(fallbackQuery);
    }
    return cpu;
  }

  // Get queue depth for BullMQ / Worker scaling
  async getWorkerQueueDepth() {
    const query = 'sum(surgeshield_queue_depth) or sum(bullmq_queue_depth)';
    return await this.queryPromQL(query);
  }
}

module.exports = PrometheusClient;
