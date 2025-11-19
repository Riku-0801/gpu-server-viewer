import * as cp from 'child_process';
import * as xml2js from 'xml2js';

export interface GpuInfo {
    index: string;
    name: string;
    utilization: {
        gpu: string;
        memory: string;
    };
    memory: {
        total: string;
        free: string;
        used: string;
    };
    temperature: {
        gpu: string;
    };
}

export class GpuMonitor {
    constructor() {}

    public async getGpuStatus(host: string): Promise<GpuInfo[]> {
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

    private async parseNvidiaSmiXml(xml: string): Promise<GpuInfo[]> {
        const parser = new xml2js.Parser({ explicitArray: false });
        try {
            const result = await parser.parseStringPromise(xml);
            const gpus = result.nvidia_smi_log.gpu;
            
            // Handle single GPU (object) vs multiple GPUs (array)
            const gpuList = Array.isArray(gpus) ? gpus : [gpus];

            return gpuList.map((gpu: any, index: number) => ({
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
        } catch (e) {
            console.error('Failed to parse XML:', e);
            return [];
        }
    }
}
