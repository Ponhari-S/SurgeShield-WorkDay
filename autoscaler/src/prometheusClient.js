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
          const val = parseFloat(result[0].value[1]);
          return isNaN(val) ? 0 : val;
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
    const queries = [
      'sum(rate(traefik_service_requests_total[30s]))',
      'sum(rate(traefik_entrypoint_requests_total[30s]))',
      'sum(rate(http_requests_total[30s]))'
    ];

    for (const q of queries) {
      const rps = await this.queryPromQL(q);
      if (rps > 0) {
        return rps;
      }
    }
    return 0;
  }

  // Get CPU percentage across API containers
  async getApiCpuUsage() {
    const queries = [
      'avg(rate(container_cpu_usage_seconds_total{container_label_com_docker_swarm_service_name=~".*api.*"}[1m])) * 100',
      'avg(rate(container_cpu_usage_seconds_total{name=~".*api.*"}[1m])) * 100',
      'sum(rate(container_cpu_usage_seconds_total[1m])) * 100'
    ];

    for (const q of queries) {
      const cpu = await this.queryPromQL(q);
      if (cpu > 0) {
        return cpu;
      }
    }
    return 0;
  }

  // Get queue depth for BullMQ / Worker scaling
  async getWorkerQueueDepth() {
    const query = 'sum(surgeshield_queue_depth) or sum(bullmq_queue_depth)';
    return await this.queryPromQL(query);
  }
}

module.exports = PrometheusClient;
