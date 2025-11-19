"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const serverProvider_1 = require("./serverProvider");
const gpuView_1 = require("./gpuView");
const sshConfig_1 = require("./sshConfig");
function activate(context) {
    console.log('Congratulations, your extension "gpu-server-viewer" is now active!');
    const serverProvider = new serverProvider_1.GpuServerProvider();
    vscode.window.registerTreeDataProvider('gpuServerList', serverProvider);
    context.subscriptions.push(vscode.commands.registerCommand('gpu-server-viewer.refresh', () => serverProvider.refresh()), vscode.commands.registerCommand('gpu-server-viewer.addServer', () => vscode.window.showInformationMessage('Add Server not implemented yet.')), vscode.commands.registerCommand('gpu-server-viewer.openServer', (host) => {
        gpuView_1.GpuViewPanel.createOrShow(context.extensionUri, host);
    }), vscode.commands.registerCommand('gpu-server-viewer.openDashboard', () => {
        gpuView_1.GpuViewPanel.createOrShow(context.extensionUri, undefined);
    }), vscode.commands.registerCommand('gpu-server-viewer.connectSsh', (item) => {
        let host = '';
        if (typeof item === 'string') {
            host = item;
        }
        else if (item && item.host) {
            host = item.host;
        }
        else {
            return;
        }
        vscode.commands.executeCommand('vscode.newWindow', {
            remoteAuthority: `ssh-remote+${host}`
        });
    }), vscode.commands.registerCommand('gpu-server-viewer.configureServers', async () => {
        const config = vscode.workspace.getConfiguration('gpu-server-viewer');
        const configPath = config.get('sshConfigPath') || '~/.ssh/config';
        const targets = config.get('targets') || [];
        const ignored = config.get('ignoredHosts') || [];
        const parser = new sshConfig_1.SshConfigParser();
        const allHosts = parser.parse(configPath);
        // Filter by targets if set
        let candidates = allHosts;
        if (targets.length > 0) {
            candidates = allHosts.filter((h) => targets.includes(h.host));
        }
        const items = candidates.map((h) => ({
            label: h.host,
            picked: !ignored.includes(h.host)
        }));
        const selected = await vscode.window.showQuickPick(items, {
            canPickMany: true,
            placeHolder: 'Select servers to show'
        });
        if (selected) {
            const selectedHosts = selected.map(s => s.label);
            // Ignored hosts are those NOT in selectedHosts
            const newIgnored = candidates
                .map((h) => h.host)
                .filter((h) => !selectedHosts.includes(h));
            await config.update('ignoredHosts', newIgnored, vscode.ConfigurationTarget.Global);
            serverProvider.refresh();
        }
    }));
    // Open dashboard on activation
    vscode.commands.executeCommand('gpu-server-viewer.openDashboard');
}
function deactivate() { }
//# sourceMappingURL=extension.js.map