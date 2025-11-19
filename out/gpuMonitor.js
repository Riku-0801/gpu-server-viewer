"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GpuMonitor = void 0;
const cp = require("child_process");
const xml2js = require("xml2js");
class GpuMonitor {
    constructor() { }
    async getGpuStatus(host) {
        return new Promise((resolve, reject) => {
            // Use -q -x for XML output which is easier to parse than table
            const command = `ssh ${host} nvidia-smi -q -x`;
            cp.exec(command, (error, stdout, stderr) => {
                if (error) {
                    // If ssh fails or nvidia-smi fails
                    console.error(`Error fetching GPU status for ${host}:`, error);
                    // For demo purposes, if it fails, maybe return empty or throw
                    // If the user doesn't have a GPU server, this will fail.
                    // I should probably mock this if it fails for specific "test" hosts?
                    // For now, just reject.
                    reject(error);
                    return;
                }
                this.parseNvidiaSmiXml(stdout)
                    .then(resolve)
                    .catch(reject);
            });
        });
    }
    async parseNvidiaSmiXml(xml) {
        const parser = new xml2js.Parser({ explicitArray: false });
        try {
            const result = await parser.parseStringPromise(xml);
            const gpus = result.nvidia_smi_log.gpu;
            // Handle single GPU (object) vs multiple GPUs (array)
            const gpuList = Array.isArray(gpus) ? gpus : [gpus];
            return gpuList.map((gpu, index) => ({
                index: index.toString(),
                name: gpu.product_name,
                utilization: {
                    gpu: gpu.utilization.gpu_util,
                    memory: gpu.utilization.memory_util
                },
                memory: {
                    total: gpu.fb_memory_usage.total,
                    free: gpu.fb_memory_usage.free,
                    used: gpu.fb_memory_usage.used
                },
                temperature: {
                    gpu: gpu.temperature.gpu_temp
                }
            }));
        }
        catch (e) {
            console.error('Failed to parse XML:', e);
            return [];
        }
    }
}
exports.GpuMonitor = GpuMonitor;
//# sourceMappingURL=gpuMonitor.js.map