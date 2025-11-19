import { SshConfigParser } from '../sshConfig';
import { GpuMonitor } from '../gpuMonitor';
import * as cp from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// Mock child_process.exec
const originalExec = cp.exec;
(cp as any).exec = (command: string, callback: any) => {
    console.log(`[Mock Exec] ${command}`);
    if (command.includes('nvidia-smi')) {
        // Return dummy XML
        const dummyXml = `
<?xml version="1.0" ?>
<!DOCTYPE nvidia_smi_log SYSTEM "nvsmi_device_v12.dtd">
<nvidia_smi_log>
    <timestamp>Wed Nov 19 14:30:00 2025</timestamp>
    <driver_version>535.104.05</driver_version>
    <cuda_version>12.2</cuda_version>
    <attached_gpus>1</attached_gpus>
    <gpu id="00000000:01:00.0">
        <product_name>NVIDIA GeForce RTX 4090</product_name>
        <temperature>
            <gpu_temp>45 C</gpu_temp>
        </temperature>
        <fb_memory_usage>
            <total>24564 MiB</total>
            <used>1234 MiB</used>
            <free>23330 MiB</free>
        </fb_memory_usage>
        <utilization>
            <gpu_util>15 %</gpu_util>
            <memory_util>5 %</memory_util>
        </utilization>
    </gpu>
</nvidia_smi_log>
        `;
        callback(null, dummyXml, '');
    } else {
        callback(new Error('Unknown command'), '', 'Error');
    }
};

async function runTest() {
    console.log('--- Testing SshConfigParser ---');
    // Create a dummy ssh config
    const dummyConfigPath = path.join(os.tmpdir(), 'test_ssh_config');
    fs.writeFileSync(dummyConfigPath, 'Host test-server\n  HostName 192.168.1.100\n  User testuser\n\nHost another-server\n  HostName 10.0.0.1');
    
    const parser = new SshConfigParser();
    const hosts = parser.parse(dummyConfigPath);
    console.log('Parsed Hosts:', hosts);
    
    if (hosts.length !== 2) {
        console.error('FAILED: Expected 2 hosts');
    } else {
        console.log('PASSED: Parsed hosts correctly');
    }

    console.log('\n--- Testing GpuMonitor ---');
    const monitor = new GpuMonitor();
    try {
        const gpus = await monitor.getGpuStatus('test-server');
        console.log('GPU Status:', JSON.stringify(gpus, null, 2));
        if (gpus.length === 1 && gpus[0].name === 'NVIDIA GeForce RTX 4090') {
            console.log('PASSED: GPU status parsed correctly');
        } else {
            console.error('FAILED: GPU status incorrect');
        }
    } catch (e) {
        console.error('FAILED: Exception', e);
    }
}

runTest();
